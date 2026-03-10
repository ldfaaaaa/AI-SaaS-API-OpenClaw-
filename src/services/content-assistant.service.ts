import prisma from '../utils/prisma';
import { doubaoService } from './doubao.service';
import { VoiceCloneService } from './voice-clone.service';
import { ossService } from './oss.service';
import { workflowService } from './workflow.service';
import { BadRequestError, NotFoundError, InternalServerError } from '../utils/errors';
import AdmZip from 'adm-zip';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// 创建VoiceCloneService实例
const voiceCloneService = new VoiceCloneService();

/**
 * 营销内容包生成输入
 */
export interface MarketingPackageInput {
  imageUrls: string[]; // 效果图URL列表
  projectDescription: {
    style?: string; // 风格
    area?: string; // 面积
    budget?: string; // 预算
    otherInfo?: string; // 其他信息
  };
}

/**
 * 营销内容包输出
 */
export interface MarketingPackageOutput {
  titles: string[]; // 小红书标题（5个）
  content: string; // 图文正文（500字左右）
  hashtags: string[]; // 话题标签（10个）
  moments: {
    professional: string; // 专业版朋友圈文案
    casual: string; // 轻松版朋友圈文案
    attractive: string; // 吸引版朋友圈文案
  };
}

/**
 * 配音解说脚本输入
 */
export interface VoiceoverScriptInput {
  imageUrl: string; // 效果图URL
  styleDescription?: string; // 风格描述
  voiceProfileId?: string; // 声音档案ID（可选）
}

/**
 * 字幕条目
 */
export interface SubtitleEntry {
  index: number;
  text: string;
  startTime: string; // 格式：00:00:00,000
  endTime: string; // 格式：00:00:00,000
}

/**
 * 配音解说脚本输出
 */
export interface VoiceoverScriptOutput {
  script: string; // 解说文案（300字左右）
  subtitles: SubtitleEntry[]; // 字幕列表
  audioUrl?: string; // MP3音频URL（如果提供了声音档案）
}

/**
 * OpenClaw 内容助手服务
 */
export class ContentAssistantService {
  /**
   * 功能1: 设计图 → 营销内容包生成
   */
  async generateMarketingPackage(
    userId: string,
    input: MarketingPackageInput
  ): Promise<{ workflowId: string; contentPackageId: string }> {
    // 验证输入
    if (!input.imageUrls || input.imageUrls.length === 0) {
      throw new BadRequestError('至少需要提供一张效果图URL');
    }

    // 创建内容包记录
    const contentPackage = await prisma.contentPackage.create({
      data: {
        user_id: userId,
        package_name: `营销内容包_${new Date().toISOString()}`,
        package_type: 'marketing',
        description: this.buildProjectDescription(input.projectDescription),
        assets: { imageUrls: input.imageUrls },
        config: input,
      },
    });

    // 创建工作流执行
    const workflowId = await workflowService.createWorkflowExecution(
      userId,
      contentPackage.id,
      'marketing_package',
      5 // 5个步骤
    );

    // 初始化工作流步骤
    await workflowService.initializeSteps(workflowId, [
      { name: 'generate_titles', order: 1 },
      { name: 'generate_content', order: 2 },
      { name: 'generate_hashtags', order: 3 },
      { name: 'generate_moments', order: 4 },
      { name: 'package_results', order: 5 },
    ]);

    // 异步执行工作流
    this.executeMarketingPackageWorkflow(workflowId, contentPackage.id, input).catch((error) => {
      console.error('营销内容包工作流执行失败:', error);
    });

    return {
      workflowId,
      contentPackageId: contentPackage.id,
    };
  }

  /**
   * 执行营销内容包工作流
   */
  private async executeMarketingPackageWorkflow(
    workflowId: string,
    contentPackageId: string,
    input: MarketingPackageInput
  ): Promise<void> {
    try {
      await workflowService.startWorkflowExecution(workflowId);

      const projectDesc = this.buildProjectDescription(input.projectDescription);
      const results: Partial<MarketingPackageOutput> = {};

      // 步骤1: 生成小红书标题
      const titles = await workflowService.executeStep(
        workflowId,
        'generate_titles',
        async () => await this.generateTitles(projectDesc)
      ) as string[];
      results.titles = titles;

      // 步骤2: 生成图文正文
      const content = await workflowService.executeStep(
        workflowId,
        'generate_content',
        async () => await this.generateContent(projectDesc)
      ) as string;
      results.content = content;

      // 步骤3: 生成话题标签
      const hashtags = await workflowService.executeStep(
        workflowId,
        'generate_hashtags',
        async () => await this.generateHashtags(projectDesc)
      ) as string[];
      results.hashtags = hashtags;

      // 步骤4: 生成朋友圈文案
      const moments = await workflowService.executeStep(
        workflowId,
        'generate_moments',
        async () => await this.generateMoments(projectDesc)
      ) as MarketingPackageOutput['moments'];
      results.moments = moments;

      // 步骤5: 打包下载
      const zipUrl = await workflowService.executeStep(
        workflowId,
        'package_results',
        async () => await this.packageMarketingResults(contentPackageId, input.imageUrls, results as MarketingPackageOutput)
      ) as string;

      // 更新内容包结果
      await prisma.contentPackage.update({
        where: { id: contentPackageId },
        data: {
          result_data: results,
          result_zip_url: zipUrl,
        },
      });

    } catch (error) {
      console.error('营销内容包工作流执行失败:', error);
      throw error;
    }
  }

  /**
   * 功能2: 效果图 → 配音解说脚本
   */
  async generateVoiceoverScript(
    userId: string,
    input: VoiceoverScriptInput
  ): Promise<{ workflowId: string; contentPackageId: string }> {
    // 验证输入
    if (!input.imageUrl) {
      throw new BadRequestError('必须提供效果图URL');
    }

    // 如果提供了声音档案ID，验证其存在性
    if (input.voiceProfileId) {
      const profile = await prisma.voiceProfile.findUnique({
        where: { id: input.voiceProfileId },
      });

      if (!profile || profile.user_id !== userId) {
        throw new NotFoundError('声音档案不存在或无权访问');
      }

      if (!profile.is_trained) {
        throw new BadRequestError('声音档案尚未训练完成');
      }
    }

    // 创建内容包记录
    const contentPackage = await prisma.contentPackage.create({
      data: {
        user_id: userId,
        package_name: `配音解说_${new Date().toISOString()}`,
        package_type: 'voiceover',
        description: input.styleDescription || '效果图配音解说',
        assets: { imageUrl: input.imageUrl },
        config: input,
      },
    });

    // 创建工作流执行
    const stepCount = input.voiceProfileId ? 4 : 3; // 有声音档案时多一个TTS步骤
    const workflowId = await workflowService.createWorkflowExecution(
      userId,
      contentPackage.id,
      'voiceover_script',
      stepCount
    );

    // 初始化工作流步骤
    const steps = [
      { name: 'analyze_image', order: 1 },
      { name: 'generate_script', order: 2 },
      { name: 'generate_subtitles', order: 3 },
    ];

    if (input.voiceProfileId) {
      steps.push({ name: 'synthesize_audio', order: 4 });
    }

    await workflowService.initializeSteps(workflowId, steps);

    // 异步执行工作流
    this.executeVoiceoverScriptWorkflow(workflowId, contentPackage.id, input).catch((error) => {
      console.error('配音解说脚本工作流执行失败:', error);
    });

    return {
      workflowId,
      contentPackageId: contentPackage.id,
    };
  }

  /**
   * 执行配音解说脚本工作流
   */
  private async executeVoiceoverScriptWorkflow(
    workflowId: string,
    contentPackageId: string,
    input: VoiceoverScriptInput
  ): Promise<void> {
    try {
      await workflowService.startWorkflowExecution(workflowId);

      const results: Partial<VoiceoverScriptOutput> = {};

      // 步骤1: AI分析图片内容
      const imageAnalysis = await workflowService.executeStep(
        workflowId,
        'analyze_image',
        async () => await this.analyzeImage(input.imageUrl, input.styleDescription)
      ) as string;

      // 步骤2: 生成解说文案
      const script = await workflowService.executeStep(
        workflowId,
        'generate_script',
        async () => await this.generateScript(imageAnalysis, input.styleDescription)
      ) as string;
      results.script = script;

      // 步骤3: 生成字幕列表
      const subtitles = await workflowService.executeStep(
        workflowId,
        'generate_subtitles',
        async () => await this.generateSubtitles(script)
      ) as SubtitleEntry[];
      results.subtitles = subtitles;

      // 步骤4: （可选）合成音频
      if (input.voiceProfileId) {
        const audioUrl = await workflowService.executeStep(
          workflowId,
          'synthesize_audio',
          async () => await this.synthesizeAudio(script, input.voiceProfileId!)
        ) as string;
        results.audioUrl = audioUrl;
      }

      // 打包结果
      const zipUrl = await this.packageVoiceoverResults(contentPackageId, results as VoiceoverScriptOutput);

      // 更新内容包结果
      await prisma.contentPackage.update({
        where: { id: contentPackageId },
        data: {
          result_data: results,
          result_zip_url: zipUrl,
        },
      });

    } catch (error) {
      console.error('配音解说脚本工作流执行失败:', error);
      throw error;
    }
  }

  // ============= 辅助方法 =============

  /**
   * 生成小红书标题（5个候选）
   */
  private async generateTitles(projectDesc: string): Promise<string[]> {
    const prompt = `作为一名专业的室内设计营销专家，请为以下项目生成5个吸引人的小红书标题。

项目描述：
${projectDesc}

要求：
1. 每个标题长度15-25字
2. 使用emoji增加吸引力
3. 突出设计亮点和用户痛点
4. 适合小红书平台风格
5. 每个标题一行，用数字编号

请直接输出5个标题：`;

    const response = await doubaoService.generateText(prompt);
    
    // 解析标题（按行分割，去除空行和编号）
    const titles = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^\d+[\.、]\s*/, ''))
      .slice(0, 5);

    if (titles.length < 5) {
      throw new InternalServerError('生成的标题数量不足');
    }

    return titles;
  }

  /**
   * 生成图文正文
   */
  private async generateContent(projectDesc: string): Promise<string> {
    const prompt = `作为一名专业的室内设计内容创作者，请为以下项目撰写一篇小红书图文正文。

项目描述：
${projectDesc}

要求：
1. 字数约500字
2. 开头吸引眼球，引起共鸣
3. 详细介绍设计亮点（空间布局、色彩搭配、材质选择、功能性等）
4. 加入适当的emoji增加可读性
5. 结尾引导互动（点赞收藏等）
6. 语言风格：亲和、专业但不枯燥

请直接输出正文内容：`;

    return await doubaoService.generateText(prompt);
  }

  /**
   * 生成话题标签
   */
  private async generateHashtags(projectDesc: string): Promise<string[]> {
    const prompt = `作为一名社交媒体运营专家，请为以下室内设计项目生成10个小红书话题标签。

项目描述：
${projectDesc}

要求：
1. 生成10个标签
2. 包含热门装修话题
3. 包含设计风格相关标签
4. 包含功能性标签（如#收纳#小户型等）
5. 标签格式：#话题名称
6. 每个标签一行

请直接输出10个标签：`;

    const response = await doubaoService.generateText(prompt);
    
    // 解析标签
    const hashtags = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('#'))
      .slice(0, 10);

    if (hashtags.length < 10) {
      throw new InternalServerError('生成的标签数量不足');
    }

    return hashtags;
  }

  /**
   * 生成朋友圈文案（3个版本）
   */
  private async generateMoments(projectDesc: string): Promise<MarketingPackageOutput['moments']> {
    const prompt = `作为一名设计师朋友圈营销专家，请为以下项目生成3条不同风格的朋友圈文案。

项目描述：
${projectDesc}

要求为3个版本：
1. 【专业版】：突出设计专业性和价值，适合B端客户
2. 【轻松版】：轻松幽默，拉近距离，适合C端年轻客户
3. 【吸引版】：突出痛点和效果对比，引发咨询欲望

每条文案要求：
- 字数80-150字
- 可以使用emoji
- 结尾带有行动号召

请按照以下格式输出：

【专业版】
文案内容...

【轻松版】
文案内容...

【吸引版】
文案内容...`;

    const response = await doubaoService.generateText(prompt);
    
    // 解析三种版本的文案
    const professional = this.extractSection(response, '【专业版】', '【轻松版】');
    const casual = this.extractSection(response, '【轻松版】', '【吸引版】');
    const attractive = this.extractSection(response, '【吸引版】', null);

    return {
      professional,
      casual,
      attractive,
    };
  }

  /**
   * 分析图片内容
   */
  private async analyzeImage(_imageUrl: string, styleDescription?: string): Promise<string> {
    // 注意：_imageUrl参数暂时未使用，因为需要多模态模型支持
    // 实际应用中这里应该调用多模态模型（图像理解）
    const prompt = `作为一名专业的室内设计师，请分析这张效果图的设计要素。

${styleDescription ? `风格说明：${styleDescription}` : ''}

请从以下角度分析：
1. 整体空间类型（客厅/卧室/厨房等）
2. 设计风格（现代/简约/北欧/轻奢等）
3. 色彩搭配
4. 材质运用
5. 空间布局特点
6. 设计亮点

请用简洁专业的语言描述，约200字：`;

    // 目前先使用文本提示，实际部署时需要接入视觉模型
    return await doubaoService.generateText(
      `${prompt}\n\n注意：由于当前是演示版本，请基于"${styleDescription || '现代简约风格室内设计效果图'}"生成分析内容。`
    );
  }

  /**
   * 生成解说文案
   */
  private async generateScript(imageAnalysis: string, styleDescription?: string): Promise<string> {
    const prompt = `作为一名专业的设计解说员，请根据图片分析结果，创作一段适合短视频配音的解说文案。

图片分析：
${imageAnalysis}

${styleDescription ? `风格描述：${styleDescription}` : ''}

要求：
1. 字数约300字
2. 语言口语化、节奏感强
3. 突出设计亮点和细节
4. 适合1分钟左右的短视频配音
5. 分成3-5个自然段落

请直接输出解说文案：`;

    return await doubaoService.generateText(prompt);
  }

  /**
   * 生成字幕列表（SRT格式）
   */
  private async generateSubtitles(script: string): Promise<SubtitleEntry[]> {
    // 简单的句子分割（实际应用中应该根据TTS时长精确计算）
    const sentences = script
      .replace(/\n+/g, ' ')
      .split(/[。！？.!?]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const subtitles: SubtitleEntry[] = [];
    let currentTime = 0;

    sentences.forEach((text, index) => {
      // 估算每句话的时长（按字数，平均每字0.3秒）
      const duration = Math.max(2, text.length * 0.3);
      
      subtitles.push({
        index: index + 1,
        text,
        startTime: this.formatSRTTime(currentTime),
        endTime: this.formatSRTTime(currentTime + duration),
      });

      currentTime += duration + 0.5; // 句子间隔0.5秒
    });

    return subtitles;
  }

  /**
   * 合成音频
   */
  private async synthesizeAudio(script: string, voiceProfileId: string): Promise<string> {
    const profile = await prisma.voiceProfile.findUnique({
      where: { id: voiceProfileId },
    });

    if (!profile || !profile.voice_id) {
      throw new NotFoundError('声音档案不存在或未完成训练');
    }

    // 调用声音克隆服务合成音频（跳过合规确认，因为已在创建时确认）
    const result = await voiceCloneService.synthesizeSpeech(
      profile.user_id,
      voiceProfileId,
      script,
      true // 合规已确认
    );

    if (!result.audioUrl) {
      throw new InternalServerError('音频合成失败');
    }

    // 上传到OSS（如果返回的是远程URL）
    const audioUrl = await ossService.uploadFromUrl(
      result.audioUrl,
      `content-assistant/voiceover/${profile.user_id}/${Date.now()}.mp3`
    );

    return audioUrl;
  }

  /**
   * 打包营销内容结果为ZIP
   */
  private async packageMarketingResults(
    contentPackageId: string,
    imageUrls: string[],
    results: MarketingPackageOutput
  ): Promise<string> {
    const zip = new AdmZip();
    const tempDir = path.join(os.tmpdir(), `marketing_${contentPackageId}`);

    try {
      // 确保临时目录存在
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // 添加文案TXT
      const contentText = this.formatMarketingContentToText(results);
      zip.addFile('营销文案.txt', Buffer.from(contentText, 'utf8'));

      // 添加标签TXT
      const hashtagsText = results.hashtags.join('\n');
      zip.addFile('话题标签.txt', Buffer.from(hashtagsText, 'utf8'));

      // 下载并添加图片
      for (let i = 0; i < imageUrls.length; i++) {
        try {
          const response = await fetch(imageUrls[i]);
          const buffer = await response.arrayBuffer();
          const ext = this.getImageExtension(imageUrls[i]);
          zip.addFile(`图片_${i + 1}.${ext}`, Buffer.from(buffer));
        } catch (error) {
          console.error(`下载图片失败: ${imageUrls[i]}`, error);
        }
      }

      // 生成ZIP文件
      const zipPath = path.join(tempDir, 'marketing_package.zip');
      zip.writeZip(zipPath);

      // 生成临时文件URL（使用日期作为唯一标识）
      const tempFileName = `marketing_${contentPackageId}_${Date.now()}.zip`;
      const tempFilePath = path.join(os.tmpdir(), tempFileName);
      fs.copyFileSync(zipPath, tempFilePath);

      // 使用OSS上传（通过生成临时HTTP服务器或直接返回文件路径）
      // 这里简单返回本地路径，实际生产中应该上传到OSS
      // 由于ossService没有uploadBuffer方法，我们需要返回文件路径
      const zipUrl = tempFilePath; // TODO: 实际应上传到OSS

      // 清理临时目录（保留ZIP文件供下载）
      fs.rmSync(tempDir, { recursive: true, force: true });

      return zipUrl;
    } catch (error) {
      // 清理临时文件
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      throw error;
    }
  }

  /**
   * 打包配音解说结果为ZIP
   */
  private async packageVoiceoverResults(
    contentPackageId: string,
    results: VoiceoverScriptOutput
  ): Promise<string> {
    const zip = new AdmZip();

    // 添加文案TXT
    zip.addFile('解说文案.txt', Buffer.from(results.script, 'utf8'));

    // 添加字幕SRT
    const srtContent = this.formatSubtitlesToSRT(results.subtitles);
    zip.addFile('字幕.srt', Buffer.from(srtContent, 'utf8'));

    // 如果有音频，下载并添加
    if (results.audioUrl) {
      try {
        const response = await fetch(results.audioUrl);
        const buffer = await response.arrayBuffer();
        zip.addFile('解说音频.mp3', Buffer.from(buffer));
      } catch (error) {
        console.error('下载音频失败:', error);
      }
    }

    // 生成ZIP文件并保存到临时目录
    const tempFileName = `voiceover_${contentPackageId}_${Date.now()}.zip`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);
    zip.writeZip(tempFilePath);

    // TODO: 实际应上传到OSS，这里暂时返回本地路径
    return tempFilePath;
  }

  // ============= 工具方法 =============

  private buildProjectDescription(desc: MarketingPackageInput['projectDescription']): string {
    const parts: string[] = [];
    if (desc.style) parts.push(`风格：${desc.style}`);
    if (desc.area) parts.push(`面积：${desc.area}`);
    if (desc.budget) parts.push(`预算：${desc.budget}`);
    if (desc.otherInfo) parts.push(desc.otherInfo);
    return parts.join('，') || '室内设计项目';
  }

  private extractSection(text: string, startMarker: string, endMarker: string | null): string {
    const startIndex = text.indexOf(startMarker);
    if (startIndex === -1) return '';

    const contentStart = startIndex + startMarker.length;
    const endIndex = endMarker ? text.indexOf(endMarker, contentStart) : text.length;
    
    return text
      .substring(contentStart, endIndex === -1 ? text.length : endIndex)
      .trim();
  }

  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  private formatSubtitlesToSRT(subtitles: SubtitleEntry[]): string {
    return subtitles
      .map(sub => `${sub.index}\n${sub.startTime} --> ${sub.endTime}\n${sub.text}\n`)
      .join('\n');
  }

  private formatMarketingContentToText(results: MarketingPackageOutput): string {
    return `============ 小红书标题候选 ============

${results.titles.map((title, i) => `${i + 1}. ${title}`).join('\n')}

============ 图文正文 ============

${results.content}

============ 朋友圈文案 ============

【专业版】
${results.moments.professional}

【轻松版】
${results.moments.casual}

【吸引版】
${results.moments.attractive}
`;
  }

  private getImageExtension(url: string): string {
    const match = url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
    return match ? match[1].toLowerCase() : 'jpg';
  }
}

// 导出单例
export const contentAssistantService = new ContentAssistantService();

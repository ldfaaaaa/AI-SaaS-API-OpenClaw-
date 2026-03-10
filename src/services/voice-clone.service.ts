import prisma from '../utils/prisma';
import { BadRequestError, InternalServerError, ConflictError, NotFoundError } from '../utils/errors';

/**
 * 火山引擎声音克隆API配置
 */
const VOICE_CLONE_BASE_URL = 'https://openspeech.bytedance.com/api/v1/mega_tts';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

/**
 * 训练状态枚举
 * 0: 未发现 (not_found)
 * 1: 训练中 (training)
 * 2: 训练完成 (completed)
 * 3: 训练失败 (failed)
 */
export enum TrainingStatusCode {
  NOT_FOUND = 0,
  TRAINING = 1,
  COMPLETED = 2,
  FAILED = 3,
}

/**
 * 训练状态映射
 */
const TRAINING_STATUS_MAP: Record<TrainingStatusCode, string> = {
  [TrainingStatusCode.NOT_FOUND]: 'pending',
  [TrainingStatusCode.TRAINING]: 'training',
  [TrainingStatusCode.COMPLETED]: 'completed',
  [TrainingStatusCode.FAILED]: 'failed',
};

/**
 * 上传音频响应
 */
export interface UploadAudioResponse {
  code: number;
  message: string;
  data?: {
    speaker_id: string;
    [key: string]: unknown;
  };
}

/**
 * 查询训练状态响应
 */
export interface TrainingStatusResponse {
  code: number;
  message: string;
  data?: {
    status: number; // 对应 TrainingStatusCode
    error_msg?: string;
    [key: string]: unknown;
  };
}

/**
 * 合成语音响应
 */
export interface SynthesizeSpeechResponse {
  code: number;
  message: string;
  data?: {
    audio_url?: string;
    audio_base64?: string;
    [key: string]: unknown;
  };
}

/**
 * 用户声音合规确认状态
 */
export interface ComplianceConfirmation {
  user_id: string;
  voice_profile_id: string;
  confirmed_at: Date;
  ip_address?: string;
  user_agent?: string;
}

/**
 * 火山引擎声音克隆服务
 */
export class VoiceCloneService {
  private readonly apiToken: string;
  private readonly resourceId: string = 'volc.megatts.voiceclone';
  private readonly appId: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiToken = process.env.VOICE_CLONE_API_TOKEN || '';
    this.appId = process.env.VOICE_CLONE_APP_ID || '';
    this.baseUrl = VOICE_CLONE_BASE_URL;

    if (!this.apiToken || !this.appId) {
      throw new Error('VOICE_CLONE_API_TOKEN 和 VOICE_CLONE_APP_ID 环境变量未设置');
    }
  }

  /**
   * 上传训练音频
   * @param userId 用户ID
   * @param audioBuffer 音频二进制数据
   * @param audioFormat 音频格式 (如: 'wav', 'mp3', 'pcm')
   * @param profileName 声音档案名称
   * @returns 返回火山引擎的speaker_id
   */
  async uploadTrainAudio(
    userId: string,
    audioBuffer: Buffer,
    audioFormat: string,
    profileName: string
  ): Promise<{ speakerId: string; voiceProfileId: string }> {
    // 验证参数
    if (!userId) {
      throw new BadRequestError('用户ID不能为空');
    }
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new BadRequestError('音频数据不能为空');
    }
    if (!audioFormat) {
      throw new BadRequestError('音频格式不能为空');
    }
    if (!profileName) {
      throw new BadRequestError('声音档案名称不能为空');
    }

    // 检查用户是否已有活跃的voice profile
    const existingProfile = await prisma.voiceProfile.findFirst({
      where: {
        user_id: userId,
        is_trained: false, // 只检查未完成训练的档案（活跃档案）
      },
    });

    if (existingProfile) {
      throw new ConflictError('用户已有一个活跃的声音档案，请完成或删除后再上传');
    }
 
       // 删除之前未完成的档案（如果有的话）
       await prisma.voiceProfile.deleteMany({
         where: {
           user_id: userId,
           is_active: true,
           is_trained: false,
         },
       });

    // 将音频转为base64
    const audioBase64 = audioBuffer.toString('base64');

    // 调用火山引擎API
    const url = `${this.baseUrl}/audio/upload`;
    const requestBody = {
      appid: this.appId,
      speaker_id: `user_${userId}_${Date.now()}`, // 生成唯一的speaker_id
      audios: [
        {
          audio_bytes: audioBase64,
          audio_format: audioFormat,
        },
      ],
      source: 2, // 用户上传的音频
      language: 0, // 自动检测语言
      model_type: 1, // 模型类型
    };

    try {
      const response = await this.requestWithRetry<UploadAudioResponse>(url, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (response.code !== 0) {
        throw new BadRequestError(`火山引擎API错误: ${response.message}`);
      }

      if (!response.data?.speaker_id) {
        throw new InternalServerError('火山引擎返回的speaker_id为空');
      }

      const speakerId = response.data.speaker_id;

      // 在数据库中创建voice profile
      const voiceProfile = await prisma.voiceProfile.create({
        data: {
          user_id: userId,
          profile_name: profileName,
          voice_id: speakerId,
          sample_audio_url: '', // 暂时留空，后续可以保存到OSS
          training_status: 'training',
          is_trained: false,
           is_active: true,
        },
      });

      return {
        speakerId,
        voiceProfileId: voiceProfile.id,
      };
    } catch (error) {
      if (error instanceof (BadRequestError || ConflictError)) {
        throw error;
      }
      throw new InternalServerError(
        `火山引擎API请求失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 查询训练状态
   * @param voiceProfileId 声音档案ID
   * @returns 返回训练状态
   */
  async getTrainingStatus(voiceProfileId: string): Promise<{
    status: string;
    statusCode: TrainingStatusCode;
    errorMessage?: string;
  }> {
    if (!voiceProfileId) {
      throw new BadRequestError('声音档案ID不能为空');
    }

    // 从数据库获取voice profile
    const voiceProfile = await prisma.voiceProfile.findUnique({
      where: { id: voiceProfileId },
    });

    if (!voiceProfile) {
      throw new NotFoundError('声音档案不存在');
    }

    if (!voiceProfile.voice_id) {
      throw new BadRequestError('声音档案缺少speaker_id');
    }

    // 调用火山引擎API查询状态
    const url = `${this.baseUrl}/status`;
    const requestBody = {
      appid: this.appId,
      speaker_id: voiceProfile.voice_id,
    };

    try {
      const response = await this.requestWithRetry<TrainingStatusResponse>(url, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (response.code !== 0) {
        throw new BadRequestError(`查询训练状态失败: ${response.message}`);
      }

      if (!response.data || typeof response.data.status !== 'number') {
        throw new InternalServerError('火山引擎返回的状态码格式不正确');
      }

      const statusCode = response.data.status as TrainingStatusCode;
      const statusStr = TRAINING_STATUS_MAP[statusCode] || 'unknown';
      const isCompleted = statusCode === TrainingStatusCode.COMPLETED;
      const isFailed = statusCode === TrainingStatusCode.FAILED;

      // 更新数据库中的训练状态
      await prisma.voiceProfile.update({
        where: { id: voiceProfileId },
        data: {
          training_status: statusStr,
          is_trained: isCompleted,
          error_message: isFailed ? response.data.error_msg : null,
        },
      });

      return {
        status: statusStr,
        statusCode,
        errorMessage: response.data.error_msg,
      };
    } catch (error) {
      if (error instanceof (BadRequestError || NotFoundError)) {
        throw error;
      }
      throw new InternalServerError(
        `火山引擎API请求失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 合成语音（需要先确认合规，且训练完成）
   * @param userId 用户ID
   * @param voiceProfileId 声音档案ID
   * @param text 要合成的文本
   * @param complianceConfirmed 是否已确认合规
   * @returns 返回识别的音频URL或base64
   */
  async synthesizeSpeech(
    userId: string,
    voiceProfileId: string,
    text: string,
    complianceConfirmed: boolean = false
  ): Promise<{
    audioUrl?: string;
    audioBase64?: string;
  }> {
    // 验证参数
    if (!userId) {
      throw new BadRequestError('用户ID不能为空');
    }
    if (!voiceProfileId) {
      throw new BadRequestError('声音档案ID不能为空');
    }
    if (!text || text.trim().length === 0) {
      throw new BadRequestError('合成文本不能为空');
    }

    // 检查合规确认
    if (!complianceConfirmed) {
      throw new BadRequestError('使用声音克隆功能需要先确认"本人声音/合法使用"');
    }

    // 验证是否有有效的合规确认记录（可选：可以在Redis中存储确认状态）
    // 这里暂时只做参数检查

    // 查询voice profile
    const voiceProfile = await prisma.voiceProfile.findUnique({
      where: { id: voiceProfileId },
      include: { user: true },
    });

    if (!voiceProfile) {
      throw new NotFoundError('声音档案不存在');
    }

    // 验证所有权
    if (voiceProfile.user_id !== userId) {
      throw new BadRequestError('您没有权限使用此声音档案');
    }

    // 检查训练是否已完成
    if (!voiceProfile.is_trained || voiceProfile.training_status !== 'completed') {
      throw new BadRequestError('声音档案还未完成训练，无法合成语音');
    }

    if (!voiceProfile.voice_id) {
      throw new BadRequestError('声音档案缺少speaker_id');
    }

    // 验证字数限制（根据实际需求调整）
    const textLength = text.length;
    if (textLength > 500) {
      throw new BadRequestError('合成文本长度不能超过500字');
    }

    // 调用火山引擎API合成语音
    const url = `${this.baseUrl}/synthesize`;
    const requestBody = {
      appid: this.appId,
      speaker_id: voiceProfile.voice_id,
      text,
      language: 0, // 自动检测语言
      audio_format: 'mp3', // 输出格式
    };

    try {
      const response = await this.requestWithRetry<SynthesizeSpeechResponse>(url, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (response.code !== 0) {
        throw new BadRequestError(`合成语音失败: ${response.message}`);
      }

      if (!response.data?.audio_url && !response.data?.audio_base64) {
        throw new InternalServerError('火山引擎返回的音频数据为空');
      }

      return {
        audioUrl: response.data.audio_url,
        audioBase64: response.data.audio_base64,
      };
    } catch (error) {
      if (error instanceof (BadRequestError || NotFoundError)) {
        throw error;
      }
      throw new InternalServerError(
        `火山引擎API请求失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 获取用户的声音档案
   */
  async getUserVoiceProfiles(userId: string) {
    if (!userId) {
      throw new BadRequestError('用户ID不能为空');
    }

    return await prisma.voiceProfile.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        profile_name: true,
        voice_id: true,
        voice_description: true,
        is_trained: true,
        training_status: true,
        error_message: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * 删除声音档案
   */
  async deleteVoiceProfile(userId: string, voiceProfileId: string): Promise<void> {
    if (!userId) {
      throw new BadRequestError('用户ID不能为空');
    }
    if (!voiceProfileId) {
      throw new BadRequestError('声音档案ID不能为空');
    }

    // 验证所有权
    const voiceProfile = await prisma.voiceProfile.findUnique({
      where: { id: voiceProfileId },
    });

    if (!voiceProfile) {
      throw new NotFoundError('声音档案不存在');
    }

    if (voiceProfile.user_id !== userId) {
      throw new BadRequestError('您没有权限删除此声音档案');
    }

    // 删除相关的任务记录
    await prisma.generationTask.deleteMany({
      where: { voice_profile_id: voiceProfileId },
    });

    // 删除声音档案
    await prisma.voiceProfile.delete({
      where: { id: voiceProfileId },
    });
  }

  /**
   * 记录用户的合规确认
   * @param userId 用户ID
   * @param voiceProfileId 声音档案ID
   * @param ipAddress 用户IP地址
   * @param userAgent 用户Agent
   */
  async recordComplianceConfirmation(
    userId: string,
    voiceProfileId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ComplianceConfirmation> {
    if (!userId) {
      throw new BadRequestError('用户ID不能为空');
    }
    if (!voiceProfileId) {
      throw new BadRequestError('声音档案ID不能为空');
    }

    // 验证voice profile存在性
    const voiceProfile = await prisma.voiceProfile.findUnique({
      where: { id: voiceProfileId },
    });

    if (!voiceProfile) {
      throw new NotFoundError('声音档案不存在');
    }

    if (voiceProfile.user_id !== userId) {
      throw new BadRequestError('您没有权限操作此声音档案');
    }

    // 这里可以将确认记录存储到Redis（带过期时间）或数据库
    // 示例：使用内存存储，实际应该使用Redis持久化
    const confirmation: ComplianceConfirmation = {
      user_id: userId,
      voice_profile_id: voiceProfileId,
      confirmed_at: new Date(),
      ip_address: ipAddress,
      user_agent: userAgent,
    };

    // 可选：在数据库或Redis中记录
    // 这里暂时返回确认对象，实际应该存储到Redis

    return confirmation;
  }

  /**
   * 带重试机制的请求方法
   */
  private async requestWithRetry<T>(
    url: string,
    options: RequestInit,
    retryCount = 0
  ): Promise<T> {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`,
          'Resource-Id': this.resourceId,
          ...options.headers,
        },
      });

      // 处理响应
      const data = (await response.json()) as {
        code?: number;
        message?: string;
        error?: {
          message?: string;
          code?: string | number;
        };
      };

      if (!response.ok) {
        const errorMessage = data.message || data.error?.message || '请求失败';

        // 如果是客户端错误（4xx），不重试
        if (response.status >= 400 && response.status < 500) {
          throw new BadRequestError(`火山引擎API错误: ${errorMessage}`);
        }

        // 服务器错误（5xx）或其他错误，可以重试
        throw new Error(`火山引擎API错误: ${errorMessage}`);
      }

      return data as T;
    } catch (error) {
      // 如果是 BadRequestError，直接抛出，不重试
      if (error instanceof BadRequestError) {
        throw error;
      }

      // 达到最大重试次数
      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        throw new InternalServerError(
          `火山引擎API请求失败（已重试${MAX_RETRY_ATTEMPTS}次）: ${
            error instanceof Error ? error.message : '未知错误'
          }`
        );
      }

      // 延迟后重试
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return this.requestWithRetry<T>(url, options, retryCount + 1);
    }
  }
}

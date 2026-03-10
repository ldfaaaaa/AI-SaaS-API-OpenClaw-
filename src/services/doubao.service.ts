import { InternalServerError, BadRequestError } from '../utils/errors';

/**
 * 豆包API配置
 */
const DOUBAO_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

/**
 * 图像生成参数
 */
export interface ImageGenerationParams {
  model: string; // 模型名称
  prompt: string; // 文本描述
  n?: number; // 生成图片数量，默认1
  size?: string; // 图片尺寸，如 "1024x1024"
  quality?: string; // 图片质量，如 "standard" 或 "hd"
  response_format?: 'url' | 'b64_json'; // 返回格式
  image?: string; // 可选：图生图的base64图片数据
}

/**
 * 视频生成参数
 */
export interface VideoGenerationParams {
  model: string; // 模型名称
  prompt: string; // 文本描述
  image?: string; // 可选：参考图片的base64数据
  duration?: number; // 视频时长（秒）
  aspect_ratio?: string; // 宽高比，如 "16:9"
}

/**
 * 图像生成响应
 */
export interface ImageGenerationResponse {
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
}

/**
 * 视频生成任务响应
 */
export interface VideoTaskResponse {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: number;
}

/**
 * Chat消息
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Chat完成参数
 */
export interface ChatCompletionParams {
  model: string; // 模型名称，如 doubao-pro-32k
  messages: ChatMessage[]; // 对话消息列表
  temperature?: number; // 0-1，控制随机性
  max_tokens?: number; // 最大生成token数
  top_p?: number; // 0-1，核采样
}

/**
 * Chat完成响应
 */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 任务状态响应
 */
export interface TaskStatusResponse {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number; // 进度百分比 0-100
  result?: {
    video_url?: string;
    thumbnail_url?: string;
    duration?: number;
  };
  error?: {
    code: string;
    message: string;
  };
  created_at: number;
  updated_at: number;
}

/**
 * 豆包API服务类
 */
export class DoubaoService {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.DOUBAO_API_KEY || '';
    this.baseUrl = DOUBAO_BASE_URL;

    if (!this.apiKey) {
      throw new Error('DOUBAO_API_KEY 环境变量未设置');
    }
  }

  /**
   * 生成图像（支持文生图和图生图）
   */
  async generateImage(params: ImageGenerationParams): Promise<ImageGenerationResponse> {
    this.validateImageParams(params);

    const url = `${this.baseUrl}/images/generations`;
    const body = {
      model: params.model,
      prompt: params.prompt,
      n: params.n || 1,
      size: params.size || '1024x1024',
      quality: params.quality || 'standard',
      response_format: params.response_format || 'url',
      ...(params.image && { image: params.image }), // 图生图：传入base64图片
    };

    return this.requestWithRetry<ImageGenerationResponse>(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * 生成视频（异步任务）
   */
  async generateVideo(params: VideoGenerationParams): Promise<VideoTaskResponse> {
    this.validateVideoParams(params);

    const url = `${this.baseUrl}/contents/generations/tasks`;
    const body = {
      model: params.model,
      prompt: params.prompt,
      ...(params.image && { image: params.image }),
      ...(params.duration && { duration: params.duration }),
      ...(params.aspect_ratio && { aspect_ratio: params.aspect_ratio }),
    };

    return this.requestWithRetry<VideoTaskResponse>(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * 查询视频生成任务状态
   */
  async getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    if (!taskId) {
      throw new BadRequestError('任务ID不能为空');
    }

    const url = `${this.baseUrl}/contents/generations/tasks/${taskId}`;

    return this.requestWithRetry<TaskStatusResponse>(url, {
      method: 'GET',
    });
  }

  /**
   * Chat完成（LLM文本生成）
   */
  async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    this.validateChatParams(params);

    const url = `${this.baseUrl}/chat/completions`;
    const body = {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.max_tokens,
      top_p: params.top_p,
    };

    return this.requestWithRetry<ChatCompletionResponse>(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * 简化的文本生成接口（单轮对话）
   */
  async generateText(prompt: string, systemPrompt?: string, model?: string): Promise<string> {
    const messages: ChatMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const response = await this.chatCompletion({
      model: model || process.env.DOUBAO_CHAT_MODEL || 'doubao-pro-32k',
      messages,
      temperature: 0.7,
    });

    return response.choices[0]?.message.content || '';
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
          'Authorization': `Bearer ${this.apiKey}`,
          ...options.headers,
        },
      });

      // 处理响应
      const data = (await response.json()) as {
        error?: {
          message?: string;
          code?: string | number;
        };
        message?: string;
      };

      if (!response.ok) {
        const errorMessage = data.error?.message || data.message || '请求失败';
        const errorCode = data.error?.code || response.status;

        // 如果是客户端错误（4xx），不重试
        if (response.status >= 400 && response.status < 500) {
          throw new BadRequestError(`豆包API错误: ${errorMessage} (code: ${errorCode})`);
        }

        // 服务器错误（5xx）或其他错误，可以重试
        throw new Error(`豆包API错误: ${errorMessage} (code: ${errorCode})`);
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
          `豆包API请求失败（已重试${MAX_RETRY_ATTEMPTS}次）: ${
            error instanceof Error ? error.message : '未知错误'
          }`
        );
      }

      // 等待后重试
      await this.delay(RETRY_DELAY_MS * (retryCount + 1)); // 递增延迟
      return this.requestWithRetry<T>(url, options, retryCount + 1);
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 验证图像生成参数
   */
  private validateImageParams(params: ImageGenerationParams): void {
    if (!params.model) {
      throw new BadRequestError('model 参数不能为空');
    }
    if (!params.prompt) {
      throw new BadRequestError('prompt 参数不能为空');
    }
    if (params.n && (params.n < 1 || params.n > 10)) {
      throw new BadRequestError('n 参数必须在 1-10 之间');
    }
  }

  /**
   * 验证视频生成参数
   */
  private validateVideoParams(params: VideoGenerationParams): void {
    if (!params.model) {
      throw new BadRequestError('model 参数不能为空');
    }
    if (!params.prompt) {
      throw new BadRequestError('prompt 参数不能为空');
    }
    if (params.duration && (params.duration < 1 || params.duration > 60)) {
      throw new BadRequestError('duration 参数必须在 1-60 秒之间');
    }
  }

  /**
   * 验证Chat参数
   */
  private validateChatParams(params: ChatCompletionParams): void {
    if (!params.model) {
      throw new BadRequestError('model 参数不能为空');
    }
    if (!params.messages || params.messages.length === 0) {
      throw new BadRequestError('messages 参数不能为空');
    }
    if (params.temperature !== undefined && (params.temperature < 0 || params.temperature > 1)) {
      throw new BadRequestError('temperature 参数必须在 0-1 之间');
    }
  }
}

// 导出单例实例
export const doubaoService = new DoubaoService();

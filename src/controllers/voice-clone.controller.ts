import type { FastifyRequest, FastifyReply } from 'fastify';
import { VoiceCloneService } from '../services/voice-clone.service';
import { synthesizeSpeechSchema, confirmComplianceSchema } from '../schemas/voice-clone.schema';
import { BadRequestError } from '../utils/errors';

export class VoiceCloneController {
  private voiceCloneService: VoiceCloneService;

  constructor() {
    this.voiceCloneService = new VoiceCloneService();
  }

  /**
   * 上传训练音频
   * POST /api/v1/voice-clone/upload
   * 请求体: { profileName: string, audioFormat: string, audioBase64: string }
   */
  async uploadTrainAudio(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user?.id as string;
      if (!userId) {
        throw new BadRequestError('用户未认证');
      }

      // 验证请求体
      const body = request.body as Record<string, unknown>;
      const profileName = body.profileName as unknown;
      const audioFormat = body.audioFormat as unknown;
      const audioBase64 = body.audioBase64 as unknown;

      if (typeof profileName !== 'string' || !profileName) {
        throw new BadRequestError('声音档案名称不能为空');
      }
      if (typeof audioFormat !== 'string' || !audioFormat) {
        throw new BadRequestError('音频格式不能为空');
      }
      if (typeof audioBase64 !== 'string' || !audioBase64) {
        throw new BadRequestError('音频数据不能为空（应为base64格式）');
      }

      // 将base64转换为Buffer
      let audioBuffer: Buffer;
      try {
        audioBuffer = Buffer.from(audioBase64, 'base64');
      } catch (error) {
        throw new BadRequestError('音频数据格式不正确（应为有效的base64字符串）');
      }

      // 调用服务
      const result = await this.voiceCloneService.uploadTrainAudio(
        userId,
        audioBuffer,
        audioFormat,
        profileName
      );

      reply.code(201).send({
        success: true,
        data: {
          voiceProfileId: result.voiceProfileId,
          speakerId: result.speakerId,
          message: '音频已上传，训练进行中',
        },
        message: '上传成功',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * 查询训练状态
   * GET /api/v1/voice-clone/:voiceProfileId/status
   */
  async getTrainingStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user?.id as string;
      if (!userId) {
        throw new BadRequestError('用户未认证');
      }

      const voiceProfileId = (request.params as Record<string, string>).voiceProfileId;

      const result = await this.voiceCloneService.getTrainingStatus(voiceProfileId);

      reply.send({
        success: true,
        data: {
          status: result.status,
          statusCode: result.statusCode,
          errorMessage: result.errorMessage || null,
        },
        message: '查询成功',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * 合成语音
   * POST /api/v1/voice-clone/synthesize
   */
  async synthesizeSpeech(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user?.id as string;
      if (!userId) {
        throw new BadRequestError('用户未认证');
      }

      // 验证请求体
      const validated = synthesizeSpeechSchema.parse({
        body: request.body,
      });

      const { voiceProfileId, text, complianceConfirmed } = validated.body;

      const result = await this.voiceCloneService.synthesizeSpeech(
        userId,
        voiceProfileId,
        text,
        complianceConfirmed
      );

      reply.send({
        success: true,
        data: {
          audioUrl: result.audioUrl,
          audioBase64: result.audioBase64,
        },
        message: '语音合成成功',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取用户的声音档案列表
   * GET /api/v1/voice-clone/profiles
   */
  async getUserVoiceProfiles(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user?.id as string;
      if (!userId) {
        throw new BadRequestError('用户未认证');
      }

      const profiles = await this.voiceCloneService.getUserVoiceProfiles(userId);

      reply.send({
        success: true,
        data: {
          profiles,
          total: profiles.length,
        },
        message: '获取成功',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * 删除声音档案
   * DELETE /api/v1/voice-clone/:voiceProfileId
   */
  async deleteVoiceProfile(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user?.id as string;
      if (!userId) {
        throw new BadRequestError('用户未认证');
      }

      const voiceProfileId = (request.params as Record<string, string>).voiceProfileId;

      await this.voiceCloneService.deleteVoiceProfile(userId, voiceProfileId);

      reply.send({
        success: true,
        data: null,
        message: '删除成功',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * 合规确认
   * POST /api/v1/voice-clone/:voiceProfileId/compliance-confirm
   */
  async confirmCompliance(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user?.id as string;
      if (!userId) {
        throw new BadRequestError('用户未认证');
      }

      // 验证请求体
      const validated = confirmComplianceSchema.parse({
        body: request.body,
      });

      const voiceProfileId = (request.params as Record<string, string>).voiceProfileId;
   // validated 用于检查body中的confirmed字段
   if (!validated.body.confirmed) {
     throw new BadRequestError('必须确认"本人声音/合法使用"');
   }

      // 获取请求者的IP和User-Agent
      const ipAddress = request.ip;
      const userAgent = request.headers['user-agent'];

      const confirmation = await this.voiceCloneService.recordComplianceConfirmation(
        userId,
        voiceProfileId,
        ipAddress,
        userAgent
      );

      reply.send({
        success: true,
        data: {
          confirmed: true,
          confirmedAt: confirmation.confirmed_at,
        },
        message: '合规确认已记录，您现在可以使用声音克隆功能',
      });
    } catch (error) {
      throw error;
    }
  }
}

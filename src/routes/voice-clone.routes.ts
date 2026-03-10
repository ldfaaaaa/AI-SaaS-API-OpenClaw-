import type { FastifyInstance } from 'fastify';
import { VoiceCloneController } from '../controllers/voice-clone.controller';
 import { authenticate } from '../middlewares/auth';

export async function voiceCloneRoutes(app: FastifyInstance): Promise<void> {
  const voiceCloneController = new VoiceCloneController();

  // 合规确认 - POST /api/v1/voice-clone/:voiceProfileId/compliance-confirm
  app.post(
    '/api/v1/voice-clone/:voiceProfileId/compliance-confirm',
    {
   onRequest: [authenticate], // 需要认证
      schema: {
        description: '用户确认"本人声音/合法使用"',
        tags: ['VoiceClone'],
        params: {
          type: 'object',
          properties: {
            voiceProfileId: { type: 'string', description: '声音档案ID' },
          },
          required: ['voiceProfileId'],
        },
        body: {
          type: 'object',
          properties: {
            confirmed: { type: 'boolean', description: '是否确认' },
          },
          required: ['confirmed'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  confirmed: { type: 'boolean' },
                  confirmedAt: { type: 'string', format: 'date-time' },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    (request, reply) => voiceCloneController.confirmCompliance(request, reply)
  );

  // 上传训练音频 - POST /api/v1/voice-clone/upload
  app.post(
    '/api/v1/voice-clone/upload',
    {
   onRequest: [authenticate], // 需要认证
      schema: {
        description: '上传训练音频',
        tags: ['VoiceClone'],
        consumes: ['multipart/form-data'],
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  voiceProfileId: { type: 'string' },
                  speakerId: { type: 'string' },
                  message: { type: 'string' },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    (request, reply) => voiceCloneController.uploadTrainAudio(request, reply)
  );

  // 查询训练状态 - GET /api/v1/voice-clone/:voiceProfileId/status
  app.get(
    '/api/v1/voice-clone/:voiceProfileId/status',
    {
   onRequest: [authenticate], // 需要认证
      schema: {
        description: '查询声音档案的训练状态',
        tags: ['VoiceClone'],
        params: {
          type: 'object',
          properties: {
            voiceProfileId: { type: 'string', description: '声音档案ID' },
          },
          required: ['voiceProfileId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    enum: ['pending', 'training', 'completed', 'failed'],
                  },
                  statusCode: { type: 'number' },
                  errorMessage: { type: ['string', 'null'] },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    (request, reply) => voiceCloneController.getTrainingStatus(request, reply)
  );

  // 合成语音 - POST /api/v1/voice-clone/synthesize
  app.post(
    '/api/v1/voice-clone/synthesize',
    {
   onRequest: [authenticate], // 需要认证
      schema: {
        description: '使用克隆音色合成语音',
        tags: ['VoiceClone'],
        body: {
          type: 'object',
          properties: {
            voiceProfileId: { type: 'string', description: '声音档案ID' },
            text: { type: 'string', description: '要合成的文本', maxLength: 500 },
            complianceConfirmed: { type: 'boolean', description: '是否已确认合规' },
          },
          required: ['voiceProfileId', 'text', 'complianceConfirmed'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  audioUrl: { type: ['string', 'null'] },
                  audioBase64: { type: ['string', 'null'] },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    (request, reply) => voiceCloneController.synthesizeSpeech(request, reply)
  );

  // 获取用户声音档案列表 - GET /api/v1/voice-clone/profiles
  app.get(
    '/api/v1/voice-clone/profiles',
    {
   onRequest: [authenticate], // 需要认证
      schema: {
        description: '获取当前用户的所有声音档案',
        tags: ['VoiceClone'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  profiles: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        profile_name: { type: 'string' },
                        voice_id: { type: ['string', 'null'] },
                        voice_description: { type: ['string', 'null'] },
                        is_trained: { type: 'boolean' },
                        training_status: { type: 'string' },
                        error_message: { type: ['string', 'null'] },
                        created_at: { type: 'string', format: 'date-time' },
                        updated_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                  total: { type: 'number' },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    (request, reply) => voiceCloneController.getUserVoiceProfiles(request, reply)
  );

  // 删除声音档案 - DELETE /api/v1/voice-clone/:voiceProfileId
  app.delete(
    '/api/v1/voice-clone/:voiceProfileId',
    {
   onRequest: [authenticate], // 需要认证
      schema: {
        description: '删除声音档案',
        tags: ['VoiceClone'],
        params: {
          type: 'object',
          properties: {
            voiceProfileId: { type: 'string', description: '声音档案ID' },
          },
          required: ['voiceProfileId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'null' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    (request, reply) => voiceCloneController.deleteVoiceProfile(request, reply)
  );
}

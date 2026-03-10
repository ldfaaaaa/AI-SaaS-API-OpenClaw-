import type { FastifyInstance } from 'fastify';
import { contentAssistantController } from '../controllers/content-assistant.controller';
import { authenticate } from '../middlewares/auth';
import {
  generateMarketingPackageSchema,
  generateVoiceoverScriptSchema,
  getWorkflowStatusSchema,
  cancelWorkflowSchema,
  getContentPackageSchema,
  getUserContentPackagesSchema,
} from '../schemas/content-assistant.schema';

/**
 * OpenClaw 内容助手路由
 */
export async function contentAssistantRoutes(app: FastifyInstance): Promise<void> {
  // 生成营销内容包
  app.post(
    '/api/v1/content-assistant/marketing-package',
    {
      onRequest: [authenticate],
      schema: {
        description: '生成营销内容包（小红书标题、正文、标签、朋友圈文案）',
        tags: ['ContentAssistant'],
        body: {
          type: 'object',
          properties: {
            imageUrls: {
              type: 'array',
              items: { type: 'string', format: 'uri' },
              minItems: 1,
              maxItems: 10,
              description: '效果图URL列表',
            },
            projectDescription: {
              type: 'object',
              properties: {
                style: { type: 'string', description: '设计风格' },
                area: { type: 'string', description: '面积' },
                budget: { type: 'string', description: '预算' },
                otherInfo: { type: 'string', description: '其他信息' },
              },
            },
          },
          required: ['imageUrls', 'projectDescription'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  workflowId: { type: 'string', description: '工作流ID' },
                  contentPackageId: { type: 'string', description: '内容包ID' },
                  message: { type: 'string' },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => contentAssistantController.generateMarketingPackage(request, reply)
  );

  // 生成配音解说脚本
  app.post(
    '/api/v1/content-assistant/voiceover-script',
    {
      onRequest: [authenticate],
      schema: {
        description: '生成配音解说脚本（文案、字幕、音频）',
        tags: ['ContentAssistant'],
        body: {
          type: 'object',
          properties: {
            imageUrl: { type: 'string', format: 'uri', description: '效果图URL' },
            styleDescription: { type: 'string', description: '风格描述' },
            voiceProfileId: { type: 'string', description: '声音档案ID（可选）' },
          },
          required: ['imageUrl'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  workflowId: { type: 'string', description: '工作流ID' },
                  contentPackageId: { type: 'string', description: '内容包ID' },
                  message: { type: 'string' },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => contentAssistantController.generateVoiceoverScript(request, reply)
  );

  // 获取工作流状态
  app.get(
    '/api/v1/content-assistant/workflow/:workflowId',
    {
      onRequest: [authenticate],
      schema: {
        description: '获取工作流执行状态和进度',
        tags: ['ContentAssistant'],
        params: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', description: '工作流ID' },
          },
          required: ['workflowId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  workflowType: { type: 'string' },
                  status: { type: 'string' },
                  totalSteps: { type: 'number' },
                  completedSteps: { type: 'number' },
                  currentStep: { type: ['string', 'null'] },
                  progress: { type: 'number' },
                  errorMessage: { type: ['string', 'null'] },
                  startedAt: { type: ['string', 'null'], format: 'date-time' },
                  completedAt: { type: ['string', 'null'], format: 'date-time' },
                  steps: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        order: { type: 'number' },
                        status: { type: 'string' },
                        startedAt: { type: ['string', 'null'], format: 'date-time' },
                        completedAt: { type: ['string', 'null'], format: 'date-time' },
                        errorMessage: { type: ['string', 'null'] },
                      },
                    },
                  },
                  contentPackage: { type: ['object', 'null'] },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => contentAssistantController.getWorkflowStatus(request, reply)
  );

  // 取消工作流
  app.post(
    '/api/v1/content-assistant/workflow/:workflowId/cancel',
    {
      onRequest: [authenticate],
      schema: {
        description: '取消正在执行的工作流',
        tags: ['ContentAssistant'],
        params: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', description: '工作流ID' },
          },
          required: ['workflowId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => contentAssistantController.cancelWorkflow(request, reply)
  );

  // 获取内容包详情
  app.get(
    '/api/v1/content-assistant/package/:packageId',
    {
      onRequest: [authenticate],
      schema: {
        description: '获取内容包详情和结果',
        tags: ['ContentAssistant'],
        params: {
          type: 'object',
          properties: {
            packageId: { type: 'string', description: '内容包ID' },
          },
          required: ['packageId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  packageName: { type: 'string' },
                  packageType: { type: 'string' },
                  description: { type: ['string', 'null'] },
                  assets: { type: ['object', 'null'] },
                  resultData: { type: ['object', 'null'] },
                  resultZipUrl: { type: ['string', 'null'] },
                  workflow: { type: ['object', 'null'] },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => contentAssistantController.getContentPackage(request, reply)
  );

  // 获取用户内容包列表
  app.get(
    '/api/v1/content-assistant/packages',
    {
      onRequest: [authenticate],
      schema: {
        description: '获取用户的内容包列表',
        tags: ['ContentAssistant'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number', minimum: 1, default: 1, description: '页码' },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 20, description: '每页数量' },
            packageType: { type: 'string', enum: ['marketing', 'voiceover', 'all'], default: 'all', description: '内容包类型' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  packages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        packageName: { type: 'string' },
                        packageType: { type: 'string' },
                        description: { type: ['string', 'null'] },
                        resultZipUrl: { type: ['string', 'null'] },
                        workflow: { type: ['object', 'null'] },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                  pagination: {
                    type: 'object',
                    properties: {
                      page: { type: 'number' },
                      limit: { type: 'number' },
                      total: { type: 'number' },
                      totalPages: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => contentAssistantController.getUserContentPackages(request, reply)
  );
}

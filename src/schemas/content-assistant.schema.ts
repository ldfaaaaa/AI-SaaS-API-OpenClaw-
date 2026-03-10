import { z } from 'zod';

/**
 * 生成营销内容包Schema
 */
export const generateMarketingPackageSchema = z.object({
  body: z.object({
    imageUrls: z.array(z.string().url('图片URL格式不正确')).min(1, '至少需要提供一张效果图').max(10, '最多支持10张图片'),
    projectDescription: z.object({
      style: z.string().max(100, '风格描述不能超过100字').optional(),
      area: z.string().max(50, '面积描述不能超过50字').optional(),
      budget: z.string().max(50, '预算描述不能超过50字').optional(),
      otherInfo: z.string().max(500, '其他信息不能超过500字').optional(),
    }),
  }),
});

export type GenerateMarketingPackageInput = z.infer<typeof generateMarketingPackageSchema>;

/**
 * 生成配音解说脚本Schema
 */
export const generateVoiceoverScriptSchema = z.object({
  body: z.object({
    imageUrl: z.string().url('图片URL格式不正确'),
    styleDescription: z.string().max(500, '风格描述不能超过500字').optional(),
    voiceProfileId: z.string().cuid('声音档案ID格式不正确').optional(),
  }),
});

export type GenerateVoiceoverScriptInput = z.infer<typeof generateVoiceoverScriptSchema>;

/**
 * 获取工作流状态Schema
 */
export const getWorkflowStatusSchema = z.object({
  params: z.object({
    workflowId: z.string().cuid('工作流ID格式不正确'),
  }),
});

export type GetWorkflowStatusInput = z.infer<typeof getWorkflowStatusSchema>;

/**
 * 取消工作流Schema
 */
export const cancelWorkflowSchema = z.object({
  params: z.object({
    workflowId: z.string().cuid('工作流ID格式不正确'),
  }),
});

export type CancelWorkflowInput = z.infer<typeof cancelWorkflowSchema>;

/**
 * 获取内容包详情Schema
 */
export const getContentPackageSchema = z.object({
  params: z.object({
    packageId: z.string().cuid('内容包ID格式不正确'),
  }),
});

export type GetContentPackageInput = z.infer<typeof getContentPackageSchema>;

/**
 * 获取用户内容包列表Schema
 */
export const getUserContentPackagesSchema = z.object({
  querystring: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    packageType: z.enum(['marketing', 'voiceover', 'all']).default('all'),
  }),
});

export type GetUserContentPackagesInput = z.infer<typeof getUserContentPackagesSchema>;

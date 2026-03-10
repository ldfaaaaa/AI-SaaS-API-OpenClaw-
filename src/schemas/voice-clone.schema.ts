import { z } from 'zod';

/**
 * 上传训练音频Schema
 */
export const uploadTrainAudioSchema = z.object({
  body: z.object({
    profileName: z.string().min(1, '声音档案名称不能为空').max(50, '声音档案名称长度不能超过50字'),
    audioFormat: z.enum(['wav', 'mp3', 'pcm', 'aac', 'flac'], {
      errorMap: () => ({ message: '不支持的音频格式' }),
    }),
    audioBase64: z.string().min(1, '音频数据不能为空'),
  }),
});

export type UploadTrainAudioInput = z.infer<typeof uploadTrainAudioSchema>;

/**
 * 查询训练状态Schema
 */
export const getTrainingStatusSchema = z.object({
  params: z.object({
    voiceProfileId: z.string().cuid('声音档案ID格式不正确'),
  }),
});

export type GetTrainingStatusInput = z.infer<typeof getTrainingStatusSchema>;

/**
 * 合成语音Schema
 */
export const synthesizeSpeechSchema = z.object({
  body: z.object({
    voiceProfileId: z.string().cuid('声音档案ID格式不正确'),
    text: z
      .string()
      .min(1, '合成文本不能为空')
      .max(500, '合成文本长度不能超过500字'),
    complianceConfirmed: z.boolean().default(false),
  }),
});

export type SynthesizeSpeechInput = z.infer<typeof synthesizeSpeechSchema>;

/**
 * 获取用户声音档案列表Schema
 */
export const getUserVoiceProfilesSchema = z.object({
  params: z.object({
    // userId在认证中间件中获取
  }),
});

export type GetUserVoiceProfilesInput = z.infer<typeof getUserVoiceProfilesSchema>;

/**
 * 删除声音档案Schema
 */
export const deleteVoiceProfileSchema = z.object({
  params: z.object({
    voiceProfileId: z.string().cuid('声音档案ID格式不正确'),
  }),
});

export type DeleteVoiceProfileInput = z.infer<typeof deleteVoiceProfileSchema>;

/**
 * 合规确认Schema
 */
export const confirmComplianceSchema = z.object({
  body: z.object({
    confirmed: z.literal(true, {
      errorMap: () => ({ message: '必须确认"本人声音/合法使用"' }),
    }),
  }),
});

export type ConfirmComplianceInput = z.infer<typeof confirmComplianceSchema>;

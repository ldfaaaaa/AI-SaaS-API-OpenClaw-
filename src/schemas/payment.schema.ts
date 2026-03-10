import { z } from 'zod';

export const createOrderSchema = z.object({
  body: z.object({
    type: z.enum([
      'recharge',
      'membership_monthly',
      'membership_quarterly',
      'membership_yearly',
      'per_use_image',
      'per_use_video',
    ]),
    amount: z.number().positive('金额必须大于0'),
  }),
});

export const orderIdParamsSchema = z.object({
  params: z.object({
    orderId: z.string().cuid('订单ID格式不正确'),
  }),
});

export const wechatCallbackSchema = z.object({
  body: z.object({
    orderId: z.string().cuid('订单ID格式不正确'),
    transactionId: z.string().min(1, '微信交易号不能为空'),
    status: z.enum(['SUCCESS', 'FAILED']),
    amount: z.number().positive('金额必须大于0').optional(),
  }),
});

export const alipayCallbackSchema = z.object({
  body: z.object({
    orderId: z.string().cuid('订单ID格式不正确'),
    tradeNo: z.string().min(1, '支付宝交易号不能为空'),
    tradeStatus: z.enum(['TRADE_SUCCESS', 'TRADE_FINISHED', 'TRADE_CLOSED']),
    totalAmount: z.number().positive('金额必须大于0').optional(),
  }),
});

export const checkAndDeductQuotaSchema = z.object({
  body: z.object({
    type: z.enum(['image', 'video']),
  }),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderIdParamsInput = z.infer<typeof orderIdParamsSchema>;
export type WechatCallbackInput = z.infer<typeof wechatCallbackSchema>;
export type AlipayCallbackInput = z.infer<typeof alipayCallbackSchema>;
export type CheckAndDeductQuotaInput = z.infer<typeof checkAndDeductQuotaSchema>;

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  alipayCallbackSchema,
  checkAndDeductQuotaSchema,
  createOrderSchema,
  orderIdParamsSchema,
  wechatCallbackSchema,
} from '../schemas/payment.schema';
import { paymentService, type OrderType } from '../services/payment.service';
import { BadRequestError } from '../utils/errors';
import { successResponse } from '../utils/response';

export class PaymentController {
  async createOrder(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user?.id as string;
    if (!userId) {
      throw new BadRequestError('用户未认证');
    }

    const parsed = createOrderSchema.safeParse({ body: request.body });
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0].message);
    }

    const order = await paymentService.createOrder(
      userId,
      parsed.data.body.type as OrderType,
      parsed.data.body.amount
    );

    return reply.code(201).send(successResponse(order, '订单创建成功'));
  }

  async wechatPay(request: FastifyRequest, reply: FastifyReply) {
    const parsed = orderIdParamsSchema.safeParse({ params: request.params });
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0].message);
    }

    const result = await paymentService.wechatPay(parsed.data.params.orderId);
    return reply.send(successResponse(result, '微信支付二维码生成成功'));
  }

  async alipayPay(request: FastifyRequest, reply: FastifyReply) {
    const parsed = orderIdParamsSchema.safeParse({ params: request.params });
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0].message);
    }

    const result = await paymentService.alipayPay(parsed.data.params.orderId);
    return reply.send(successResponse(result, '支付宝支付链接生成成功'));
  }

  async handleWechatCallback(request: FastifyRequest, reply: FastifyReply) {
    const parsed = wechatCallbackSchema.safeParse({ body: request.body });
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0].message);
    }

    const result = await paymentService.handleWechatCallback(parsed.data.body);
    return reply.send(successResponse(result, result.message));
  }

  async handleAlipayCallback(request: FastifyRequest, reply: FastifyReply) {
    const parsed = alipayCallbackSchema.safeParse({ body: request.body });
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0].message);
    }

    const result = await paymentService.handleAlipayCallback(parsed.data.body);
    return reply.send(successResponse(result, result.message));
  }

  async checkAndDeductQuota(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user?.id as string;
    if (!userId) {
      throw new BadRequestError('用户未认证');
    }

    const parsed = checkAndDeductQuotaSchema.safeParse({ body: request.body });
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0].message);
    }

    const result = await paymentService.checkAndDeductQuota(userId, parsed.data.body.type);
    return reply.send(successResponse(result, '额度检查完成'));
  }
}

import crypto from 'node:crypto';
import prisma from '../utils/prisma';
import redis from '../utils/redis';
import { BadRequestError, NotFoundError } from '../utils/errors';
import type { MembershipType, PaymentMethod, Prisma } from '@prisma/client';

export type OrderType =
  | 'recharge'
  | 'membership_monthly'
  | 'membership_quarterly'
  | 'membership_yearly'
  | 'per_use_image'
  | 'per_use_video';

type QuotaType = 'image' | 'video';

interface PaymentMeta {
  productType: string;
  productDesc: string;
}

export interface WechatCallbackPayload {
  orderId: string;
  transactionId: string;
  status: 'SUCCESS' | 'FAILED';
  amount?: number;
}

export interface AlipayCallbackPayload {
  orderId: string;
  tradeNo: string;
  tradeStatus: 'TRADE_SUCCESS' | 'TRADE_FINISHED' | 'TRADE_CLOSED';
  totalAmount?: number;
}

export class PaymentService {
  private static readonly IMAGE_PRICE = 5;
  private static readonly VIDEO_PRICE = 10;
  private static readonly MEMBERSHIP_IMAGE_DAILY_LIMIT = 20;
  private static readonly MEMBERSHIP_VIDEO_DAILY_LIMIT = 10;

  async createOrder(userId: string, type: OrderType, amount: number) {
    await this.ensureUserExists(userId);

    if (amount <= 0) {
      throw new BadRequestError('订单金额必须大于0');
    }

    this.validateOrderAmount(type, amount);

    const meta = this.getPaymentMeta(type);

    const order = await prisma.order.create({
      data: {
        user_id: userId,
        order_no: this.generateOrderNo(),
        payment_method: 'wechat',
        amount,
        product_type: meta.productType,
        product_desc: meta.productDesc,
        expired_at: this.addMinutes(new Date(), 30),
      },
    });

    return order;
  }

  async wechatPay(orderId: string) {
    const order = await this.getPendingOrder(orderId);

    await prisma.order.update({
      where: { id: orderId },
      data: {
        payment_method: 'wechat',
      },
    });

    const baseUrl = process.env.WECHAT_PAY_URL || 'https://pay.weixin.qq.com/mock/native';
    const token = this.createPayToken(order.order_no, order.amount, 'wechat');
    const qrCodeUrl = `${baseUrl}?orderNo=${encodeURIComponent(order.order_no)}&token=${token}`;

    return {
      orderId: order.id,
      orderNo: order.order_no,
      amount: order.amount,
      qrCodeUrl,
      expiresAt: order.expired_at,
    };
  }

  async alipayPay(orderId: string) {
    const order = await this.getPendingOrder(orderId);

    await prisma.order.update({
      where: { id: orderId },
      data: {
        payment_method: 'alipay',
      },
    });

    const baseUrl = process.env.ALIPAY_PAY_URL || 'https://openapi.alipay.com/gateway.do/mock/pay';
    const token = this.createPayToken(order.order_no, order.amount, 'alipay');
    const payUrl = `${baseUrl}?out_trade_no=${encodeURIComponent(order.order_no)}&token=${token}`;

    return {
      orderId: order.id,
      orderNo: order.order_no,
      amount: order.amount,
      payUrl,
      expiresAt: order.expired_at,
    };
  }

  async handleWechatCallback(payload: WechatCallbackPayload) {
    const order = await prisma.order.findUnique({
      where: { id: payload.orderId },
    });

    if (!order) {
      throw new NotFoundError('订单不存在');
    }

    if (payload.amount !== undefined && payload.amount !== order.amount) {
      throw new BadRequestError('回调金额与订单金额不一致');
    }

    if (order.payment_status === 'paid') {
      return { success: true, message: '订单已处理' };
    }

    if (payload.status !== 'SUCCESS') {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          payment_status: 'failed',
          transaction_id: payload.transactionId,
        },
      });

      return { success: false, message: '支付失败，订单已更新为失败状态' };
    }

    await this.markPaidAndApplyBenefit(order.id, payload.transactionId);
    return { success: true, message: '微信支付回调处理成功' };
  }

  async handleAlipayCallback(payload: AlipayCallbackPayload) {
    const order = await prisma.order.findUnique({
      where: { id: payload.orderId },
    });

    if (!order) {
      throw new NotFoundError('订单不存在');
    }

    if (payload.totalAmount !== undefined && payload.totalAmount !== order.amount) {
      throw new BadRequestError('回调金额与订单金额不一致');
    }

    if (order.payment_status === 'paid') {
      return { success: true, message: '订单已处理' };
    }

    if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(payload.tradeStatus)) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          payment_status: 'failed',
          transaction_id: payload.tradeNo,
        },
      });

      return { success: false, message: '支付未成功，订单已更新为失败状态' };
    }

    await this.markPaidAndApplyBenefit(order.id, payload.tradeNo);
    return { success: true, message: '支付宝回调处理成功' };
  }

  async checkAndDeductQuota(userId: string, type: QuotaType) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        balance: true,
        membership_type: true,
        membership_expires_at: true,
      },
    });

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const quotaCheck = await this.tryUseMembershipQuota(user.id, type, user.membership_type, user.membership_expires_at);
    if (quotaCheck.usedMembershipQuota) {
      return quotaCheck;
    }

    const price = this.getPerUsePrice(type);

    const updated = await prisma.$transaction(async (tx) => {
      const dbUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { balance: true },
      });

      if (!dbUser) {
        throw new NotFoundError('用户不存在');
      }

      if (dbUser.balance < price) {
        throw new BadRequestError('余额不足');
      }

      return tx.user.update({
        where: { id: user.id },
        data: { balance: { decrement: price } },
        select: { balance: true },
      });
    });

    return {
      usedMembershipQuota: false,
      deductedFromBalance: true,
      amountDeducted: price,
      balance: updated.balance,
    };
  }

  private async markPaidAndApplyBenefit(orderId: string, transactionId: string) {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundError('订单不存在');
      }

      if (order.payment_status === 'paid') {
        return;
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          payment_status: 'paid',
          transaction_id: transactionId,
          paid_at: new Date(),
        },
      });

      await this.applyOrderBenefit(tx, order.user_id, order.product_type, order.amount);
    });
  }

  private async applyOrderBenefit(
    tx: Prisma.TransactionClient,
    userId: string,
    productType: string,
    amount: number
  ) {
    if (productType === 'recharge') {
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: {
            increment: amount,
          },
        },
      });
      return;
    }

    const membershipMap: Record<string, { type: MembershipType; days: number }> = {
      membership_monthly: { type: 'monthly', days: 30 },
      membership_quarterly: { type: 'quarterly', days: 90 },
      membership_yearly: { type: 'yearly', days: 365 },
    };

    const membershipConfig = membershipMap[productType];
    if (membershipConfig) {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { membership_expires_at: true },
      });

      if (!user) {
        throw new NotFoundError('用户不存在');
      }

      const now = new Date();
      const base = user.membership_expires_at && user.membership_expires_at > now
        ? user.membership_expires_at
        : now;
      const expiresAt = this.addDays(base, membershipConfig.days);

      await tx.user.update({
        where: { id: userId },
        data: {
          membership_type: membershipConfig.type,
          membership_expires_at: expiresAt,
        },
      });
    }
  }

  private async getPendingOrder(orderId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new NotFoundError('订单不存在');
    }

    if (order.payment_status !== 'pending') {
      throw new BadRequestError('订单状态不是待支付');
    }

    if (order.expired_at && order.expired_at.getTime() < Date.now()) {
      throw new BadRequestError('订单已过期');
    }

    return order;
  }

  private validateOrderAmount(type: OrderType, amount: number) {
    const fixedAmount: Record<OrderType, number | null> = {
      recharge: null,
      membership_monthly: 29,
      membership_quarterly: 79,
      membership_yearly: 299,
      per_use_image: PaymentService.IMAGE_PRICE,
      per_use_video: PaymentService.VIDEO_PRICE,
    };

    const expected = fixedAmount[type];
    if (expected !== null && amount !== expected) {
      throw new BadRequestError(`当前商品金额应为${expected}元`);
    }
  }

  private getPaymentMeta(type: OrderType): PaymentMeta {
    const metaMap: Record<OrderType, PaymentMeta> = {
      recharge: {
        productType: 'recharge',
        productDesc: '账户充值',
      },
      membership_monthly: {
        productType: 'membership_monthly',
        productDesc: '月度会员',
      },
      membership_quarterly: {
        productType: 'membership_quarterly',
        productDesc: '季度会员',
      },
      membership_yearly: {
        productType: 'membership_yearly',
        productDesc: '年度会员',
      },
      per_use_image: {
        productType: 'per_use_image',
        productDesc: '图片按次服务',
      },
      per_use_video: {
        productType: 'per_use_video',
        productDesc: '视频按次服务',
      },
    };

    return metaMap[type];
  }

  private generateOrderNo(): string {
    const ts = Date.now();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ORD${ts}${random}`;
  }

  private createPayToken(orderNo: string, amount: number, channel: PaymentMethod): string {
    const secret = process.env.PAY_SIGN_SECRET || 'dev-pay-secret';
    return crypto
      .createHmac('sha256', secret)
      .update(`${channel}|${orderNo}|${amount}`)
      .digest('hex');
  }

  private addMinutes(date: Date, minutes: number): Date {
    const next = new Date(date);
    next.setMinutes(next.getMinutes() + minutes);
    return next;
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private getPerUsePrice(type: QuotaType): number {
    return type === 'image' ? PaymentService.IMAGE_PRICE : PaymentService.VIDEO_PRICE;
  }

  private async tryUseMembershipQuota(
    userId: string,
    type: QuotaType,
    membershipType: MembershipType,
    membershipExpiresAt: Date | null
  ) {
    if (!this.isMembershipActive(membershipType, membershipExpiresAt)) {
      return {
        usedMembershipQuota: false,
        deductedFromBalance: false,
        quotaKey: null as string | null,
        used: null as number | null,
        limit: null as number | null,
      };
    }

    const { dateStr, expireSeconds } = this.getQuotaDateAndExpireSeconds();
    const quotaKey = `quota:${userId}:${dateStr}:${type}`;
    const limit = type === 'image'
      ? PaymentService.MEMBERSHIP_IMAGE_DAILY_LIMIT
      : PaymentService.MEMBERSHIP_VIDEO_DAILY_LIMIT;

    const usedRaw = await redis.get(quotaKey);
    const used = usedRaw ? Number(usedRaw) : 0;

    if (used >= limit) {
      return {
        usedMembershipQuota: false,
        deductedFromBalance: false,
        quotaKey,
        used,
        limit,
      };
    }

    const afterUse = await redis.incr(quotaKey);
    if (afterUse === 1) {
      await redis.expire(quotaKey, expireSeconds);
    }

    return {
      usedMembershipQuota: true,
      deductedFromBalance: false,
      quotaKey,
      used: afterUse,
      limit,
    };
  }

  private isMembershipActive(membershipType: MembershipType, membershipExpiresAt: Date | null): boolean {
    return (
      membershipType !== 'none' &&
      !!membershipExpiresAt &&
      membershipExpiresAt.getTime() > Date.now()
    );
  }

  private getQuotaDateAndExpireSeconds() {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const expireSeconds = Math.max(1, Math.ceil((endOfDay.getTime() - now.getTime()) / 1000));

    return {
      dateStr,
      expireSeconds,
    };
  }

  private async ensureUserExists(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundError('用户不存在');
    }
  }
}

export const paymentService = new PaymentService();

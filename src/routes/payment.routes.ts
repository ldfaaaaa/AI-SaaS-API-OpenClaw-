import type { FastifyInstance } from 'fastify';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate } from '../middlewares/auth';

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  const paymentController = new PaymentController();

  app.post(
    '/api/v1/payments/orders',
    {
      onRequest: [authenticate],
    },
    (request, reply) => paymentController.createOrder(request, reply)
  );

  app.post(
    '/api/v1/payments/:orderId/wechat',
    {
      onRequest: [authenticate],
    },
    (request, reply) => paymentController.wechatPay(request, reply)
  );

  app.post(
    '/api/v1/payments/:orderId/alipay',
    {
      onRequest: [authenticate],
    },
    (request, reply) => paymentController.alipayPay(request, reply)
  );

  app.post('/api/v1/payments/callback/wechat', (request, reply) =>
    paymentController.handleWechatCallback(request, reply)
  );

  app.post('/api/v1/payments/callback/alipay', (request, reply) =>
    paymentController.handleAlipayCallback(request, reply)
  );

  app.post(
    '/api/v1/payments/quota/check-and-deduct',
    {
      onRequest: [authenticate],
    },
    (request, reply) => paymentController.checkAndDeductQuota(request, reply)
  );
}

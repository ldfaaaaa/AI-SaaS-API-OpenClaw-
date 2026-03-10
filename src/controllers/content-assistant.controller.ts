import type { FastifyRequest, FastifyReply } from 'fastify';
import { contentAssistantService } from '../services/content-assistant.service';
import { workflowService } from '../services/workflow.service';
import prisma from '../utils/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';
import type {
  GenerateMarketingPackageInput,
  GenerateVoiceoverScriptInput,
  GetWorkflowStatusInput,
  CancelWorkflowInput,
  GetContentPackageInput,
  GetUserContentPackagesInput,
} from '../schemas/content-assistant.schema';

/**
 * OpenClaw 内容助手控制器
 */
export class ContentAssistantController {
  /**
   * 生成营销内容包
   * POST /api/v1/content-assistant/marketing-package
   */
  async generateMarketingPackage(
    request: FastifyRequest<{ Body: GenerateMarketingPackageInput['body'] }>,
    reply: FastifyReply
  ): Promise<void> {
    const userId = request.user?.id;
    if (!userId) {
      throw new BadRequestError('用户未认证');
    }

    const result = await contentAssistantService.generateMarketingPackage(userId, request.body);

    reply.code(201).send({
      success: true,
      data: {
        workflowId: result.workflowId,
        contentPackageId: result.contentPackageId,
        message: '营销内容包生成任务已创建，请通过工作流ID查询进度',
      },
      message: '任务创建成功',
    });
  }

  /**
   * 生成配音解说脚本
   * POST /api/v1/content-assistant/voiceover-script
   */
  async generateVoiceoverScript(
    request: FastifyRequest<{ Body: GenerateVoiceoverScriptInput['body'] }>,
    reply: FastifyReply
  ): Promise<void> {
    const userId = request.user?.id;
    if (!userId) {
      throw new BadRequestError('用户未认证');
    }

    const result = await contentAssistantService.generateVoiceoverScript(userId, request.body);

    reply.code(201).send({
      success: true,
      data: {
        workflowId: result.workflowId,
        contentPackageId: result.contentPackageId,
        message: '配音解说脚本生成任务已创建，请通过工作流ID查询进度',
      },
      message: '任务创建成功',
    });
  }

  /**
   * 获取工作流状态
   * GET /api/v1/content-assistant/workflow/:workflowId
   */
  async getWorkflowStatus(
    request: FastifyRequest<{ Params: GetWorkflowStatusInput['params'] }>,
    reply: FastifyReply
  ): Promise<void> {
    const userId = request.user?.id;
    if (!userId) {
      throw new BadRequestError('用户未认证');
    }

    const { workflowId } = request.params;

    // 验证工作流所属用户
    const workflow = await prisma.workflowExecution.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new NotFoundError('工作流不存在');
    }

    if (workflow.user_id !== userId) {
      throw new NotFoundError('无权访问此工作流');
    }

    const status = await workflowService.getWorkflowStatus(workflowId);

    reply.send({
      success: true,
      data: status,
    });
  }

  /**
   * 取消工作流执行
   * POST /api/v1/content-assistant/workflow/:workflowId/cancel
   */
  async cancelWorkflow(
    request: FastifyRequest<{ Params: CancelWorkflowInput['params'] }>,
    reply: FastifyReply
  ): Promise<void> {
    const userId = request.user?.id;
    if (!userId) {
      throw new BadRequestError('用户未认证');
    }

    const { workflowId } = request.params;

    // 验证工作流所属用户
    const workflow = await prisma.workflowExecution.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new NotFoundError('工作流不存在');
    }

    if (workflow.user_id !== userId) {
      throw new NotFoundError('无权访问此工作流');
    }

    await workflowService.cancelWorkflow(workflowId);

    reply.send({
      success: true,
      message: '工作流已取消',
    });
  }

  /**
   * 获取内容包详情
   * GET /api/v1/content-assistant/package/:packageId
   */
  async getContentPackage(
    request: FastifyRequest<{ Params: GetContentPackageInput['params'] }>,
    reply: FastifyReply
  ): Promise<void> {
    const userId = request.user?.id;
    if (!userId) {
      throw new BadRequestError('用户未认证');
    }

    const { packageId } = request.params;

    const contentPackage = await prisma.contentPackage.findUnique({
      where: { id: packageId },
      include: {
        workflow_executions: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });

    if (!contentPackage) {
      throw new NotFoundError('内容包不存在');
    }

    if (contentPackage.user_id !== userId && !contentPackage.is_public) {
      throw new NotFoundError('无权访问此内容包');
    }

    reply.send({
      success: true,
      data: {
        id: contentPackage.id,
        packageName: contentPackage.package_name,
        packageType: contentPackage.package_type,
        description: contentPackage.description,
        assets: contentPackage.assets,
        resultData: contentPackage.result_data,
        resultZipUrl: contentPackage.result_zip_url,
        workflow: contentPackage.workflow_executions[0] || null,
        createdAt: contentPackage.created_at,
        updatedAt: contentPackage.updated_at,
      },
    });
  }

  /**
   * 获取用户内容包列表
   * GET /api/v1/content-assistant/packages
   */
  async getUserContentPackages(
    request: FastifyRequest<{ Querystring: GetUserContentPackagesInput['querystring'] }>,
    reply: FastifyReply
  ): Promise<void> {
    const userId = request.user?.id;
    if (!userId) {
      throw new BadRequestError('用户未认证');
    }

    const { page, limit, packageType } = request.query;
    const skip = (page - 1) * limit;

    const where: { user_id: string; package_type?: string } = {
      user_id: userId,
    };

    if (packageType !== 'all') {
      where.package_type = packageType;
    }

    const [packages, total] = await Promise.all([
      prisma.contentPackage.findMany({
        where,
        include: {
          workflow_executions: {
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.contentPackage.count({ where }),
    ]);

    reply.send({
      success: true,
      data: {
        packages: packages.map((pkg) => ({
          id: pkg.id,
          packageName: pkg.package_name,
          packageType: pkg.package_type,
          description: pkg.description,
          resultZipUrl: pkg.result_zip_url,
          workflow: pkg.workflow_executions[0] || null,
          createdAt: pkg.created_at,
          updatedAt: pkg.updated_at,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  }
}

// 导出单例
export const contentAssistantController = new ContentAssistantController();

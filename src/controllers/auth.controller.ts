import type { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth.service';
import { successResponse } from '../utils/response';
import { registerSchema, loginSchema, type RegisterDTO, type LoginDTO } from '../schemas/auth.schema';
import { BadRequestError } from '../utils/errors';


/**
 * 用户注册
 */
export async function register(
  request: FastifyRequest<{ Body: RegisterDTO }>,
  reply: FastifyReply
) {
  // 验证请求体
  const parseResult = registerSchema.safeParse(request.body);
  if (!parseResult.success) {
    throw new BadRequestError(parseResult.error.errors[0].message);
  }

  const user = await authService.register(parseResult.data);

  // 生成JWT token
  const accessToken = request.server.jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    {
      expiresIn: '7d',
    }
  );

  // 生成refresh token
  const refreshToken = request.server.jwt.sign(
    {
      id: user.id,
      type: 'refresh',
    },
    {
      expiresIn: '30d',
    }
  );

  return reply.send(
    successResponse(
      {
        user,
        accessToken,
        refreshToken,
      },
      '注册成功'
    )
  );
}

/**
 * 用户登录
 */
export async function login(
  request: FastifyRequest<{ Body: LoginDTO }>,
  reply: FastifyReply
) {
  // 验证请求体
  const parseResult = loginSchema.safeParse(request.body);
  if (!parseResult.success) {
    throw new BadRequestError(parseResult.error.errors[0].message);
  }

  const user = await authService.login(parseResult.data);

  // 生成JWT token
  const accessToken = request.server.jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    {
      expiresIn: '7d',
    }
  );

  // 生成refresh token
  const refreshToken = request.server.jwt.sign(
    {
      id: user.id,
      type: 'refresh',
    },
    {
      expiresIn: '30d',
    }
  );

  return reply.send(
    successResponse(
      {
        user,
        accessToken,
        refreshToken,
      },
      '登录成功'
    )
  );
}

/**
 * 刷新token
 */
export async function refreshToken(
  request: FastifyRequest<{ Body: { refreshToken: string } }>,
  reply: FastifyReply
) {
  const { refreshToken } = request.body;

  if (!refreshToken) {
    throw new BadRequestError('refresh token不能为空');
  }

  try {
    // 验证refresh token
    const decoded = request.server.jwt.verify<{
      id: string;
      type: string;
    }>(refreshToken);

    if (decoded.type !== 'refresh') {
      throw new BadRequestError('无效的refresh token');
    }

    // 获取用户信息
    const user = await authService.getUserById(decoded.id);

    if (!user) {
      throw new BadRequestError('用户不存在');
    }

    // 生成新的access token
    const newAccessToken = request.server.jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      {
        expiresIn: '7d',
      }
    );

    return reply.send(
      successResponse(
        {
          accessToken: newAccessToken,
        },
        'Token刷新成功'
      )
    );
  } catch (error) {
    throw new BadRequestError('无效的refresh token');
  }
}

/**
 * 获取当前用户信息
 */
export async function getMe(request: FastifyRequest, reply: FastifyReply) {
  const jwtUser = request.user as { id?: string } | undefined;

  if (!jwtUser?.id) {
    throw new BadRequestError('未找到用户信息');
  }

  const user = await authService.getUserById(jwtUser.id);

  if (!user) {
    throw new BadRequestError('用户不存在');
  }

  return reply.send(successResponse(user, '获取成功'));
}

import bcrypt from 'bcrypt';
import prisma from '../utils/prisma';
import { ConflictError, UnauthorizedError, BadRequestError } from '../utils/errors';
import type { User } from '@prisma/client';

const SALT_ROUNDS = 10;

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UserResponse {
  id: string;
  email: string;
  role: string;
  balance: number;
  membership_type: string;
  membership_expires_at: Date | null;
  created_at: Date;
}

export class AuthService {
  /**
   * 注册新用户
   */
  async register(input: RegisterInput): Promise<UserResponse> {
    const { email, password } = input;

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestError('邮箱格式不正确');
    }

    // 验证密码强度
    if (password.length < 6) {
      throw new BadRequestError('密码长度至少为6位');
    }

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError('该邮箱已被注册');
    }

    // 哈希密码
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
      },
    });

    return this.toUserResponse(user);
  }

  /**
   * 用户登录
   */
  async login(input: LoginInput): Promise<UserResponse> {
    const { email, password } = input;

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedError('邮箱或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('邮箱或密码错误');
    }

    return this.toUserResponse(user);
  }

  /**
   * 根据ID查找用户
   */
  async getUserById(id: string): Promise<UserResponse | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    return this.toUserResponse(user);
  }

  /**
   * 转换为用户响应格式（不包含敏感信息）
   */
  private toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      balance: user.balance,
      membership_type: user.membership_type,
      membership_expires_at: user.membership_expires_at,
      created_at: user.created_at,
    };
  }
}

export const authService = new AuthService();

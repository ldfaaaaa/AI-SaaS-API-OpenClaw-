export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = '请求参数错误') {
    super(400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = '未授权') {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = '禁止访问') {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = '资源不存在') {
    super(404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = '资源冲突') {
    super(409, message);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = '服务器内部错误') {
    super(500, message, false);
  }
}

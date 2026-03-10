export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
}

export function successResponse<T>(data: T, message: string = '操作成功'): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

export function errorResponse(message: string = '操作失败'): ApiResponse {
  return {
    success: false,
    message,
  };
}

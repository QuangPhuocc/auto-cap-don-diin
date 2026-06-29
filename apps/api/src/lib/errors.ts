export class AppError extends Error {
  constructor(public statusCode: number, message: string, public code = "APP_ERROR", public details?: unknown) {
    super(message);
  }
}

export const assertFound = <T>(value: T | null | undefined, message = "Không tìm thấy dữ liệu"): T => {
  if (value == null) throw new AppError(404, message, "NOT_FOUND");
  return value;
};

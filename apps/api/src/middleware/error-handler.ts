import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { AppError } from "../lib/errors.js";
import { env } from "../config/env.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(422).json({ message: "Dữ liệu không hợp lệ", code: "VALIDATION_ERROR", errors: error.flatten() });
    return;
  }
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ message: `Kích thước tệp quá lớn. Giới hạn tối đa là ${env.MAX_UPLOAD_MB}MB.`, code: "LIMIT_FILE_SIZE" });
      return;
    }
    res.status(400).json({ message: `Lỗi tải tệp: ${error.message}`, code: "UPLOAD_ERROR" });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ message: error.message, code: error.code, details: error.details });
    return;
  }
  console.error(error);
  res.status(500).json({ message: "Lỗi máy chủ", code: "INTERNAL_ERROR" });
};

import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(422).json({ message: "Dữ liệu không hợp lệ", code: "VALIDATION_ERROR", errors: error.flatten() });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ message: error.message, code: error.code, details: error.details });
    return;
  }
  console.error(error);
  res.status(500).json({ message: "Lỗi máy chủ", code: "INTERNAL_ERROR" });
};

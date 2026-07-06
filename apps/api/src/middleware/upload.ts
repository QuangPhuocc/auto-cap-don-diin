import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

export const excelUpload = multer({
  storage: multer.diskStorage({
    destination: env.UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${uuid()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".xlsx", ".xls"];
    if (!allowed.includes(path.extname(file.originalname).toLowerCase())) return cb(new AppError(415, "Chỉ chấp nhận file Excel .xlsx hoặc .xls"));
    cb(null, true);
  }
});

export const ocrUpload = multer({
  storage: multer.diskStorage({
    destination: env.UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `ocr-${uuid()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".pdf"];
    if (!allowed.includes(path.extname(file.originalname).toLowerCase())) {
      return cb(new AppError(415, "Chỉ chấp nhận file ảnh (.png, .jpg, .jpeg) hoặc PDF (.pdf)"));
    }
    cb(null, true);
  }
});

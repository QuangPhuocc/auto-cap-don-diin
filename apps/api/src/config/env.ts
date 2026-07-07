import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv({ path: path.resolve(process.cwd(), ".env") });
loadDotenv({ path: path.resolve(process.cwd(), "../../.env") });

const bool = z.string().default("false").transform((v) => v.toLowerCase() === "true");

export const env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  WEB_URL: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("30d"),
  DIIN_BASE_URL: z.string().url().default("https://daily.diin.com.vn"),
  DIIN_USERNAME: z.string().default(""),
  DIIN_PASSWORD: z.string().default(""),
  DIIN_HEADLESS: bool,
  DIIN_ALLOW_ISSUE: bool,
  DIIN_TIMEOUT_MS: z.coerce.number().default(45000),
  DIIN_QUEUE_MODE: z.enum(["bullmq", "sync"]).default("bullmq"),
  DIIN_RECORD_VIDEO: bool,
  DIIN_WORKER_CONCURRENCY: z.coerce.number().default(40),
  UPLOAD_DIR: z.string().default("./uploads"),
  PDF_DIR: z.string().default("./downloads"),
  MAX_UPLOAD_MB: z.coerce.number().default(20),
  GEMINI_API_KEY: z.string().optional()
}).parse(process.env);

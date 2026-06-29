import { Redis } from "ioredis";
import { env } from "../config/env.js";

export const redis = env.DIIN_QUEUE_MODE === "sync"
  ? null
  : new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

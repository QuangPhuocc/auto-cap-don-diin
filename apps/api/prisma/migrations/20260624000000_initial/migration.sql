CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CTV');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');
CREATE TYPE "PolicyStatus" AS ENUM ('QUEUED', 'PROCESSING', 'ISSUED', 'FAILED');
CREATE TYPE "JobType" AS ENUM ('SINGLE_POLICY', 'EXCEL_UPLOAD');
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "BatchStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "username" VARCHAR(100) NOT NULL,
  "password_hash" TEXT NOT NULL,
  "full_name" VARCHAR(255) NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'CTV',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "jobs" (
  "id" UUID NOT NULL,
  "bull_job_id" VARCHAR(100),
  "user_id" UUID,
  "type" "JobType" NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "batch_uploads" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "job_id" UUID,
  "original_name" TEXT NOT NULL,
  "file_path" TEXT NOT NULL,
  "total_rows" INTEGER NOT NULL DEFAULT 0,
  "issued_rows" INTEGER NOT NULL DEFAULT 0,
  "failed_rows" INTEGER NOT NULL DEFAULT 0,
  "status" "BatchStatus" NOT NULL DEFAULT 'QUEUED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "batch_uploads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "policies" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "batch_id" UUID,
  "job_id" UUID,
  "customer_name" VARCHAR(255) NOT NULL,
  "phone" VARCHAR(30),
  "address" TEXT,
  "plate_number" VARCHAR(50) NOT NULL,
  "chassis_number" VARCHAR(100),
  "engine_number" VARCHAR(100),
  "vehicle_type" VARCHAR(255),
  "seat_count" INTEGER,
  "effective_date" DATE,
  "certificate_number" VARCHAR(100),
  "serial_number" VARCHAR(100),
  "premium" DECIMAL(15,2),
  "pdf_url" TEXT,
  "pdf_path" TEXT,
  "status" "PolicyStatus" NOT NULL DEFAULT 'QUEUED',
  "error" TEXT,
  "issued_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL,
  "user_id" UUID,
  "action" VARCHAR(100) NOT NULL,
  "details" JSONB,
  "ip_address" VARCHAR(64),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "jobs_bull_job_id_key" ON "jobs"("bull_job_id");
CREATE INDEX "jobs_user_id_created_at_idx" ON "jobs"("user_id", "created_at");
CREATE INDEX "jobs_status_idx" ON "jobs"("status");
CREATE UNIQUE INDEX "batch_uploads_job_id_key" ON "batch_uploads"("job_id");
CREATE INDEX "batch_uploads_user_id_created_at_idx" ON "batch_uploads"("user_id", "created_at");
CREATE INDEX "policies_user_id_created_at_idx" ON "policies"("user_id", "created_at");
CREATE INDEX "policies_plate_number_idx" ON "policies"("plate_number");
CREATE INDEX "policies_certificate_number_idx" ON "policies"("certificate_number");
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "batch_uploads" ADD CONSTRAINT "batch_uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "batch_uploads" ADD CONSTRAINT "batch_uploads_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "policies" ADD CONSTRAINT "policies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "policies" ADD CONSTRAINT "policies_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batch_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "policies" ADD CONSTRAINT "policies_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

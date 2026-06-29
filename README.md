# DIIN CTV Portal

Web app trung gian cho CTV tạo yêu cầu bảo hiểm TNDS, xử lý bất đồng bộ bằng BullMQ và tự động thao tác DIIN bằng Playwright.

## 10 bước đã triển khai

1. Monorepo: `apps/api`, `apps/web`, `uploads`, `downloads`.
2. Prisma schema: users, policies, jobs, audit_logs và batch_uploads.
3. Express API với validation, logging, rate limit, xử lý lỗi.
4. JWT login và phân quyền ADMIN/CTV.
5. CRUD/quản lý CTV.
6. Tạo đơn lẻ, upload Excel, tra cứu đơn/job và tải PDF.
7. BullMQ + Redis, API và worker tách tiến trình.
8. Playwright service cho DIIN, có khóa an toàn phát hành.
9. Dashboard React/Vite/TypeScript/Tailwind/Shadcn-style.
10. Docker Compose cho PostgreSQL, Redis, API, worker, web.

## Chạy local

```bash
copy .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Mặc định `DIIN_ALLOW_ISSUE=false`: worker chỉ kiểm tra đăng nhập và dừng trước thao tác phát hành. Chỉ bật sau khi đã kiểm thử selector trên môi trường được phép.

# Marcom Report - Sun Group

Báo cáo Marcom được xây dựng bằng Next.js với phân quyền truy cập.

## Cài đặt

```bash
npm install
```

## Chạy development

```bash
npm run dev
```

## Demo Accounts

| Role    | Email             | Password |
| ------- | ----------------- | -------- |
| Admin   | admin@sun.com     | 123456   |
| Editor  | editor@sun.com    | 123456   |
| Viewer  | viewer@sun.com    | 123456   |

## Phân quyền

- **Admin**: Truy cập tất cả (Reports, Docs, Admin panel)
- **Editor**: Truy cập Reports và Docs
- **Viewer**: Chỉ truy cập Reports

## Cấu trúc

```
src/
├── app/
│   ├── admin/        # Admin panel
│   ├── docs/         # Documentation
│   ├── login/        # Login page
│   ├── reports/      # Reports
│   └── api/auth/     # Auth API
├── components/       # React components
├── contexts/         # Auth context
└── lib/              # Utilities
```

# Azure DevOps CI/CD cho report HTML theo mô hình only slug

## Tóm tắt điều hành

Tài liệu này mô tả kiến trúc CI/CD dùng Azure DevOps để publish report HTML lên cùng một domain theo mô hình `only slug`.

Mô hình vận hành đã chốt:

- mỗi report có một `slug` public duy nhất
- public endpoint ổn định theo dạng `https://domain/reports/<slug>`
- không dùng `version path`
- không dùng alias `latest`
- rollback bằng cách redeploy artifact cũ của chính slug đó
- success hoặc failure đều bắn notify về `Microsoft Teams`

## Quy ước repository và URL

### Public endpoint

```text
https://domain/reports/<slug>
```

Ví dụ:

```text
https://domain/reports/nua-dau-nam-t1-t5-2026
https://domain/reports/bao-cao-ai-2026
```

### Cấu trúc source đề xuất

```text
public/
  reports/
    nua-dau-nam-t1-t5-2026.html
    bao-cao-ai-2026.html
```

Khi đó:

- file nguồn vẫn là `.html`
- public route là `/reports/<slug>`
- app hoặc hosting layer sẽ map slug sang file HTML tương ứng

## Nguyên tắc CI/CD chung

- Build một lần, deploy một artifact rõ ràng.
- Tách CI và CD.
- Không build lại trong production stage.
- Secret không để trong repository.
- Validate sớm: file slug, path public, smoke check.
- Rollback phải dễ dự đoán.
- Mỗi lần deploy phải có audit trail.
- Thông báo Teams phải có cả success và failure.

## Luồng pipeline chuẩn

1. Detect thay đổi ở report source.
2. Validate naming rule của slug.
3. Build artifact hoặc build image.
4. Deploy lên môi trường mục tiêu.
5. Smoke check `https://domain/reports/<slug>`.
6. Gửi notify success hoặc failure về Microsoft Teams.
7. Nếu cần rollback thì redeploy artifact cũ của slug đó.

## System Architecture Diagram

Sơ đồ tổng quan đã được cập nhật theo mô hình slug-only:

- một artifact cho mỗi slug
- một endpoint public ổn định cho mỗi slug
- không còn `version/latest`
- notify Teams sau deploy

## Các giải pháp

### Giải pháp 1: AKS

Đây là giải pháp phù hợp nhất với yêu cầu hiện tại nếu:

- repo chính vẫn là app `Next.js`
- công ty đã có platform Kubernetes
- team DevOps đã vận hành `AKS`, `ACR` và lớp publish traffic của cluster

Checklist:

- build image `Next.js`
- push lên `ACR`
- deploy lên `AKS`
- expose qua `Gateway API` publish layer
- smoke check `/reports/<slug>`
- notify Teams

Rollback:

- rollback deployment
- hoặc redeploy image tag cũ

### Giải pháp 2: Cloudflare Pages

Phù hợp khi:

- muốn edge hosting global
- muốn deploy nhanh từ Azure DevOps
- không cần giữ toàn bộ app `Next.js` như production stack chính

Checklist:

- build publish tree
- deploy bằng `wrangler pages deploy`
- cấu hình domain
- smoke check `/reports/<slug>`
- notify Teams

Rollback:

- republish artifact slug trước đó

### Giải pháp 3: Vercel

Phù hợp khi:

- team quen hệ sinh thái Vercel
- muốn managed frontend hosting
- route public chỉ cần ổn định theo slug

Checklist:

- build output đúng rule slug
- deploy qua Git integration hoặc CLI
- cấu hình domain
- smoke check
- notify Teams

Rollback:

- redeploy build trước đó

### Giải pháp 4: VM với Nginx

Phù hợp khi:

- muốn toàn quyền với routing và file system
- muốn chi phí hạ tầng thuần thấp

Checklist:

- copy artifact lên VM
- rewrite `/reports/<slug>` sang file HTML tương ứng
- smoke check
- notify Teams

Rollback:

- restore file slug trước đó

## Khuyến nghị thực tế hiện tại

Với bối cảnh hiện tại:

- repo chính là app `Next.js`
- public route đã chốt theo `only slug`
- công ty đã có sẵn platform Kubernetes
- team DevOps đã vận hành AKS

thì hướng nên chốt để đồng bộ nhất là:

1. `AKS`
2. các giải pháp còn lại chỉ là phương án thay thế theo governance hoặc mục đích riêng

## Bảng so sánh nhanh

| Tiêu chí | AKS | Cloudflare Pages | Vercel | App Service | VM + Nginx |
| --- | --- | --- | --- | --- | --- |
| Route slug ổn định | Rất tốt | Rất tốt | Rất tốt | Tốt | Rất tốt |
| Phù hợp repo Next.js hiện tại | Rất tốt | Trung bình | Trung bình | Tốt | Trung bình |
| Độ đồng bộ với platform công ty | Rất tốt | Trung bình | Trung bình | Tốt | Trung bình |
| Rollback | Cao | Cao | Cao | Cao | Cao |
| Độ dễ setup riêng lẻ | Cao | Thấp đến trung bình | Trung bình | Trung bình | Trung bình |

## Kết luận

Mô hình `only slug` giúp tài liệu, routing, rollout và vận hành đơn giản hơn rất nhiều:

- người dùng chỉ nhớ một URL ổn định
- pipeline chỉ cần quan tâm slug nào được deploy
- rollback rõ ràng theo artifact của slug
- không còn logic `version/latest` gây rối

Với yêu cầu hiện tại, `AKS` nên là giải pháp số 1 trong tài liệu tổng quan để đồng bộ với toàn bộ hệ thống đang có.

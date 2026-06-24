# Azure DevOps CI/CD cho report HTML theo mô hình only slug

## Tóm tắt điều hành

Tài liệu này mô tả kiến trúc CI/CD dùng Azure DevOps để publish report HTML lên cùng một domain theo mô hình `only slug`.

Mô hình vận hành đã chốt:

- Mỗi report có một `slug` public duy nhất.
- Public endpoint ổn định theo dạng `https://domain/reports/<slug>`.
- Không dùng `version path`.
- Không dùng alias `latest`.
- Rollback bằng cách redeploy artifact cũ của chính slug đó.

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

- File nguồn vẫn là `.html`.
- Public route là `/reports/<slug>`.
- App hoặc hosting layer sẽ map slug sang file HTML tương ứng.

## Nguyên tắc CI/CD chung

- Build một lần, deploy một artifact rõ ràng.
- Tách CI và CD.
- Không build lại trong production stage.
- Secret không để trong repository.
- Validate sớm: file slug, path public, smoke check.
- Rollback phải dễ dự đoán.
- Mỗi lần deploy phải có audit trail.

## Luồng pipeline chuẩn

1. Detect thay đổi ở report source.
2. Validate naming rule của slug.
3. Build artifact hoặc build image.
4. Deploy lên môi trường mục tiêu.
5. Smoke check `https://domain/reports/<slug>`.
6. Nếu cần rollback thì redeploy artifact cũ của slug đó.

## System Architecture Diagram

Sơ đồ hệ thống nên giữ ở mức `logical architecture`:

- `Internal Users` và `External Users`
- `Public Web Entry`
- `Web Portal`
- `Identity Provider`
- `Authorization Store`
- `Report Content Source`

Phần CI/CD, rollout, AKS, Gateway API và auth flow chi tiết không nên nhồi vào sơ đồ này.

## Identity And Access Model

- `Microsoft Entra External ID` là identity provider cho portal.
- `Web Portal` là nơi xử lý login, callback, session và logout.
- `Authorization Store` giữ role mapping và ACL theo report/path.
- `Internal Users` và `External Users` cùng vào một portal nhưng quyền truy cập được kiểm tra riêng ở tầng app.

## Giải pháp 1: AKS

Đây là giải pháp phù hợp nhất với yêu cầu hiện tại nếu:

- Repo chính vẫn là app `Next.js`.
- Công ty đã có platform Kubernetes.
- Team DevOps đã vận hành `AKS`, `ACR` và lớp publish traffic của cluster.
- Portal cần phục vụ cả internal và external users.

Kiến trúc public access nên chốt theo thứ tự:

- `Internal Users` hoặc `External Users`
- `Azure Front Door Premium`
- `Gateway API`
- `AKS Next.js App`
- `Microsoft Entra External ID` dùng cho OIDC login trong app

Checklist:

- Build image `Next.js`.
- Push image lên `ACR`.
- Deploy lên `AKS`.
- Expose public domain qua `Azure Front Door Premium`.
- Publish traffic vào app qua `Gateway API` layer.
- Tích hợp `Microsoft Entra External ID` trực tiếp trong app.
- Kiểm tra quyền theo path và slug ở tầng app.
- Smoke check `/reports/<slug>`.

Rollback:

- Rollback deployment.
- Hoặc redeploy image tag cũ.

## Khuyến nghị thực tế hiện tại

Với bối cảnh hiện tại:

- Repo chính là app `Next.js`.
- Public route đã chốt theo `only slug`.
- Công ty đã có sẵn platform Kubernetes.
- Team DevOps đã vận hành AKS.
- Portal cần phục vụ cả internal và external users.

Hướng nên chốt để đồng bộ nhất là `AKS`.

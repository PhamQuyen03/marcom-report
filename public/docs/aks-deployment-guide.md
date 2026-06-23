# Giải pháp AKS cho app Next.js và report HTML theo mô hình only slug

## Mục tiêu tài liệu

Tài liệu này mô tả cách triển khai repo hiện tại lên `AKS` khi:

- App chính vẫn là `Next.js`.
- Vẫn có login, docs và report portal.
- Report HTML nằm trong `public/reports`.
- Public endpoint của report theo mô hình `only slug`.
- Portal phục vụ cả internal và external users.

Mục tiêu URL:

```text
https://domain/reports/<slug>
```

## Vì sao AKS là hướng phù hợp

Nếu công ty đã có:

- Platform Kubernetes.
- Team DevOps vận hành.
- `ACR`.
- Lớp publish traffic của cluster.
- Chuẩn release qua Azure DevOps.

Thì `AKS` là hướng phù hợp hơn so với việc tách riêng một static-only stack.

Lý do:

- Repo hiện tại là app `Next.js`, không phải chỉ có HTML tĩnh.
- Cần giữ nguyên auth, docs, route và portal.
- Report HTML chỉ là một phần của app.
- CI/CD nên bám theo platform chung của công ty.

## Mô hình slug-only trên app hiện tại

### Source

```text
public/
  reports/
    nua-dau-nam-t1-t5-2026.html
    bao-cao-ai-2026.html
```

### Public route

```text
/reports/<slug>
```

Ví dụ:

```text
/reports/nua-dau-nam-t1-t5-2026
/reports/bao-cao-ai-2026
```

### Mapping

App `Next.js` sẽ map:

- `/reports/bao-cao-ai-2026`
- Sang file thực `/reports/bao-cao-ai-2026.html`

Như vậy:

- Người dùng chỉ thấy slug.
- Source vẫn giữ HTML file dễ quản lý.

## Kiến trúc tổng quát

```text
Azure Repos / Git
  -> Azure DevOps Pipeline
  -> Build Next.js image
  -> Push ACR
  -> Deploy AKS
  -> Gateway API publish layer
  -> Next.js web portal
  -> Microsoft Entra External ID login
  -> Authorization theo path / slug
  -> Public domain
  -> Smoke check
  -> Notify Microsoft Teams
```

## Thành phần chính

### 1. Repository

Chứa:

- Source `Next.js`.
- `public/reports/*.html`.
- `Dockerfile.aks`.
- Manifest hoặc chart cho AKS.
- Pipeline Azure DevOps.

### 2. Azure DevOps

Phụ trách:

- Checkout source.
- `pnpm install`.
- `lint`.
- Validate report slug.
- Build app.
- Build image.
- Push `ACR`.
- Deploy `AKS`.
- Smoke check.
- Notify Teams.

### 3. ACR

Lưu image release:

```text
marcom-report:<build-number>
```

### 4. AKS

Chạy:

- `Deployment`
- `Service`
- App `Next.js`

### 5. Public entry và publish layer

Phụ trách:

- Nhận request public từ domain.
- Enforce WAF và rule ở lớp edge.
- Route request vào `Gateway API` của AKS.
- Publish traffic vào app `Next.js`.

Thành phần khuyến nghị:

- `Azure Front Door Premium` là public entry.
- `AKS application routing Gateway API implementation` là publish layer trong cluster.

Lưu ý:

- App trong hướng này không cần `OAuth2 Proxy`.
- App tự tích hợp `Microsoft Entra External ID` để xử lý login, callback, session và logout.

## Thứ tự truy cập khuyến nghị

Luồng truy cập nên chốt như sau:

- `Internal Users` hoặc `External Users`
- `Azure Front Door Premium`
- `Gateway API`
- `AKS Next.js App`
- `Microsoft Entra External ID`

Nghĩa là trong tài liệu và triển khai thực tế:

- `Azure Front Door Premium` là lớp public entry.
- `Gateway API` là lớp publish trong cluster.
- `Next.js app` là nơi tích hợp trực tiếp OIDC và xử lý authorization.

## Identity và authorization model

### Identity

- `Microsoft Entra External ID` là identity provider cho portal.
- Internal user và external user cùng đăng nhập qua flow mà app cấu hình với External ID.

### Authorization

- App kiểm tra quyền theo path và slug.
- Nên có `authorization store` hoặc metadata database để map:
  - user
  - role
  - group
  - report slug
  - allowed path

Ví dụ:

- `/reports/internal/*` chỉ internal users.
- `/reports/partner/*` chỉ external users đã được cấp quyền.
- `/reports/finance/*` chỉ role finance.

## SSL trên AKS

Hai hướng phổ biến:

### Hướng 1: `cert-manager`

- Cấp cert tự động.
- Renew tự động.
- Phù hợp nếu platform đang dùng `Let's Encrypt`.

### Hướng 2: certificate nội bộ

- Certificate do công ty cấp.
- Lưu trong `Kubernetes Secret`.
- Gateway hoặc lớp publish dùng secret đó để terminate TLS.

## Gợi ý smoke check

```bash
curl -I https://reports.example.com/
curl -I https://reports.example.com/reports/nua-dau-nam-t1-t5-2026
```

## Rollback

Rollback trên AKS theo chuẩn platform:

- Rollback deployment.
- Hoặc redeploy image tag cũ.

Ví dụ:

```bash
kubectl rollout undo deployment/marcom-report -n marcom-report
```

## Notify Microsoft Teams

Nên gửi:

- Pipeline name.
- Image tag.
- Môi trường.
- URL public.
- Trạng thái success hoặc failure.
- Thời gian deploy.

## Checklist go-live

- Azure DevOps build pass.
- Image push được lên ACR.
- AKS pull được image.
- `Azure Front Door Premium` hoạt động đúng.
- `Gateway API` route đúng vào app.
- `Microsoft Entra External ID` trả callback đúng app registration.
- Session web trong app hoạt động ổn định.
- Authorization theo path và slug hoạt động đúng.
- DNS trỏ đúng.
- TLS hoạt động.
- `/reports/<slug>` mở được.
- Notify Teams hoạt động.

## Rủi ro chính

### 1. Build app fail trong CI/CD

Giảm rủi ro:

- Giữ production build ổn định bằng `webpack`.
- Để `dev` tiếp tục dùng `Turbopack`.

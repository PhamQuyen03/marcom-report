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

### Mapping

App `Next.js` sẽ map slug route sang file HTML thực tương ứng trong `public/reports`.

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
```

## Thành phần chính

### 1. Repository

- Source `Next.js`
- `public/reports/*.html`
- `Dockerfile.aks`
- Manifest hoặc chart cho AKS
- Pipeline Azure DevOps

### 2. Azure DevOps

- Checkout source
- `pnpm install`
- `lint`
- Validate report slug
- Build app
- Build image
- Push `ACR`
- Deploy `AKS`
- Smoke check

### 3. ACR

Lưu image release:

```text
marcom-report:<build-number>
```

### 4. AKS

- `Deployment`
- `Service`
- App `Next.js`

### 5. Public entry và publish layer

- `Azure Front Door Premium` là public entry
- `AKS application routing Gateway API implementation` là publish layer trong cluster

Lưu ý:

- App trong hướng này không cần `OAuth2 Proxy`.
- App tự tích hợp `Microsoft Entra External ID` để xử lý login, callback, session và logout.

## Thứ tự truy cập khuyến nghị

- `Internal Users` hoặc `External Users`
- `Azure Front Door Premium`
- `Gateway API`
- `AKS Next.js App`
- `Microsoft Entra External ID`

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

## Cách đọc sơ đồ

- `System Architecture Diagram` chỉ thể hiện runtime architecture ở mức high-level.
- `Deployment Diagram - AKS` mới là nơi thể hiện CI/CD, ACR và rollout vào cluster.
- Flow đăng nhập OIDC và rule ACL chi tiết nên để ở section text hoặc sơ đồ riêng nếu cần.

## SSL trên AKS

### Hướng 1: `cert-manager`

- Cấp cert tự động.
- Renew tự động.

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

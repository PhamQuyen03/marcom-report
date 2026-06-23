# Giải pháp AKS cho app Next.js và report HTML theo mô hình only slug

## Mục tiêu tài liệu

Tài liệu này mô tả cách triển khai repo hiện tại lên `AKS` khi:

- app chính vẫn là `Next.js`
- vẫn có login, docs, report portal
- report HTML nằm trong `public/reports`
- public endpoint của report theo mô hình `only slug`

Mục tiêu URL:

```text
https://domain/reports/<slug>
```

## Vì sao AKS là hướng phù hợp

Nếu công ty đã có:

- platform Kubernetes
- team DevOps vận hành
- `ACR`
- lớp publish traffic của cluster
- chuẩn release qua Azure DevOps

thì `AKS` là hướng phù hợp hơn so với việc tách riêng một static-only stack.

Lý do:

- repo hiện tại là app `Next.js`, không phải chỉ có HTML tĩnh
- cần giữ nguyên auth, docs, route và portal
- report HTML chỉ là một phần của app
- CI/CD nên bám theo platform chung của công ty

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
- sang file thực `/reports/bao-cao-ai-2026.html`

Như vậy:

- người dùng chỉ thấy slug
- source vẫn giữ HTML file dễ quản lý

## Kiến trúc tổng quát

```text
Azure Repos / Git
  -> Azure DevOps Pipeline
  -> Build Next.js image
  -> Push ACR
  -> Deploy AKS
  -> Service
  -> Ingress layer
  -> Public domain
  -> Smoke check
  -> Notify Microsoft Teams
```

## Thành phần chính

### 1. Repository

Chứa:

- source `Next.js`
- `public/reports/*.html`
- `Dockerfile.aks`
- manifest hoặc chart cho AKS
- pipeline Azure DevOps

### 2. Azure DevOps

Phụ trách:

- checkout source
- `pnpm install`
- `lint`
- validate report slug
- build app
- build image
- push `ACR`
- deploy `AKS`
- smoke check
- notify Teams

### 3. ACR

Lưu image release:

```text
marcom-report:<build-number>
```

### 4. AKS

Chạy:

- `Deployment`
- `Service`
- app `Next.js`

### 5. Ingress layer

Phụ trách:

- expose domain
- route request vào app `Next.js`
- terminate TLS

Lưu ý:

- app trong hướng này không cần một web server riêng cho publish static
- lớp publish được chốt là `AKS application routing Gateway API implementation`

## Ingress layer khuyến nghị

Với bối cảnh hiện tại, nên chốt dùng:

- `AKS application routing Gateway API implementation`
- `gatewayClassName: approuting-istio`

Lý do:

- đây là hướng dài hạn mà AKS đang khuyến nghị
- vẫn là managed experience của AKS, không cần tự vận hành một ingress stack riêng cho app

Nghĩa là trong tài liệu và triển khai thực tế, khi nói `Ingress layer` thì nên hiểu là:

- `Gateway API` của AKS application routing
- không phải một web server riêng đứng trong workload của app

## SSL trên AKS

Khác với hướng VM, trên AKS thường không SSH vào node để chạy `certbot`.

Hai hướng phổ biến:

### Hướng 1: `cert-manager`

- cấp cert tự động
- renew tự động
- phù hợp nếu platform đang dùng `Let's Encrypt`

### Hướng 2: certificate nội bộ

- certificate do công ty cấp
- lưu trong `Kubernetes Secret`
- ingress layer dùng secret đó để terminate TLS

## Gợi ý triển khai thực tế

Nếu team DevOps cần một lựa chọn duy nhất để chốt sớm, nên đi theo:

1. `AKS application routing Gateway API implementation`
2. `Gateway` + `HTTPRoute`
3. TLS do `cert-manager` hoặc certificate nội bộ của công ty quản lý

## Flow pipeline chuẩn

1. Checkout code.
2. Install dependency bằng `pnpm`.
3. Chạy `lint`.
4. Validate report slug.
5. Build `Next.js`.
6. Build Docker image.
7. Push image lên `ACR`.
8. Deploy lên `AKS`.
9. Chờ rollout thành công.
10. Smoke check `/reports/<slug>`.
11. Gửi notify Teams.

## Smoke check

Ví dụ:

```bash
curl -I https://reports.example.com/
curl -I https://reports.example.com/reports/nua-dau-nam-t1-t5-2026
```

## Rollback

Rollback trên AKS theo chuẩn platform:

- rollback deployment
- hoặc redeploy image tag cũ

Ví dụ:

```bash
kubectl rollout undo deployment/marcom-report -n marcom-report
```

## Notify Microsoft Teams

Nên gửi:

- pipeline name
- image tag
- môi trường
- URL public
- trạng thái success hoặc failure
- thời gian deploy

Ví dụ:

```json
{
  "text": "Deploy AKS thành công cho marcom-report. URL: https://reports.example.com/reports/bao-cao-ai-2026"
}
```

## Checklist go-live

- Azure DevOps build pass
- image push được lên ACR
- AKS pull được image
- ingress layer hoạt động
- DNS trỏ đúng
- TLS hoạt động
- `/reports/<slug>` mở được
- notify Teams hoạt động

## Rủi ro chính

### 1. Build app fail trong CI/CD

Giảm rủi ro:

- giữ production build ổn định bằng `webpack`
- để `dev` tiếp tục dùng `Turbopack`

### 2. Sai mapping slug

Giảm rủi ro:

- validate source file
- smoke check đúng public route

### 3. Rollback không rõ ràng

Giảm rủi ro:

- dùng image tag rõ ràng
- giữ audit trail theo build number

## Kết luận

Với repo hiện tại, hướng đúng là:

- vẫn deploy toàn bộ app `Next.js`
- report HTML nằm trong `public/reports`
- public endpoint chỉ còn `/reports/<slug>`
- Azure DevOps build image và deploy lên `AKS`

Đây là phương án khớp nhất với cả codebase hiện tại lẫn bối cảnh platform của công ty.

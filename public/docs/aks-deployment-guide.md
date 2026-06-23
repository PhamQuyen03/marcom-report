# Giải pháp AKS: Azure DevOps CI/CD cho report HTML

## Mục tiêu tài liệu

Tài liệu này mô tả cách triển khai CI/CD cho nhiều report HTML trên `AKS` khi công ty đã có:

- platform Kubernetes sẵn
- team DevOps vận hành cluster
- quy trình release chuẩn qua Azure DevOps
- nhu cầu publish report HTML ra domain nội bộ hoặc public
- nhu cầu notify Microsoft Teams khi deploy success hoặc failure

## Khi nào nên chọn AKS

Nên chọn `AKS` khi:

- công ty đã có sẵn platform Kubernetes
- đã có `ACR`, `Ingress`, `cert-manager`, logging, monitoring
- team DevOps đã quen vận hành workload trên AKS
- muốn đưa bài toán report HTML vào cùng chuẩn platform với các service khác
- cần kiểm soát release qua image tag, Helm hoặc manifest versioned

Không nên chọn nếu:

- chỉ cần publish static HTML đơn giản
- chưa có cluster và chưa có team vận hành
- muốn tối ưu chi phí và độ đơn giản tuyệt đối

## Kết luận ngắn gọn

Nếu công ty đã có sẵn platform Kubernetes và team DevOps vận hành tốt, thì `AKS` là một hướng hợp lý.

Trong bối cảnh này:

- độ phức tạp của hạ tầng không còn là gánh nặng mới
- CI/CD sẽ đi theo chuẩn enterprise hơn
- SSL, Ingress, autoscaling, logging, rollback đều theo pattern thống nhất của platform

## Hai mô hình triển khai phù hợp trên AKS

### Mô hình A: đóng report vào image Nginx

Flow:

1. Azure DevOps checkout source
2. gom folder report hoặc file HTML
3. copy vào image `nginx`
4. build Docker image
5. push image lên `ACR`
6. deploy lên `AKS`
7. `Ingress` publish ra domain
8. smoke check
9. notify Microsoft Teams

Ưu điểm:

- đơn giản về mặt triển khai Kubernetes
- rollback tốt bằng image tag
- release rõ ràng theo từng artifact

Nhược điểm:

- chỉ đổi 1 file HTML cũng phải build image mới
- kém linh hoạt hơn nếu report thay đổi rất thường xuyên

### Mô hình B: HTML nằm ngoài image, mount từ Storage

Flow:

1. Azure DevOps checkout source
2. copy report lên `Azure Files` hoặc `Blob`
3. pod `Nginx` mount storage vào web root
4. `Ingress` publish ra domain
5. smoke check
6. notify Microsoft Teams

Ưu điểm:

- không cần build image cho mỗi lần đổi HTML
- hợp với static content thay đổi thường xuyên
- dễ tích hợp thêm tool upload về sau

Nhược điểm:

- kiến trúc phức tạp hơn
- cần quản storage, permission, mount path

## Khuyến nghị thực tế cho use case hiện tại

Với bài toán report HTML, nên ưu tiên:

- `Mô hình A` nếu muốn release theo chuẩn chặt, dễ rollback, dễ audit
- `Mô hình B` nếu muốn update nội dung nhanh và giảm số lần build image

Nếu team đang bắt đầu với AKS, nên đi từ `Mô hình A` trước vì đơn giản hơn để kiểm soát.

## Mô hình URL public

AKS có thể hỗ trợ đồng thời:

### Mô hình versioned

```text
/nua-dau-nam-t1-t5-2026/v1/
/nua-dau-nam-t1-t5-2026/v2/
/nua-dau-nam-t1-t5-2026/latest/
```

### Mô hình file HTML trực tiếp

```text
/report/bao-cao-doanh-thu-q2.html
/report/chien-dich-mua-he-2026.html
```

## `latest` trên AKS nên xử lý thế nào

`latest` không nên để Ingress hoặc application xử lý logic động.

Thực dụng nhất là:

- pipeline chuẩn bị sẵn tree publish
- `latest/` được tạo ra ngay trong artifact hoặc storage tree
- web server chỉ serve static file

Tức là:

- `latest` là output của pipeline
- không phải runtime logic của container

## Kiến trúc tổng quát

```text
Azure Repos / Git
  -> Azure DevOps Pipeline
  -> Build artifact
  -> Build image và push ACR
  -> AKS Deployment
  -> Service
  -> Ingress
  -> Domain public
  -> Smoke check
  -> Notify Microsoft Teams
```

## Thành phần hạ tầng chính

### 1. Source repository

Chứa:

- folder report versioned
- hoặc file HTML public trực tiếp
- Dockerfile
- Helm chart hoặc manifest Kubernetes
- pipeline Azure DevOps

### 2. Azure DevOps

Dùng để:

- chạy CI
- build image
- push `ACR`
- deploy `AKS`
- chạy smoke check
- gửi notify Teams

### 3. Azure Container Registry

Dùng để lưu image release, ví dụ:

```text
marcom-report:2026.06.23.1
marcom-report:prod
```

### 4. AKS

Chạy:

- `Deployment`
- `Service`
- `Ingress`
- có thể thêm `HorizontalPodAutoscaler` nếu cần

### 5. Ingress

Ingress sẽ:

- publish domain hoặc subdomain
- route request vào service
- terminate TLS

### 6. SSL

Khác với `VM + Nginx`, trên AKS thường không SSH vào node để chạy `certbot`.

Thay vào đó:

- dùng `cert-manager` + `Let's Encrypt`
- hoặc dùng certificate do công ty cấp rồi lưu vào `Kubernetes Secret`

## Chuẩn bị trước khi triển khai

### Phía platform / DevOps

- có `AKS cluster`
- có `ACR`
- có `kubectl` access hoặc service connection từ Azure DevOps
- có `Ingress Controller`
- có chiến lược TLS rõ ràng
- có namespace cho project
- có secret quản lý Teams webhook

### Phía domain

- có domain hoặc subdomain
- DNS trỏ về `Ingress public IP` hoặc `Application Gateway`
- biết rõ ai là owner DNS

### Phía CI/CD

- Azure DevOps service connection tới Azure
- Azure DevOps service connection tới Kubernetes
- secret cho `ACR`
- secret cho Microsoft Teams webhook

## Dockerfile mẫu cho mô hình A

```dockerfile
FROM nginx:alpine

COPY publish/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

## Nginx config mẫu trong container

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ $uri/index.html =404;
    }
}
```

Rule này hỗ trợ:

- folder versioned
- alias `latest`
- file HTML public trực tiếp

## Kubernetes manifest tối giản

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: marcom-report
spec:
  replicas: 2
  selector:
    matchLabels:
      app: marcom-report
  template:
    metadata:
      labels:
        app: marcom-report
    spec:
      containers:
        - name: nginx
          image: myacr.azurecr.io/marcom-report:2026.06.23.1
          ports:
            - containerPort: 80
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: marcom-report
spec:
  selector:
    app: marcom-report
  ports:
    - port: 80
      targetPort: 80
```

### Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: marcom-report
spec:
  tls:
    - hosts:
        - reports.example.com
      secretName: reports-tls
  rules:
    - host: reports.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: marcom-report
                port:
                  number: 80
```

## Flow pipeline chuẩn trên Azure DevOps

1. checkout code
2. validate cấu trúc report
3. build publish tree
4. nếu dùng mô hình A:
   - build Docker image
   - push image lên ACR
5. deploy AKS bằng `kubectl apply` hoặc `helm upgrade`
6. đợi rollout thành công
7. smoke check URL public
8. gửi notify Microsoft Teams

## Smoke check

Ví dụ:

```bash
curl -I https://reports.example.com/nua-dau-nam-t1-t5-2026/v2/
curl -I https://reports.example.com/nua-dau-nam-t1-t5-2026/latest/
curl -I https://reports.example.com/report/bao-cao-doanh-thu-q2.html
```

## Rollback trên AKS

### Nếu dùng mô hình A

Rollback bằng:

- rollback deployment
- hoặc redeploy image tag cũ

Ví dụ:

```bash
kubectl rollout undo deployment/marcom-report -n marcom
```

### Nếu dùng mô hình B

Rollback bằng:

- restore content cũ trên storage
- hoặc mount lại path version trước

## Microsoft Teams notification

Nên gửi:

- tên pipeline
- image tag hoặc release version
- môi trường
- URL public
- trạng thái success hoặc failure
- timestamp

Ví dụ payload:

```json
{
  "text": "Deploy AKS thành công cho marcom-report image 2026.06.23.1. URL: https://reports.example.com/"
}
```

## SSL trên AKS

Với AKS, SSL thường theo một trong hai hướng:

### Hướng 1: `cert-manager`

Ưu điểm:

- tự động cấp và renew
- chuẩn Kubernetes
- phù hợp khi dùng `Let's Encrypt`

### Hướng 2: certificate nội bộ hoặc certificate trả phí

Ưu điểm:

- phù hợp policy doanh nghiệp
- đồng bộ với cách công ty quản trị chứng chỉ

Khi đó:

- certificate được import vào `Kubernetes Secret`
- `Ingress` dùng secret đó để terminate TLS

## Checklist trước khi go-live

- có namespace chuẩn
- có ACR và quyền pull image
- Azure DevOps deploy được vào AKS
- Ingress hoạt động
- DNS trỏ đúng
- TLS hoạt động
- smoke check pass
- Teams notify hoạt động

## Rủi ro chính

### 1. Overkill so với bài toán

Giảm rủi ro:

- chỉ dùng AKS nếu công ty đã có platform sẵn

### 2. CI/CD phức tạp hơn VM

Giảm rủi ro:

- chuẩn hóa chart hoặc manifest
- chuẩn hóa naming rule cho report

### 3. Rollback không rõ ràng

Giảm rủi ro:

- dùng image tag rõ ràng
- lưu immutable artifact

### 4. Sai cấu hình Ingress hoặc TLS

Giảm rủi ro:

- tách verify riêng cho DNS, TLS và path routing

## Kết luận

Nếu công ty đã có sẵn platform Kubernetes và team DevOps vận hành, thì `AKS` là một lựa chọn hợp lý cho bài toán này.

Khuyến nghị thực tế:

- bắt đầu bằng mô hình đóng report vào image `Nginx`
- chuẩn hóa release qua `ACR + AKS + Ingress`
- để pipeline xử lý `latest`
- để `Ingress` xử lý domain và TLS
- để Azure DevOps xử lý notify Microsoft Teams

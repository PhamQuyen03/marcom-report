# Giải pháp VM với Nginx theo mô hình only slug

## Mục tiêu tài liệu

Tài liệu này mô tả cách triển khai report HTML trên một VM Linux dùng Nginx theo mô hình `only slug`.

Đầu ra mong muốn:

- mỗi report có một public endpoint duy nhất
- public URL theo dạng `https://domain/reports/<slug>`
- Azure DevOps tự deploy report theo slug

## Mô hình URL

```text
https://domain/reports/<slug>
```

## Cấu trúc file đề xuất trên VM

```text
/var/www/reports/
  reports/
    nua-dau-nam-t1-t5-2026.html
    bao-cao-ai-2026.html
```

Nghĩa là:

- file thật vẫn là `.html`
- URL public không lộ `.html`
- Nginx sẽ rewrite từ `/reports/<slug>` sang file HTML tương ứng

## Khi nào nên chọn hướng này

Nên chọn `VM + Nginx` khi:

- muốn toàn quyền với routing
- muốn tự kiểm soát web root và file system
- muốn chi phí hạ tầng thuần thấp
- không ngại vận hành Linux server

## Phân tách rõ: tạo tay một lần và deploy tự động

### Chỉ làm tay một lần lúc bootstrap

- tạo VM
- gắn domain hoặc DNS
- cài Nginx
- cài SSL với `certbot`
- tạo user `deployer`
- tạo thư mục `/var/www/reports`
- cấu hình Nginx
- chuẩn bị SSH key hoặc service connection từ Azure DevOps

### Azure DevOps sẽ tự động làm mỗi lần deploy

- checkout source
- build hoặc lấy artifact của slug
- copy file HTML của slug lên VM
- smoke check `/reports/<slug>`

## Cấu hình Nginx đề xuất

```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    root /var/www/reports;

    location /reports/ {
        try_files $uri $uri/ $uri.html =404;
    }
}
```

## SSL với Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com
sudo certbot renew --dry-run
```

## Flow deploy chuẩn

1. Azure DevOps detect thay đổi theo slug.
2. Build hoặc lấy artifact.
3. Copy file HTML của slug lên VM.
4. Verify file tồn tại đúng path.
5. Smoke check `https://domain/reports/<slug>`.

Ví dụ:

```bash
scp ./public/reports/bao-cao-ai-2026.html deployer@example.com:/var/www/reports/reports/
```

## Smoke check

```bash
curl -I https://domain.com/reports/bao-cao-ai-2026
```

## Rollback

Với mô hình slug-only, rollback đơn giản là:

- copy lại file HTML cũ của chính slug đó
- reload Nginx nếu cần

Ví dụ:

```bash
scp ./backup/bao-cao-ai-2026.html deployer@example.com:/var/www/reports/reports/
```

## Checklist go-live

- domain trỏ đúng
- Nginx config pass `nginx -t`
- SSL hoạt động
- URL slug mở được
- log access và error ghi bình thường

## Kết luận

`VM + Nginx` là một hướng rất thực dụng nếu muốn giữ routing theo `only slug` nhưng vẫn cần toàn quyền với server.

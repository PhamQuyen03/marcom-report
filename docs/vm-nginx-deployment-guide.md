# Giải pháp 2: VM với Nginx

## Mục tiêu tài liệu

Tài liệu này mô tả chi tiết cách triển khai mô hình publish nhiều báo cáo HTML trên một VM Linux dùng Nginx, với các yêu cầu:

- nhiều report
- có thể có nhiều version hoặc không
- URL public linh hoạt theo folder hoặc theo tên file HTML
- alias `latest` nếu cần
- rollback nhanh
- khả năng tích hợp CI/CD sau này
- có notify Microsoft Teams khi deploy thành công hoặc thất bại

## Khi nào nên chọn hướng này

Nên chọn `VM + Nginx` khi:

- muốn tối ưu chi phí hạ tầng thuần
- cần toàn quyền với file system, web root và routing
- muốn kiểm soát `latest` bằng symlink hoặc alias
- chấp nhận tự vận hành server
- muốn cấu trúc URL rất linh hoạt

Không nên chọn nếu team:

- không muốn vận hành Linux server
- không muốn tự xử lý SSL, backup, monitoring
- muốn mọi thứ managed hoàn toàn

## Đánh giá nhanh

### Điểm mạnh

- rất linh hoạt
- kiểm soát hoàn toàn cấu trúc thư mục
- rollback rất nhanh
- dễ giữ lịch sử version
- không phụ thuộc vào giới hạn routing của platform managed

### Điểm yếu

- nặng công vận hành
- phải tự lo bảo mật và vá hệ điều hành
- phải tự cấu hình SSL, logging, monitoring
- có rủi ro sai permission hoặc sai symlink nếu quy trình không chặt

## Mô hình URL đề xuất

Ví dụ domain:

```text
https://reports.example.com/
```

Ví dụ publish:

```text
/nua-dau-nam-t1-t5-2026/v1/
/nua-dau-nam-t1-t5-2026/v2/
/nua-dau-nam-t1-t5-2026/latest/
/report/bao-cao-doanh-thu-q2.html
/report/chien-dich-mua-he-2026.html
```

Hệ này nên hỗ trợ 2 mô hình publish:

### Mô hình A: versioned folder

- mỗi report có một `slug`
- mỗi version là một thư mục thật
- `latest` là version production deploy thành công gần nhất của từng report
- version cũ vẫn được giữ lại để rollback

### Mô hình B: file-based endpoint

- mỗi file HTML là một endpoint public riêng
- ví dụ `report/bao-cao-doanh-thu-q2.html`
- không bắt buộc có `latest`
- nếu cần thay file mới thì pipeline có thể overwrite đúng file endpoint đó hoặc publish file tên khác
- phù hợp khi team marketing chỉ cần upload một file HTML hoàn chỉnh

## Deployment flow tổng quát

```text
Repository / CI Pipeline
  -> Build hoặc package artifact
  -> Copy artifact lên VM qua SSH / SCP / rsync
  -> Extract vào release tree
  -> Validate file bắt buộc
  -> Update symlink latest
  -> Smoke check URL version và latest
  -> Notify Microsoft Teams success hoặc failure
```

## Phân tách rõ: thao tác tạo tay một lần và phần CI/CD tự động

### Phần chỉ làm tay một lần lúc bootstrap hạ tầng

Đây là các việc chỉ làm lúc dựng nền tảng ban đầu, không phải làm lại cho mỗi lần deploy:

- tạo VM
- gắn domain hoặc cấu hình DNS
- cài Nginx
- cài SSL với `certbot`
- tạo user `deployer`
- tạo thư mục gốc như `/var/www/reports`
- set permission ban đầu
- cấu hình Nginx server block
- chuẩn bị SSH key hoặc service connection từ Azure DevOps sang VM
- tạo webhook Microsoft Teams và lưu vào secret

### Phần Azure DevOps CI/CD sẽ tự động làm ở mỗi lần deploy

Sau khi bootstrap xong, pipeline có thể tự chạy toàn bộ phần deploy:

- đọc source từ Git
- build hoặc collect artifact
- xác định endpoint cần publish theo folder hoặc theo file
- copy folder report lên VM bằng `scp`, `rsync` hoặc SSH task
- tạo folder version mới nếu chưa có
- copy file HTML, CSS, JS, assets vào đúng path
- kiểm tra `index.html`
- cập nhật `latest` nếu đang dùng mô hình versioned
- smoke check URL public tương ứng
- gửi notify success hoặc failure về Microsoft Teams

Tóm lại:

- hạ tầng nền: tạo tay một lần
- deploy report hoặc file HTML từ Git lên VM: pipeline tự động hoàn toàn

## Cấu trúc thư mục đề xuất trên VM

```text
/var/www/reports/
  nua-dau-nam-t1-t5-2026/
    v1/
      index.html
      assets/
    v2/
      index.html
      assets/
    latest -> /var/www/reports/nua-dau-nam-t1-t5-2026/v2
  chien-dich-he-2026/
    v1/
      index.html
      assets/
    latest -> /var/www/reports/chien-dich-he-2026/v1
  report/
    bao-cao-doanh-thu-q2.html
    chien-dich-mua-he-2026.html
```

## Nguyên tắc thư mục

- mỗi report có một folder slug riêng
- mỗi version là một folder thật
- `latest` chỉ cần khi dùng mô hình versioned
- `latest` nên là symlink, không nên là copy folder nếu muốn rollback gọn
- version cũ không bị xóa khi version mới lên
- artifact tạm nên nằm ở thư mục riêng, không nằm chung web root
- với mô hình file-based, endpoint công khai có thể là chính tên file `.html`

## Chuẩn bị hạ tầng

### 1. VM

Khuyến nghị:

- Ubuntu LTS
- 1 VM public hoặc đi qua load balancer
- SSH key-based access
- không dùng password login cho SSH nếu có thể

### 2. Domain

Cần:

- quyền quản lý DNS
- record trỏ về IP hoặc lớp trước VM

Ví dụ:

- `A record` trỏ thẳng về public IP của VM
- hoặc `CNAME` nếu đi qua lớp khác

### 3. Nginx

Cần cài sẵn:

- `nginx`
- cấu hình server block cho domain
- rule serve static files

### 4. SSL

Nên dùng:

- `Let's Encrypt`
- `certbot`

### 5. User deploy

Không nên deploy bằng `root`. Nên có user riêng, ví dụ:

- `deployer`

User này cần:

- quyền ghi vào release tree
- quyền chạy lệnh deploy liên quan
- không nên có quyền quá rộng ngoài phần cần thiết

### 6. Microsoft Teams webhook

Cần chuẩn bị:

- một channel nhận thông báo deploy
- một Incoming Webhook hoặc Power Automate endpoint
- secret lưu ở CI/CD, không hard-code vào script

## Cài đặt VM cơ bản

### Cài Nginx

```bash
sudo apt update
sudo apt install -y nginx
```

### Tạo thư mục deploy

```bash
sudo mkdir -p /var/www/reports
sudo chown -R deployer:deployer /var/www/reports
sudo chmod -R 755 /var/www/reports
```

Lưu ý: bước này là bootstrap một lần. Sau đó pipeline sẽ tự copy các folder report mới vào bên dưới `/var/www/reports/`.

### Kiểm tra Nginx

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

## Cấu hình Nginx đề xuất

Ví dụ:

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    root /var/www/reports;
    index index.html;

    location / {
        try_files $uri $uri/ $uri/index.html =404;
    }

    location ~ /\. {
        deny all;
    }

    access_log /var/log/nginx/reports.access.log;
    error_log /var/log/nginx/reports.error.log;
}
```

## Ý nghĩa cấu hình

- `root /var/www/reports;`: toàn bộ public path sẽ map từ đây
- `try_files $uri $uri/ $uri/index.html =404;`: cho phép URL dạng `/slug/v1/` tự resolve vào `index.html`
- `location ~ /\.`: chặn file ẩn như `.env`, `.git`
- tách access log và error log riêng để tiện vận hành

## Cấu hình HTTPS

Sau khi DNS trỏ đúng:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com
```

Kiểm tra tự động gia hạn:

```bash
sudo certbot renew --dry-run
```

## Khi nào có thể tự cấp SSL trên VM

Nếu bạn SSH được vào VM và có đủ quyền `sudo`, thì thông thường bạn có thể tự:

- cài `certbot`
- lấy SSL từ `Let's Encrypt`
- gắn SSL vào `Nginx`
- bật và kiểm tra auto-renew

Để tự làm được, cần đủ các điều kiện sau:

- domain hoặc subdomain đã trỏ đúng về VM
- cổng `80` và `443` đang mở
- bạn có quyền `sudo`
- `Nginx` đang chạy ổn

Flow thực tế thường là:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
sudo certbot renew --dry-run
```

Lưu ý:

- nếu DNS chưa trỏ đúng về VM thì `certbot` sẽ không xác thực được domain
- nếu không có quyền `sudo` thì bạn không tự cài và gắn cert vào `Nginx` được
- `certbot` thường tự tạo `systemd timer` để auto-renew, không cần tự cấu hình cron tay trong đa số trường hợp

## Quy chuẩn deploy artifact

Artifact có thể đi theo 1 trong 2 dạng.

### Dạng 1: slug/version

```text
artifact/
  nua-dau-nam-t1-t5-2026/
    v2/
      index.html
      assets/
```

Deploy vào:

```text
/var/www/reports/nua-dau-nam-t1-t5-2026/v2/
```

### Dạng 2: file HTML trực tiếp

```text
artifact/
  report/
    bao-cao-doanh-thu-q2.html
    chien-dich-mua-he-2026.html
```

Deploy vào:

```text
/var/www/reports/report/
```

## Flow deploy chuẩn

### Bước 1. Build hoặc collect artifact

Pipeline chuẩn bị output static HTML, CSS, JS, assets.

### Bước 2. Copy artifact lên VM

Có thể dùng:

- `scp`
- `rsync`
- task SSH trong CI/CD

Ví dụ:

```bash
rsync -avz artifact/ deployer@example.com:/var/www/releases/tmp/
```

Nếu repo Git của bạn có cấu trúc như:

```text
report/
  nua-dau-nam-t1-t5-2026/
    v1/
      index.html
    v2/
      index.html
  bao-cao-doanh-thu-q2.html
```

thì Azure DevOps hoàn toàn có thể tự copy cả folder lẫn file HTML lên VM. Không cần tạo tay từng report, từng version hay từng file endpoint trên server.

### Bước 3. Extract hoặc move vào release tree

Ví dụ:

```bash
mkdir -p /var/www/reports/nua-dau-nam-t1-t5-2026/v2
cp -R /var/www/releases/tmp/nua-dau-nam-t1-t5-2026/v2/* /var/www/reports/nua-dau-nam-t1-t5-2026/v2/
```

### Bước 4. Kiểm tra file bắt buộc

Ví dụ:

```bash
test -f /var/www/reports/nua-dau-nam-t1-t5-2026/v2/index.html
```

### Bước 5. Cập nhật `latest` nếu có

Ví dụ:

```bash
ln -sfn /var/www/reports/nua-dau-nam-t1-t5-2026/v2 /var/www/reports/nua-dau-nam-t1-t5-2026/latest
```

### Bước 6. Smoke check

Kiểm tra:

- `https://domain.com/nua-dau-nam-t1-t5-2026/v2/`
- `https://domain.com/nua-dau-nam-t1-t5-2026/latest/`
- `https://domain.com/report/bao-cao-doanh-thu-q2.html`

### Bước 7. Notify Microsoft Teams

Sau khi deploy và smoke check:

- success -> notify kênh release
- failure -> notify kênh lỗi hoặc incident

Thông tin nên gửi:

- tên report
- version
- môi trường
- URL version
- URL latest
- thời gian deploy
- người hoặc pipeline thực hiện
- trạng thái thành công hoặc thất bại

## Flow rollback chuẩn

Với mô hình versioned, rollback tốt nhất là đổi lại `latest`, không xóa version mới ngay.

Ví dụ rollback:

```bash
ln -sfn /var/www/reports/nua-dau-nam-t1-t5-2026/v1 /var/www/reports/nua-dau-nam-t1-t5-2026/latest
```

Sau đó test lại:

- `https://domain.com/nua-dau-nam-t1-t5-2026/latest/`

Nếu rollback xong, cũng cần gửi notify về Microsoft Teams để đội vận hành và business cùng nắm.

Với mô hình file-based:

- nếu overwrite đúng một file `.html` public thì rollback là copy lại file cũ
- nếu publish file mới bằng tên khác thì rollback chỉ là đổi link tham chiếu ở nơi đang share

## Vì sao symlink tốt hơn copy

Phần này chỉ áp dụng cho mô hình versioned.

Nếu `latest` là symlink:

- update nhanh
- rollback nhanh
- không cần copy file nhiều lần
- tránh lệch nội dung giữa version và latest

Nếu `latest` là copy folder:

- dễ sync sai
- tốn I/O
- rollback chậm hơn

## Checklist chuẩn bị trước khi triển khai

### Hạ tầng

- có VM Linux
- có public IP hoặc lớp route phía trước
- có quyền sửa DNS
- có domain
- có SSH key

### Phần mềm

- cài Nginx
- cài certbot
- có user deploy riêng
- có release directory

### Tích hợp

- có webhook Microsoft Teams
- secret được lưu trong CI/CD
- định dạng message đã thống nhất

### Quy trình

- chốt cấu trúc `slug/version/latest`
- chốt logic `latest`
- chốt cách rollback
- chốt cách notify

## Checklist trước khi go-live

- DNS trỏ đúng
- Nginx config pass `nginx -t`
- SSL hoạt động
- URL version mở được
- URL latest mở được
- log access và error đang ghi bình thường
- permission thư mục đúng
- notify Microsoft Teams gửi được ở cả success và failure

## Checklist vận hành định kỳ

- cập nhật security patch cho VM
- kiểm tra disk usage
- kiểm tra certificate expiry
- kiểm tra log Nginx
- kiểm tra backup
- rà SSH access và user không còn dùng
- kiểm tra webhook notify còn hoạt động

## Rủi ro chính

### 1. SSL hết hạn

Giảm rủi ro:

- bật auto renew
- có alert trước ngày hết hạn

### 2. Permission sai

Giảm rủi ro:

- chuẩn hóa owner và chmod
- không deploy bằng nhiều user khác nhau

### 3. `latest` trỏ sai

Giảm rủi ro:

- chỉ update `latest` sau khi smoke check
- ghi log version nào đang là latest

### 4. Server bị đầy disk

Giảm rủi ro:

- có cleanup policy cho artifact tạm
- monitor disk định kỳ

### 5. Mất dữ liệu do deploy lỗi

Giảm rủi ro:

- không overwrite version cũ
- rollback bằng symlink
- backup trước thay đổi lớn

### 6. Notify không gửi được

Giảm rủi ro:

- tách bước notify thành bước rõ ràng trong pipeline
- log payload và HTTP status của webhook
- có fallback alert qua email hoặc kênh khác nếu cần

## Mẫu lệnh deploy tham khảo

```bash
REPORT_SLUG="nua-dau-nam-t1-t5-2026"
REPORT_VERSION="v2"
TARGET_DIR="/var/www/reports/${REPORT_SLUG}/${REPORT_VERSION}"
LATEST_LINK="/var/www/reports/${REPORT_SLUG}/latest"

mkdir -p "${TARGET_DIR}"
cp -R "./artifact/${REPORT_SLUG}/${REPORT_VERSION}/"* "${TARGET_DIR}/"
test -f "${TARGET_DIR}/index.html"
ln -sfn "${TARGET_DIR}" "${LATEST_LINK}"
```

## Mẫu lệnh smoke check

```bash
curl -I https://domain.com/nua-dau-nam-t1-t5-2026/v2/
curl -I https://domain.com/nua-dau-nam-t1-t5-2026/latest/
```

## Mẫu notify Microsoft Teams

```json
{
  "text": "Deploy thành công report nua-dau-nam-t1-t5-2026 version v2. URL latest: https://domain.com/nua-dau-nam-t1-t5-2026/latest/"
}
```

## Kết luận

`VM + Nginx` là hướng phù hợp nếu mục tiêu là:

- chi phí hạ tầng thấp
- URL linh hoạt
- rollback nhanh
- kiểm soát hoàn toàn file system

Đổi lại, đây là hướng tốn công vận hành nhất. Nếu team chấp nhận tự lo:

- OS
- Nginx
- SSL
- backup
- monitoring
- security

thì đây là một phương án rất thực dụng và mạnh cho mô hình nhiều report, nhiều version, alias `latest`.

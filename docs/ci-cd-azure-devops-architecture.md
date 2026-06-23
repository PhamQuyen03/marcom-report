# Azure DevOps CI/CD cho nhiều báo cáo HTML trên một domain

## Tóm tắt điều hành

Tài liệu này mô tả một kiến trúc CI/CD dùng Azure DevOps để publish nhiều báo cáo HTML lên cùng một domain.

Mô hình vận hành đã chốt:

- mỗi báo cáo có một `report-slug` riêng
- mỗi báo cáo có nhiều version như `v1`, `v2`, `v3`
- mỗi version có URL cố định, không bị ghi đè
- mỗi báo cáo có thêm alias ổn định `latest/`
- `latest/` luôn trỏ tới **version deploy production thành công gần nhất của chính báo cáo đó**
- success hoặc failure đều có thể bắn notify về `Microsoft Teams`

## Quy ước repository và URL

### Cấu trúc thư mục

```text
reports/
  nua-dau-nam-t1-t5-2026/
    v1/
      index.html
      assets/
    v2/
      index.html
      assets/
  chien-dich-he-2026/
    v1/
      index.html
      assets/
```

### Mapping URL

```text
reports/<report-slug>/<version>/index.html
    ->
https://domain/<report-slug>/<version>/
```

### Alias `latest`

```text
https://domain/<report-slug>/latest/
    ->
version deploy production thành công gần nhất của report đó
```

## System Architecture Diagram

Sơ đồ tổng quan mô tả luồng chính của toàn project, đồng thời có nhánh notify về Microsoft Teams cho cả trạng thái success và failure.

## Nguyên tắc CI/CD chung

- Build một lần, deploy nhiều nơi nếu cần.
- Tách rõ CI và CD.
- Dùng immutable artifact.
- Không build lại artifact trong production stage.
- Secret không để trong repository.
- Validate sớm: cấu trúc thư mục, file bắt buộc, smoke test.
- Rollback phải nhanh và dễ dự đoán.
- Giữ audit trail cho từng lần deploy.
- Đường dẫn public phải bám chặt cấu trúc thư mục.

## Luồng pipeline chuẩn

1. Detect folder thay đổi dưới `reports/*/v*/`.
2. Validate folder version thay đổi.
3. Package từng version thành immutable artifact.
4. Deploy vào non-production nếu có.
5. Approve production release.
6. Deploy version vào `/<report-slug>/<version>/`.
7. Cập nhật `/<report-slug>/latest/` sang version vừa deploy production thành công.
8. Chạy smoke check trên cả URL version và URL `latest/`.
9. Bắn notify success hoặc failure về Microsoft Teams.
10. Nếu cần rollback thì re-point `latest/` hoặc restore version trước đó.

## Thứ tự khuyến nghị hiện tại

Sắp xếp theo tiêu chí `dễ triển khai -> khó triển khai`:

1. Azure Storage Static Website kèm tùy chọn CDN
2. VM với Nginx
3. Cloudflare Pages
4. Vercel
5. Azure App Service

## Giải pháp 1: Azure Storage Static Website kèm tùy chọn CDN

### Khi nào phù hợp

Dùng khi nội dung hoàn toàn là static HTML/CSS/JS/assets và muốn Azure-native, chi phí thấp, vận hành gọn.

### Deployment Diagram

Sơ đồ cũng bao gồm nhánh notify success/failure về Microsoft Teams sau bước deploy và smoke check.

### Checklist

- Tạo static website trên storage account.
- Upload artifact đúng cây thư mục slug/version.
- Copy hoặc sync version thành công sang `latest/`.
- Purge CDN hoặc Front Door nếu có cache.
- Smoke check cả URL version và URL `latest/`.

### Rollback

- Giữ nguyên version cũ.
- Re-copy version cũ sang `latest/`.
- Purge CDN lại.

## Giải pháp 2: VM với Nginx

### Khi nào phù hợp

Dùng khi cần kiểm soát filesystem, symlink, web root và cấu hình Nginx ở mức sâu.

### Deployment Diagram

Sơ đồ cũng bao gồm nhánh notify success/failure về Microsoft Teams sau bước deploy và smoke check.

### Checklist

- Chuẩn bị release tree trên VM.
- Copy artifact lên server và extract đúng path.
- Update symlink hoặc alias `latest`.
- Reload Nginx nếu cần thay đổi route.
- Smoke check URL version và URL `latest/`.

### Rollback

- Đổi symlink `latest` về version cũ.
- Reload Nginx.

## Giải pháp 3: Cloudflare Pages

### Khi nào phù hợp

Dùng khi muốn một static edge platform global, custom domain nhanh, vận hành gọn, rollback đơn giản.

### Deployment Diagram

Sơ đồ cũng bao gồm nhánh notify success/failure về Microsoft Teams sau bước deploy và smoke check.

### Checklist

- Tạo Pages project và chọn `Direct Upload`.
- Chuẩn bị đầy đủ tree `dist/` theo slug/version/latest.
- Cấu hình `CLOUDFLARE_API_TOKEN` và `CLOUDFLARE_ACCOUNT_ID`.
- Deploy bằng `wrangler pages deploy`.
- Smoke check URL version và URL `latest/`.

### Ghi chú triển khai

- Có thể đi theo hướng `Direct Upload` từ Azure DevOps.
- Phù hợp khi cần static edge hosting global.

### Rollback

- Giữ nguyên version cũ trong publish tree.
- Re-publish version trước đó thành `latest/`.
- Hoặc deploy lại artifact cũ.

## Giải pháp 4: Vercel

### Khi nào phù hợp

Dùng khi team muốn thêm một lựa chọn frontend-hosting mạnh, có custom domain, rollback, edge delivery và có thể tích hợp với Azure DevOps qua Git integration hoặc CLI deploy.

### Deployment Diagram

Sơ đồ cũng bao gồm nhánh notify success/failure về Microsoft Teams sau bước deploy và smoke check.

### Checklist

- Tạo Vercel project cho domain hoặc subdomain tương ứng.
- Chọn Git integration với Azure DevOps hoặc deploy bằng Vercel CLI.
- Build output theo cấu trúc slug/version/latest trước khi deploy.
- Cấu hình custom domain và rule route cho `latest/`.
- Smoke check URL version và URL `latest/`.

### Ghi chú triển khai

- Phù hợp khi team quen hệ sinh thái frontend hosting của Vercel.
- Có thể dùng Azure DevOps để điều phối release thay vì phụ thuộc hoàn toàn vào Git-based flow.
- Notify success/failure vẫn có thể bắn về Microsoft Teams như các giải pháp còn lại.

## Giải pháp 5: Azure App Service

### Khi nào phù hợp

Dùng khi muốn managed platform trong Azure và có khả năng sau này mở rộng beyond static-only hosting.

### Deployment Diagram

Sơ đồ cũng bao gồm nhánh notify success/failure về Microsoft Teams sau bước deploy và smoke check.

### Checklist

- Deploy artifact vào App Service đúng content root.
- Giữ cây slug/version nhất quán với public URL.
- Cấu hình alias hoặc rewrite cho `latest/`.
- Kiểm tra route thực tế sau deploy.
- Smoke check URL version và URL `latest/`.

### Rollback

- Restore artifact cũ.
- Re-point `latest/` về version trước đó.

## Bảng so sánh

| Tiêu chí | Azure Storage Static Website/CDN | VM với Nginx | Cloudflare Pages | Vercel | Azure App Service |
| --- | --- | --- | --- | --- | --- |
| Phù hợp với `/<report>/<version>/` | Rất tốt | Rất tốt | Rất tốt | Rất tốt | Tốt |
| Phù hợp với `latest/` | Rất tốt | Rất tốt | Rất tốt | Tốt đến rất tốt | Tốt |
| Độ phức tạp setup | Thấp | Trung bình đến cao | Thấp | Thấp đến trung bình | Trung bình |
| Chi phí vận hành | Thấp | Trung bình đến cao | Thấp đến trung bình | Thấp đến trung bình | Trung bình |
| Độ dễ rollback | Cao | Cao | Cao | Trung bình đến cao | Trung bình đến cao |
| Khuyến nghị tổng thể | Giải pháp 1 | Giải pháp 2 | Giải pháp 3 | Giải pháp 4 | Giải pháp 5 |

## Kết luận

Nếu ưu tiên tiêu chí `dễ triển khai trước`, thứ tự khuyến nghị hiện tại là:

1. Azure Storage Static Website/CDN
2. VM với Nginx
3. Cloudflare Pages
4. Vercel
5. Azure App Service

Trong đó:

- Azure Storage Static Website/CDN phù hợp hơn nếu muốn triển khai nhanh, ít vận hành
- VM với Nginx linh hoạt nhất nhưng cũng nặng vận hành nhất
- Cloudflare Pages và Vercel ở giữa vì vẫn managed nhưng cần nhiều cấu hình hơn static hosting thuần
- Azure App Service ở cuối vì cần nhiều cấu hình nhất

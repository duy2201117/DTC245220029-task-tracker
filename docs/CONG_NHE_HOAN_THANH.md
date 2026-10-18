# Đánh giá theo rubric của đề bài

| Tiêu chí | Điểm | Thành phần sẵn trong source | Minh chứng phải chạy thật |
|---|---:|---|---|
| GitHub 3 commit + README | 1.5 | `scripts/commit-history.sh`, `README.md` | Repository + `git log` |
| Website + PostgreSQL + pgAdmin | 1.5 | `app/`, `db/init/`, `compose.yaml` | Tạo task + pgAdmin SELECT |
| Nginx reverse proxy | 1.5 | `nginx/nginx.conf` | Truy cập :8080 + headers |
| Prometheus/Grafana | 1.5 | `monitoring/`, monitoring Compose | Targets UP + Dashboard |
| Loki/Promtail/LogQL | 1.5 | `logging/`, logging Compose | 3 query với output |
| Hardening | 1.5 | uid, network, CSP, role DB, secrets | id, inspect, logs, curl |
| Tổng thể/trình bày | Theo bảng chấm gốc (thường phần còn lại) | Report + checklist | trình diễn thực tế + screenshot |

**Trạng thái**: Tài liệu này xác nhận sự hiện diện của cấu hình trong source, **không** xác nhận toàn bộ container đã vận hành đạt chuẩn. Cần chạy thực tế và ghi lại kết quả trước khi báo cáo.

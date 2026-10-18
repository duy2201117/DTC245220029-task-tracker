# TASK TRACKER — Đề 24 | Triển khai và Quản trị Hệ thống Phần mềm

> Bộ đồ án phục vụ học tập: **Node.js/Express + PostgreSQL + pgAdmin + Nginx + Prometheus/Grafana + cAdvisor + Nginx/PostgreSQL exporters + Loki/Promtail**. Giao diện 100% tiếng Việt. Tất cả dịch vụ chạy bằng Docker Compose.

**LƯU Ý QUAN TRỌNG:** Source và các kiểm tra mã nguồn/YAML đã được chuẩn bị, nhưng **chưa được kiểm thử khởi chạy toàn stack Docker thực tế trong môi trường tạo file** (không có Docker daemon và không tải được npm registry). Bạn cần chạy các lệnh kiểm thử trên máy Ubuntu và lưu ảnh chụp thực tế vào báo cáo. Không khẳng định đã demo thành công cho tới khi chạy thật.

## 1. Sơ đồ hệ thống

```text
Trình duyệt → Nginx (:8080) → Express app (:3000) → PostgreSQL (:5432)
           └── pgAdmin (:5050, chỉ localhost) ────┘

Prometheus (:9090) ← app /metrics, Nginx Exporter, Postgres Exporter, cAdvisor
Grafana (:3001) → Prometheus / Loki
Docker JSON log files (read-only) → Promtail → Loki → Grafana Explore + LogQL
```

## 2. Chuẩn bị Ubuntu 22.04/24.04

Đảm bảo máy có Docker Engine + `docker compose` v2 plugin, Git, curl, OpenSSL. Nếu chưa có Docker, cài qua hướng dẫn chính thức tại https://docs.docker.com/engine/install/ubuntu/ .

```bash
sudo apt update
sudo apt install -y git curl openssl
# Xác minh sau khi cài Docker Engine và Compose plugin:
docker --version
docker compose version
docker info
```

Nếu gặp `permission denied /var/run/docker.sock`, dùng `sudo docker compose ...` hoặc thiết lập nhóm `docker` theo tài liệu Docker. **Thành viên nhóm docker có đặc quyền gần tương đương root**, nên tránh thêm người dùng không tin cậy.

Đề xuất: RAM >= 6 GB (8 GB sẽ thoải mái hơn) và dung lượng trống >= 10 GB cho nhiều container.

## 3. Chạy từng mức để đúng lịch sử 3 commit

### Commit 1 — ứng dụng + PostgreSQL + pgAdmin + Nginx

```bash
cd task-tracker-de24
bash scripts/init-env.sh
docker compose -f compose.yaml config --quiet
docker compose -f compose.yaml up -d --build
docker compose -f compose.yaml ps
curl -i http://localhost:8080/healthz
curl -I http://localhost:8080
```

Mở `http://localhost:8080`, đăng ký và tạo dự án/công việc. Mở pgAdmin `http://localhost:5050`; đăng nhập theo `PGADMIN_EMAIL` + `PGADMIN_PASSWORD` trong `.env`.

**Tạo kết nối DB trong pgAdmin**: Register > Server > General: `TaskTracker PostgreSQL` > Connection: Host `db`, Port `5432`, Maintenance DB `tasktracker`, Username `postgres`, Password `POSTGRES_PASSWORD` từ `.env`. Sau đó vào Databases > tasktracker > Schemas > public > Tables > `users`, `projects`, `project_members`, `tasks`.

**Chú ý:** `localhost:5432` trong pgAdmin container là chính pgAdmin, không phải PostgreSQL; phải nhập hostname `db`.

### Commit 2 — Prometheus/Grafana/exporters

```bash
docker compose -f compose.yaml -f compose.monitoring.yaml up -d --build
docker compose -f compose.yaml -f compose.monitoring.yaml ps
```

Mở `http://localhost:9090/targets` → kiểm tra trạng thái `UP` cho `tasktracker-app`, `nginx`, `postgres`, `cadvisor`, `prometheus`. Nếu cAdvisor thiếu số liệu trên Docker Desktop/rootless, thử demo trên Ubuntu Engine cài trực tiếp, xem mục Xử lý lỗi.

Mở Grafana `http://localhost:3001`, Username `admin`, Password `GRAFANA_PASSWORD` từ `.env`. Dashboard được tự nạp trong Dashboards > `Đề 24 - Task Tracker` > **Task Tracker - Giám sát tổng thể**.

Trong Prometheus > Query, thử:

```promql
up
pg_up
nginx_up
sum(rate(tasktracker_http_requests_total[5m]))
sum(rate(container_cpu_usage_seconds_total{image!=""}[5m]))
```

### Commit 3 — Loki/Promtail + LogQL

```bash
docker compose -f compose.yaml -f compose.monitoring.yaml -f compose.logging.yaml up -d --build
docker compose -f compose.yaml -f compose.monitoring.yaml -f compose.logging.yaml ps
```

Mở Grafana > Explore > chọn `Loki`, khung Last 30 minutes, chạy 3–5 LogQL theo `logging/logql-queries.md`.

```logql
{job="containers", service="tasktracker"}
{job="containers", service="nginx"} | json | status >= 400
sum(count_over_time({job="containers"}[5m]))
```

Trước khi chạy truy vấn, đăng nhập ứng dụng, tạo/sửa/xóa công việc; để tạo mã HTTP 403, dùng `curl -i http://localhost:8080/metrics`.

**Promtail đã EOL ngày 02/03/2026**. Giữ cấu hình Promtail bản 3.5.0 để minh chứng theo đúng câu chữ của đề học phần; không dùng bản cũ này để triển khai production. Nên chuyển sang Grafana Alloy trong môi trường thật: https://grafana.com/docs/grafana-cloud/send-data/alloy/set-up/migrate/from-promtail/ .

## 4. Địa chỉ demo

| Dịch vụ | URL từ chính máy Ubuntu | Đăng nhập |
|---|---|---|
| TaskFlow qua Nginx | http://localhost:8080 | Tự đăng ký email + mật khẩu |
| pgAdmin | http://localhost:5050 | `PGADMIN_EMAIL` / `PGADMIN_PASSWORD` |
| Prometheus | http://localhost:9090/targets | Không có auth, chỉ bind localhost |
| Grafana | http://localhost:3001 | `admin` / `GRAFANA_PASSWORD` |
| PostgreSQL | `db:5432` (Docker private network) | User postgres trong pgAdmin |
| Loki, exporters | Docker `observability` network | Không expose ra host |

Nếu chạy Ubuntu VM qua SSH, mở tunnel từ Windows/host: `ssh -L 5050:127.0.0.1:5050 -L 9090:127.0.0.1:9090 -L 3001:127.0.0.1:3001 user@IP_UBUNTU`. Web app ở cổng 8080 cần allow firewall hoặc chuyển qua tunnel `-L 8080:127.0.0.1:8080`.

## 5. Các chức năng website

- Tự đăng ký/đăng nhập; password hash bcrypt, session JWT trong HttpOnly SameSite=Strict cookie.
- Dự án cá nhân tạo sẵn khi đăng ký; tạo thêm nhiều dự án nhóm.
- Chủ nhóm mời **người đã đăng ký** bằng email; quyền xem/sửa tác vụ phụ thuộc thành viên/chủ nhóm/người tạo/người được giao.
- Tạo, tìm kiếm, lọc theo dự án/trạng thái, sửa, xóa công việc.
- Trạng thái `Cần làm → Đang thực hiện → Hoàn thành`; ưu tiên thấp/trung bình/cao, deadline.
- Dashboard tổng số việc, đang làm, đã hoàn thành, quá hạn; bảng Kanban và danh sách.
- API `/healthz` kiểm tra DB; `/metrics` xuất Node/HTTP Prometheus metrics nội bộ.

## 6. Chứng minh hardening (ít nhất 4 biện pháp)

1. **Non-root**: Node app UID 10001; Nginx UID/GID 101; Nginx không dùng port privileged.
2. **Network isolation**: PostgreSQL không publish 5432; `backend`/`observability` Docker internal; pgAdmin/Grafana/Prometheus bind 127.0.0.1.
3. **Mật khẩu mạnh + ẩn bí mật**: `scripts/init-env.sh` tạo 6 giá trị ngẫu nhiên 64 ký tự hex trong `.env` (`chmod 600`); `.gitignore` loại trừ `.env`.
4. **Principle of least privilege**: `taskapp` chỉ được quyền SELECT/INSERT/UPDATE/DELETE trên bảng, không phải PostgreSQL superuser; exporter dùng role `pg_monitor`.
5. **Container**: `read_only` filesystem + `tmpfs` cho app/Nginx; `cap_drop ALL`; `no-new-privileges`; `pids_limit` cho app.
6. **Nginx security headers**: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP, `server_tokens off`; chặn public `/metrics`.
7. **Ứng dụng**: bcrypt, email/UUID/enum validation, parameterized SQL, membership check, rate-limit auth, HttpOnly session, hạn chế body size.
8. **Ngoại lệ cần hiểu**: cAdvisor cần đọc metadata host và Promtail phải chạy root để đọc docker json logs; chỉ mount read-only, nhưng đây vẫn là bề mặt quyền hạn lớn. Tuyệt đối không dùng như hardening production hoàn chỉnh. PgAdmin bảo vệ qua localhost, nhưng có quyền quản trị DB nên chỉ dùng ở môi trường tin cậy.

Minh chứng thao tác:

```bash
curl -I http://localhost:8080              # security headers
curl -i http://localhost:8080/metrics       # HTTP 403
# Kiểm tra UID và quyền trong containers:
docker compose exec app id
docker compose exec nginx id
docker inspect tasktracker-de24-app-1 --format '{{.HostConfig.ReadonlyRootfs}}'
docker network ls
```

## 7. Quy trình GitHub đáp ứng 03 commit

Không nên làm **một commit duy nhất** sau khi xong tất cả. Đã chia sẵn file theo 3 đợt. Nếu bắt đầu với file ZIP chưa có `.git`:

```bash
git config --global user.name "HO_TEN_CUA_BAN"
git config --global user.email "EMAIL_GITHUB_CUA_BAN"
bash scripts/commit-history.sh
git log --oneline --reverse
```

Kết quả mong đợi: commit 1 app + DB + Nginx, commit 2 monitoring, commit 3 Loki/Promtail + tài liệu. Tạo repo mới **trên tài khoản mang mã SV theo yêu cầu**, rồi:

```bash
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

`git push` chỉ thực hiện sau khi bạn tự kiểm tra repo và quyền truy cập; không đưa `.env` lên GitHub. Nếu bạn đã có repo `.git` rồi, script sẽ dừng để tránh thay đổi lịch sử.

## 8. Demo với giảng viên — trình tự 8 phút

1. `docker compose ... ps` chứng minh toàn bộ container đều Up.
2. Website: tạo tài khoản, tạo nhóm, tạo task và deadline, đổi trạng thái, xem dashboard/Kanban.
3. pgAdmin: truy vấn `SELECT id,title,status,due_date FROM tasks ORDER BY created_at DESC;` (không lộ password_hash).
4. Nginx: mở cổng 8080, `curl -I`, giải thích reverse proxy và 4 headers.
5. Prometheus Targets: ảnh ít nhất 4 exporter UP.
6. Grafana: dashboard app/web/DB/container, gửi thêm request để biểu đồ thay đổi.
7. Grafana Explore (Loki): chạy 3 truy vấn LogQL, chỉ rõ dòng log vừa phát sinh.
8. Terminal hardening: UID không phải 0 cho app/Nginx, không publish port DB, file `.env` không commit.

## 9. Kiểm thử, xử lý sự cố

```bash
cd app && npm test && node --check server.js && node --check public/app.js && cd ..
docker compose -f compose.yaml -f compose.monitoring.yaml -f compose.logging.yaml config --quiet
docker compose -f compose.yaml -f compose.monitoring.yaml -f compose.logging.yaml logs --tail=100 app db nginx prometheus grafana loki promtail
```

- Nếu app `unhealthy`, xem log `app`/`db`; kiểm tra `.env`, init SQL và Docker image đã pull thành công.
- Nếu đổi mật khẩu DB sau lần chạy đầu, volume cũ vẫn chứa role/mật khẩu cũ. **Chỉ trong demo nếu được phép xóa dữ liệu**, dùng `docker compose ... down -v` rồi `up -d --build` để khởi tạo lại. Không chạy `down -v` nếu có dữ liệu cần giữ.
- Nếu cAdvisor không `UP`, kiểm tra `/var/lib/docker`, `/sys` và Docker rootless/Desktop: cAdvisor hỗ trợ khác nhau theo host.
- Nếu Loki không có log: kiểm tra `docker info --format '{{.LoggingDriver}}'`, mount `/var/lib/docker/containers`, và log Promtail. Setup này thiết kế riêng Docker Engine trên Ubuntu với json-file.
- Nếu Grafana báo datasource Loki inaccessible trước commit 3: dự kiến vì Loki chưa chạy.
- Nếu `nginx` không chạy do permission, xem log và kiểm tra `tmpfs: /tmp`/quyền UID 101 với image tương ứng.

## 10. Tài liệu nộp và ảnh minh chứng

- `docs/BAO_CAO_DE_24.docx`: bản báo cáo mẫu >=10 trang, có phân tích chi tiết và sơ đồ, **chưa phải kết quả nghiệm thu**.
- `docs/CHECKLIST_DEMO.md`: checklist minh chứng, hướng dẫn screenshot cần chụp.
- `logging/logql-queries.md`: 5 LogQL để demo.
- `screenshots/`: bỏ ảnh chụp thật vào trước khi nộp (mặc định `.gitignore` loại trừ PNG/JPG để không commit nhầm thông tin nhạy cảm; nếu muốn đưa vào repo, rà soát thông tin và chỉnh `.gitignore` thích hợp).

**Không thể bảo đảm 10/10** trước khi chạy Docker thực tế, đưa đủ ảnh minh chứng, hoàn thành GitHub và bảo vệ giải thích kiến trúc.

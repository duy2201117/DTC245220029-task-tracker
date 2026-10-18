# LogQL — ít nhất 3 truy vấn để demo

Trong Grafana > Explore > chọn datasource **Loki**, để thời gian **Last 30 minutes**, sau đó thao tác tạo/sửa/xóa công việc.

## 1. Log ứng dụng Task Tracker (từ Express JSON stdout)
```logql
{job="containers", service="tasktracker"}
```

## 2. Log lỗi ứng dụng và các sự kiện bất thường
```logql
{job="containers", service="tasktracker", level="error"}
```

> Để có dữ liệu lỗi, cần lỗi thật. Truy vấn rỗng khi hệ thống khỏe mạnh là bình thường, không phải lỗi pipeline.

## 3. Log reverse proxy Nginx chứa mã HTTP
```logql
{job="containers", service="nginx"} | json | status >= 400
```

Tạo log HTTP lỗi bằng `curl -i http://localhost:8080/metrics` (mong đợi HTTP 403).

## 4. Biểu đồ tổng lượng log 5 phút
```logql
sum(count_over_time({job="containers"}[5m]))
```

## 5. Sự kiện tạo công việc
```logql
{job="containers", service="tasktracker"} |= "task_created"
```

Nếu hoàn toàn không có log, kiểm tra Docker engine sử dụng `json-file` và các đường dẫn `/var/lib/docker/containers` trên **Ubuntu Linux host**. Docker Desktop/rootless Docker có thể dùng vị trí khác.

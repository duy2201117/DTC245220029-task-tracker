# CHECKLIST DEMO VÀ ẢNH CHỤP THỰC TẾ – ĐỀ 24

Chỉ đánh dấu [x] sau khi đã chạy kiểm tra trên Ubuntu. Ảnh chụp thật phải thể hiện kết quả phần mềm, không sử dụng hình dựng giả làm thực nghiệm.

- [ ] 01. `docker compose ... ps` — tất cả dịch vụ Up.
- [ ] 02. Trang chủ TaskFlow qua `:8080`, có tài khoản đã đăng nhập.
- [ ] 03. Tạo/đổi trạng thái task, deadline và bảng Kanban.
- [ ] 04. pgAdmin kết nối hostname `db`, xem bảng `tasks`, chạy SELECT.
- [ ] 05. `curl -I localhost:8080` có X-Frame-Options, CSP, X-Content-Type-Options.
- [ ] 06. `curl -i localhost:8080/metrics` trả 403.
- [ ] 07. Prometheus `/targets`: 5 jobs UP (cAdvisor cần host Docker phù hợp).
- [ ] 08. Grafana: dashboard request, PostgreSQL, Nginx, CPU/RAM container.
- [ ] 09. Grafana Explore: 3 LogQL có output có ý nghĩa (lỗi không nhất thiết phải tồn tại).
- [ ] 10. `docker compose exec app id` và `exec nginx id` là non-root.
- [ ] 11. `docker network ls` và `docker inspect` chứng minh phân tách network.
- [ ] 12. `git log --oneline --reverse` đủ 3 commit; repository public/private do giảng viên yêu cầu.
- [ ] 13. README hướng dẫn chạy và ghi đúng tài khoản GitHub/mã số sinh viên.
- [ ] 14. Báo cáo Word đã thay tên, MSSV, lớp, trường, giảng viên.
- [ ] 15. Báo cáo có ảnh chụp thực tế + chú thích, không lộ bí mật.

Gợi ý: dùng `gnome-screenshot`, `Shift+Print Screen` hoặc Windows Snipping Tool trong VM; trước khi chụp đóng tab `.env` và che thông tin mật khẩu, email cá nhân nhạy cảm.

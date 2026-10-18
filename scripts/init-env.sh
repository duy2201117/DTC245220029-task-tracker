#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f .env ]]; then echo 'Đã có .env — giữ nguyên để tránh đổi mật khẩu đang sử dụng.'; exit 0; fi
command -v openssl >/dev/null || { echo 'Cần cài openssl'; exit 1; }
cp .env.example .env
chmod 600 .env
for key in POSTGRES_PASSWORD APP_DB_PASSWORD EXPORTER_DB_PASSWORD PGADMIN_PASSWORD GRAFANA_PASSWORD JWT_SECRET; do
  secret="$(openssl rand -hex 32)"
  sed -i "s|^${key}=CHANGE_ME$|${key}=${secret}|" .env
done
echo 'Đã tạo .env với 6 mật khẩu/khóa ngẫu nhiên mạnh. File này nằm trong .gitignore.'
echo 'Xem thông tin bằng: cat .env (không chụp ảnh/commit mật khẩu vào GitHub).'

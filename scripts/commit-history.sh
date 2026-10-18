#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -d .git ]]; then echo 'Đã có .git — không tự commit để tránh ảnh hưởng repository hiện có.'; exit 1; fi
if [[ -z "$(git config user.name || true)" || -z "$(git config user.email || true)" ]]; then echo 'Hãy cấu hình git config --global user.name và user.email trước.'; exit 1; fi
git init -b main
git add app db nginx compose.yaml .env.example .gitignore scripts/init-env.sh
 git commit -m "feat: deploy Task Tracker PostgreSQL pgAdmin and Nginx (commit 1)"
git add compose.monitoring.yaml monitoring
 git commit -m "observability: add Prometheus Grafana and exporters (commit 2)"
git add compose.logging.yaml logging docs README.md scripts/commit-history.sh screenshots/.gitkeep
 git commit -m "logging: add Loki Promtail LogQL hardening guide and report (commit 3)"
echo 'Đã tạo 3 commit có nội dung tách biệt. Chạy git log --oneline --reverse để kiểm tra.'

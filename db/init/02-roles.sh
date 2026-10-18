#!/bin/sh
set -eu
: "${APP_DB_PASSWORD:?Set APP_DB_PASSWORD}"
: "${EXPORTER_DB_PASSWORD:?Set EXPORTER_DB_PASSWORD}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v app_pass="$APP_DB_PASSWORD" -v monitor_pass="$EXPORTER_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE taskapp LOGIN PASSWORD %L', :'app_pass') \gexec
SELECT format('CREATE ROLE taskmonitor LOGIN PASSWORD %L', :'monitor_pass') \gexec
GRANT CONNECT ON DATABASE tasktracker TO taskapp, taskmonitor;
GRANT USAGE ON SCHEMA public TO taskapp;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO taskapp;
GRANT pg_monitor TO taskmonitor;
SQL

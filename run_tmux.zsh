#!/usr/bin/env zsh

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd -- "$(dirname -- "$0")" && pwd -P)}"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
RUNTIME_DIR="$ROOT_DIR/.local/tmux-runtime"
NODE_VERSION="16.20.2"
PRODUCTION_P="${PRODUCTION_P:-n}"
UNLOCK_ALL_P="${UNLOCK_ALL_P:-true}"

POSTGRES_FORMULA="${POSTGRES_FORMULA:-postgresql@16}"
POSTGRES_PORT="${POSTGRES_PORT:-54329}"
POSTGRES_DB="${POSTGRES_DB:-secret_hitler_dev}"
POSTGRES_USER="${POSTGRES_USER:-secret_hitler}"
POSTGRES_STATE_DIR="${POSTGRES_STATE_DIR:-$ROOT_DIR/.local/postgres}"
POSTGRES_DATA_DIR="${POSTGRES_DATA_DIR:-$POSTGRES_STATE_DIR/data}"
POSTGRES_PASSWORD_FILE="${POSTGRES_PASSWORD_FILE:-$POSTGRES_STATE_DIR/password.txt}"
POSTGRES_LOG_FILE="${POSTGRES_LOG_FILE:-$POSTGRES_STATE_DIR/postgres.log}"

PRODUCTION_P="$(echo "$PRODUCTION_P" | tr '[:upper:]' '[:lower:]')"
if [[ "$PRODUCTION_P" == "y" || "$PRODUCTION_P" == "yes" || "$PRODUCTION_P" == "true" || "$PRODUCTION_P" == "1" ]]; then
	PRODUCTION_P="y"
else
	PRODUCTION_P="n"
fi

if ! brew list --versions "$POSTGRES_FORMULA" >/dev/null 2>&1; then
	echo "Installing $POSTGRES_FORMULA with Homebrew..."
	brew install "$POSTGRES_FORMULA"
fi
PG_BIN_DIR="$(brew --prefix "$POSTGRES_FORMULA")/bin"

mkdir -p "$POSTGRES_STATE_DIR" "$POSTGRES_DATA_DIR" "$RUNTIME_DIR"
if [[ ! -f "$POSTGRES_PASSWORD_FILE" ]]; then
	openssl rand -hex 24 > "$POSTGRES_PASSWORD_FILE"
	chmod 600 "$POSTGRES_PASSWORD_FILE"
fi
POSTGRES_PASSWORD="$(cat "$POSTGRES_PASSWORD_FILE")"
DATABASE_URL_LOCAL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}"

if [[ "$PRODUCTION_P" == "y" ]]; then
	BACKEND_CMD="./gradlew run"
	FRONTEND_CMD='npm run build && npx --yes serve -s build -l 3000'
	DEBUG_MODE_ENABLED="false"
else
	# Fast dev defaults: debug backend + hot-reload frontend.
	BACKEND_CMD="./gradlew runLocal"
	FRONTEND_CMD="npm run devLocal"
	DEBUG_MODE_ENABLED="true"
fi

POSTGRES_BOOT_SCRIPT="$RUNTIME_DIR/postgres_boot.sh"
cat >"$POSTGRES_BOOT_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

: "${PG_BIN_DIR:?PG_BIN_DIR is required}"
: "${POSTGRES_STATE_DIR:?POSTGRES_STATE_DIR is required}"
: "${POSTGRES_DATA_DIR:?POSTGRES_DATA_DIR is required}"
: "${POSTGRES_PASSWORD_FILE:?POSTGRES_PASSWORD_FILE is required}"
: "${POSTGRES_LOG_FILE:?POSTGRES_LOG_FILE is required}"
: "${POSTGRES_PORT:?POSTGRES_PORT is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"

export PATH="$PG_BIN_DIR:$PATH"

mkdir -p "$POSTGRES_STATE_DIR" "$POSTGRES_DATA_DIR"
if [[ ! -f "$POSTGRES_PASSWORD_FILE" ]]; then
  openssl rand -hex 24 > "$POSTGRES_PASSWORD_FILE"
  chmod 600 "$POSTGRES_PASSWORD_FILE"
fi

POSTGRES_PASSWORD="$(cat "$POSTGRES_PASSWORD_FILE")"
export PGPASSWORD="$POSTGRES_PASSWORD"

if [[ ! -f "$POSTGRES_DATA_DIR/PG_VERSION" ]]; then
  printf "%s" "$POSTGRES_PASSWORD" > "$POSTGRES_STATE_DIR/pwfile"
  initdb -D "$POSTGRES_DATA_DIR" -U "$POSTGRES_USER" -A scram-sha-256 --pwfile="$POSTGRES_STATE_DIR/pwfile"
  rm -f "$POSTGRES_STATE_DIR/pwfile"
fi

if ! pg_ctl -D "$POSTGRES_DATA_DIR" status >/dev/null 2>&1; then
  pg_ctl -D "$POSTGRES_DATA_DIR" -l "$POSTGRES_LOG_FILE" -o "-p $POSTGRES_PORT -h 127.0.0.1" start
fi

until pg_isready -h 127.0.0.1 -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres >/dev/null 2>&1; do
  sleep 1
done

if ! psql -h 127.0.0.1 -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$POSTGRES_DB';" | grep -q 1; then
  psql -h 127.0.0.1 -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE \"$POSTGRES_DB\";"
fi

echo "Postgres ready: 127.0.0.1:$POSTGRES_PORT db=$POSTGRES_DB user=$POSTGRES_USER"
tail -F "$POSTGRES_LOG_FILE"
EOF
chmod +x "$POSTGRES_BOOT_SCRIPT"

BACKEND_BOOT_SCRIPT="$RUNTIME_DIR/backend_boot.sh"
cat >"$BACKEND_BOOT_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

: "${BACKEND_DIR:?BACKEND_DIR is required}"
: "${PG_BIN_DIR:?PG_BIN_DIR is required}"
: "${DATABASE_URL_LOCAL:?DATABASE_URL_LOCAL is required}"
: "${POSTGRES_PORT:?POSTGRES_PORT is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${BACKEND_CMD:?BACKEND_CMD is required}"
: "${DEBUG_MODE_ENABLED:?DEBUG_MODE_ENABLED is required}"

cd "$BACKEND_DIR"
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export PATH="$PG_BIN_DIR:$JAVA_HOME/bin:$PATH"
export ALL_PROXY=http://127.0.0.1:1087 all_proxy=http://127.0.0.1:1087 http_proxy=http://127.0.0.1:1087 https_proxy=http://127.0.0.1:1087 HTTP_PROXY=http://127.0.0.1:1087 HTTPS_PROXY=http://127.0.0.1:1087
export DATABASE_URL="$DATABASE_URL_LOCAL"
export DISABLE_DATABASE_PERSISTENCE=false
if [[ "$DEBUG_MODE_ENABLED" == "true" ]]; then
  export DEBUG_MODE=true
else
  unset DEBUG_MODE || true
fi

until pg_isready -h 127.0.0.1 -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres >/dev/null 2>&1; do
  sleep 1
done

exec bash -lc "$BACKEND_CMD"
EOF
chmod +x "$BACKEND_BOOT_SCRIPT"

tmuxnew () {
	tmux kill-session -t "$1" &> /dev/null || true
	tmux new -d -s "$@"
}

run_frontend='
cd "'"$FRONTEND_DIR"'"
nvm-load
nvm use '"$NODE_VERSION"'
export ALL_PROXY=http://127.0.0.1:1087 all_proxy=http://127.0.0.1:1087 http_proxy=http://127.0.0.1:1087 https_proxy=http://127.0.0.1:1087 HTTP_PROXY=http://127.0.0.1:1087 HTTPS_PROXY=http://127.0.0.1:1087
export UNLOCK_ALL_P='"$UNLOCK_ALL_P"' REACT_APP_UNLOCK_ALL_P='"$UNLOCK_ALL_P"'
'"$FRONTEND_CMD"'
'

tmuxnew secret-hitler-postgres "env PG_BIN_DIR='$PG_BIN_DIR' POSTGRES_STATE_DIR='$POSTGRES_STATE_DIR' POSTGRES_DATA_DIR='$POSTGRES_DATA_DIR' POSTGRES_PASSWORD_FILE='$POSTGRES_PASSWORD_FILE' POSTGRES_LOG_FILE='$POSTGRES_LOG_FILE' POSTGRES_PORT='$POSTGRES_PORT' POSTGRES_DB='$POSTGRES_DB' POSTGRES_USER='$POSTGRES_USER' bash '$POSTGRES_BOOT_SCRIPT'"
tmuxnew secret-hitler-backend "env BACKEND_DIR='$BACKEND_DIR' PG_BIN_DIR='$PG_BIN_DIR' DATABASE_URL_LOCAL='$DATABASE_URL_LOCAL' POSTGRES_PORT='$POSTGRES_PORT' POSTGRES_USER='$POSTGRES_USER' BACKEND_CMD='$BACKEND_CMD' DEBUG_MODE_ENABLED='$DEBUG_MODE_ENABLED' bash '$BACKEND_BOOT_SCRIPT'"
tmuxnew secret-hitler-frontend "zsh -ic '$run_frontend'"

cat <<'EOT'
Started tmux sessions:
  - secret-hitler-postgres
  - secret-hitler-backend
  - secret-hitler-frontend

Postgres settings:
EOT
echo "  host: 127.0.0.1"
echo "  port: $POSTGRES_PORT"
echo "  db: $POSTGRES_DB"
echo "  user: $POSTGRES_USER"
echo "  password file: $POSTGRES_PASSWORD_FILE"

cat <<'EOT'
Attach:
  tmux attach -t secret-hitler-postgres
  tmux attach -t secret-hitler-backend
  tmux attach -t secret-hitler-frontend
EOT

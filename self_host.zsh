#!/usr/bin/env zsh

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd -- "$(dirname -- "$0")" && pwd -P)}"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
STATE_DIR="${SELF_HOST_STATE_DIR:-$ROOT_DIR/.local/self-hosting}"
RUNTIME_DIR="$STATE_DIR/runtime"
CONFIG_FILE="$STATE_DIR/config.zsh"
POSTGRES_IDENTITY_FILE="$STATE_DIR/postgres-identity.zsh"
CADDYFILE="${SELF_HOST_CADDYFILE:-$HOME/Caddyfile}"
NODE_VERSION="${SELF_HOST_NODE_VERSION:-16.20.2}"
POSTGRES_FORMULA="${POSTGRES_FORMULA:-postgresql@16}"
POSTGRES_PORT="${SELF_HOST_POSTGRES_PORT:-54339}"
POSTGRES_DB="${SELF_HOST_POSTGRES_DB:-secret_hitler_self_host}"
POSTGRES_USER="${SELF_HOST_POSTGRES_USER:-secret_hitler}"
POSTGRES_STATE_DIR="$STATE_DIR/postgres"
POSTGRES_DATA_DIR="$POSTGRES_STATE_DIR/data"
POSTGRES_SOCKET_DIR="$POSTGRES_STATE_DIR/socket"
POSTGRES_PASSWORD_FILE="$POSTGRES_STATE_DIR/password.txt"
POSTGRES_LOG_FILE="$POSTGRES_STATE_DIR/postgres.log"
BACKEND_PORT="${SELF_HOST_BACKEND_PORT:-4040}"
FRONTEND_PORT="${SELF_HOST_FRONTEND_PORT:-6010}"
UNLOCK_ALL_P="${UNLOCK_ALL_P:-true}"
DOCKER_COMPOSE_FILE="${SELF_HOST_DOCKER_COMPOSE_FILE:-$ROOT_DIR/docker-compose.secrethitler.prod.yml}"
DOCKER_POSTGRES_IMAGE="${SELF_HOST_DOCKER_POSTGRES_IMAGE:-postgres:15}"
BEGIN_MARKER="# BEGIN Secret-Hitler-Online managed by self_host.zsh"
END_MARKER="# END Secret-Hitler-Online managed by self_host.zsh"
POSTGRES_SESSION="secret-hitler-postgres"
BACKEND_SESSION="secret-hitler-backend"
FRONTEND_SESSION="secret-hitler-frontend"
DOCKER_SESSION="secret-hitler-docker"
MODE_FILE="$STATE_DIR/mode"
SKIP_START="${SELF_HOST_SKIP_START:-0}"
SKIP_CADDY_RELOAD="${SELF_HOST_SKIP_CADDY_RELOAD:-0}"
SELF_HOST_OWNER_USER="${SELF_HOST_OWNER_USER:-$(id -un)}"
SELF_HOST_OWNER_GROUP="${SELF_HOST_OWNER_GROUP:-$(id -gn)}"

proxy_vars=(
  ALL_PROXY all_proxy
  HTTP_PROXY HTTPS_PROXY NO_PROXY
  http_proxy https_proxy no_proxy
  npm_config_proxy npm_config_https_proxy
  NPM_CONFIG_PROXY NPM_CONFIG_HTTPS_PROXY
  GRADLE_OPTS
)

log () {
  print -P -- "%F{cyan}==>%f $*"
}

die () {
  print -P -- "%F{red}error:%f $*" >&2
  exit 1
}

usage () {
  cat <<'USAGE'
Usage:
  ./self_host.zsh setup <public-origin>
  ./self_host.zsh redeploy
  ./self_host.zsh start
  ./self_host.zsh stop
  ./self_host.zsh docker-setup <public-origin>
  ./self_host.zsh docker-redeploy
  ./self_host.zsh docker-start
  ./self_host.zsh docker-stop

Examples:
  ./self_host.zsh setup https://example.com
  ./self_host.zsh docker-setup https://play.example.com
USAGE
}

tmuxnew () {
	tmux kill-session -t "$1" &> /dev/null || true
	tmux new -d -s "$@"
}

require_command () {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

is_truthy () {
  local value="${1:-}"
  value="$(print -r -- "$value" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == "1" || "$value" == "true" || "$value" == "yes" || "$value" == "y" || "$value" == "on" ]]
}

write_mode () {
  mkdir -p "$STATE_DIR"
  print -r -- "$1" > "$MODE_FILE"
}

read_mode () {
  [[ -s "$MODE_FILE" ]] || return 0
  cat "$MODE_FILE"
}

run_with_optional_sudo () {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  else
    local sudo_bin="/usr/bin/sudo"
    [[ -x "$sudo_bin" ]] || sudo_bin="$(command -v sudo 2>/dev/null || true)"
    if [[ -n "$sudo_bin" ]]; then
      "$sudo_bin" -n "$@" 2>/dev/null || "$sudo_bin" "$@"
    else
      "$@"
    fi
  fi
}

ensure_tree_owned_by_current_user () {
  local path="$1"
  [[ -e "$path" ]] || return 0
  local chown_bin="/usr/bin/chown"
  local chmod_bin="/usr/bin/chmod"
  [[ -x "$chown_bin" ]] || chown_bin="$(command -v chown)"
  [[ -x "$chmod_bin" ]] || chmod_bin="$(command -v chmod)"

  if [[ ! -O "$path" || ! -w "$path" ]]; then
    log "Repairing ownership for $path"
    run_with_optional_sudo "$chown_bin" -R "$SELF_HOST_OWNER_USER:$SELF_HOST_OWNER_GROUP" "$path"
  fi
  "$chmod_bin" -R u+rwX "$path" 2>/dev/null || run_with_optional_sudo "$chmod_bin" -R u+rwX "$path"
}

repair_local_runtime_permissions () {
  ensure_tree_owned_by_current_user "$STATE_DIR"
  ensure_tree_owned_by_current_user "$BACKEND_DIR/.gradle"
  ensure_tree_owned_by_current_user "$FRONTEND_DIR/build"
  ensure_tree_owned_by_current_user "$FRONTEND_DIR/node_modules/.cache"
}

docker_project_name () {
  print -r -- "$ROOT_DIR:t" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

docker_postgres_volume_name () {
  local project_name
  project_name="$(docker_project_name)"
  print -r -- "${SELF_HOST_DOCKER_POSTGRES_VOLUME:-${project_name}_postgres-data}"
}

docker_postgres_volume_exists () {
  command -v docker >/dev/null 2>&1 || return 1
  local volume_name
  volume_name="$(docker_postgres_volume_name)"
  docker volume inspect "$volume_name" >/dev/null 2>&1
}

docker_stack_has_runtime () {
  command -v docker >/dev/null 2>&1 || return 1
  [[ -f "$DOCKER_COMPOSE_FILE" ]] || return 1
  docker compose -f "$DOCKER_COMPOSE_FILE" ps -q 2>/dev/null | grep -q .
}

docker_postgres_volume_has_data () {
  command -v docker >/dev/null 2>&1 || return 1
  local volume_name
  volume_name="$(docker_postgres_volume_name)"
  docker_postgres_volume_exists || return 1
  docker run --rm -v "$volume_name:/var/lib/postgresql/data" "$DOCKER_POSTGRES_IMAGE" sh -ceu '
    find /var/lib/postgresql/data -mindepth 1 -maxdepth 1 | grep -q .
  ' >/dev/null 2>&1
}

local_postgres_data_has_data () {
  [[ -f "$POSTGRES_DATA_DIR/PG_VERSION" ]]
}

backup_directory_if_present () {
  local path="$1"
  local label="$2"
  [[ -d "$path" ]] || return 0
  if [[ -z "$(find "$path" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
    return 0
  fi
  local backup_path="${path}.${label}.backup.$(date +%Y%m%d%H%M%S)"
  log "Backing up $path to $backup_path"
  mv "$path" "$backup_path"
  mkdir -p "$path"
}

pick_free_tcp_port () {
  python3 - <<'PY2'
import socket

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.bind(("127.0.0.1", 0))
print(sock.getsockname()[1])
sock.close()
PY2
}

wait_for_local_postgres () {
  local port="$1"
  local attempts="${2:-60}"
  local i
  for (( i = 1; i <= attempts; i++ )); do
    if PGPASSWORD="$POSTGRES_PASSWORD" "$PG_BIN_DIR/pg_isready" -h 127.0.0.1 -p "$port" -U "$POSTGRES_USER" -d postgres >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_for_docker_postgres () {
  local container_name="$1"
  local attempts="${2:-60}"
  local i
  for (( i = 1; i <= attempts; i++ )); do
    if docker exec "$container_name" pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

docker_volume_backup_if_present () {
  local volume_name="$1"
  local label="$2"

  docker volume inspect "$volume_name" >/dev/null 2>&1 || return 0
  docker run --rm -v "$volume_name:/from:ro" "$DOCKER_POSTGRES_IMAGE" sh -ceu '
    find /from -mindepth 1 -maxdepth 1 | grep -q .
  ' >/dev/null 2>&1 || return 0

  local backup_volume="${volume_name}-${label}-backup-$(date +%Y%m%d%H%M%S)"
  log "Backing up Docker volume $volume_name to $backup_volume"
  docker volume create "$backup_volume" >/dev/null
  docker run --rm \
    -v "$volume_name:/from:ro" \
    -v "$backup_volume:/to" \
    "$DOCKER_POSTGRES_IMAGE" sh -ceu '
      cp -a /from/. /to/
    '
}

clear_docker_volume () {
  local volume_name="$1"
  docker volume create "$volume_name" >/dev/null
  docker run --rm -v "$volume_name:/data" "$DOCKER_POSTGRES_IMAGE" sh -ceu '
    rm -rf /data/* /data/.[!.]* /data/..?* 2>/dev/null || true
  '
}

init_local_postgres_cluster () {
  local data_dir="$1"
  local log_file="$2"
  local socket_dir="$3"
  local password_file="$POSTGRES_STATE_DIR/pwfile.$$"

  rm -rf "$data_dir"
  mkdir -p "$data_dir" "$(dirname -- "$log_file")" "$socket_dir"
  : > "$log_file"

  printf "%s" "$POSTGRES_PASSWORD" > "$password_file"
  "$PG_BIN_DIR/initdb" -D "$data_dir" -U "$POSTGRES_USER" -A scram-sha-256 --pwfile="$password_file" >/dev/null
  rm -f "$password_file"
}

start_local_postgres_temp () {
  local data_dir="$1"
  local log_file="$2"
  local socket_dir="$3"
  local port="$4"

  mkdir -p "$socket_dir"
  "$PG_BIN_DIR/pg_ctl" -D "$data_dir" -l "$log_file" -o "-p $port -h 127.0.0.1 -k $socket_dir" start >/dev/null
  wait_for_local_postgres "$port" || die "Temporary local PostgreSQL instance did not become ready. Check $log_file"
}

stop_local_postgres_temp () {
  local data_dir="$1"
  if [[ -f "$data_dir/PG_VERSION" ]] && "$PG_BIN_DIR/pg_ctl" -D "$data_dir" status >/dev/null 2>&1; then
    "$PG_BIN_DIR/pg_ctl" -D "$data_dir" stop -m fast >/dev/null || true
  fi
}

start_temp_docker_postgres () {
  local volume_name="$1"
  local port="$2"
  local container_name="$3"

  docker volume create "$volume_name" >/dev/null
  docker rm -f "$container_name" >/dev/null 2>&1 || true
  docker run -d --rm \
    --name "$container_name" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -e POSTGRES_USER="$POSTGRES_USER" \
    -e POSTGRES_DB="$POSTGRES_DB" \
    -p "127.0.0.1:${port}:5432" \
    -v "$volume_name:/var/lib/postgresql/data" \
    "$DOCKER_POSTGRES_IMAGE" >/dev/null
  wait_for_docker_postgres "$container_name" || {
    docker logs "$container_name" >&2 || true
    die "Temporary Docker PostgreSQL container did not become ready."
  }
}

detect_docker_postgres_user () {
  local container_name="$1"
  local candidate
  local -a candidates=("$POSTGRES_USER" secret postgres)

  for candidate in "${candidates[@]}"; do
    [[ -n "$candidate" ]] || continue
    if docker exec "$container_name" env PGPASSWORD="$POSTGRES_PASSWORD" \
      psql -h 127.0.0.1 -p 5432 -U "$candidate" -d postgres -Atqc 'SELECT 1' >/dev/null 2>&1; then
      print -r -- "$candidate"
      return 0
    fi
  done

  return 1
}

detect_docker_postgres_db () {
  local container_name="$1"
  local source_user="$2"

  if docker exec "$container_name" env PGPASSWORD="$POSTGRES_PASSWORD" \
    psql -h 127.0.0.1 -p 5432 -U "$source_user" -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = '$POSTGRES_DB'" \
    | grep -qx '1'; then
    print -r -- "$POSTGRES_DB"
    return 0
  fi

  local detected_db
  detected_db="$(
    docker exec "$container_name" env PGPASSWORD="$POSTGRES_PASSWORD" \
      psql -h 127.0.0.1 -p 5432 -U "$source_user" -d postgres -Atqc \
      "SELECT datname FROM pg_database WHERE datistemplate = false AND datname <> 'postgres' ORDER BY datname LIMIT 1"
  )"
  [[ -n "$detected_db" ]] || detected_db="postgres"
  print -r -- "$detected_db"
}

sync_postgres_identity_from_docker_volume () {
  command -v docker >/dev/null 2>&1 || return 0
  docker_postgres_volume_has_data || return 0

  local volume_name
  volume_name="$(docker_postgres_volume_name)"
  local source_port
  source_port="$(pick_free_tcp_port)"
  local source_container="secret-hitler-postgres-detect-source-$$"
  local detected_user detected_db

  {
    start_temp_docker_postgres "$volume_name" "$source_port" "$source_container"
    detected_user="$(detect_docker_postgres_user "$source_container")" || die "Could not determine the PostgreSQL role used by the Docker volume."
    detected_db="$(detect_docker_postgres_db "$source_container" "$detected_user")"
  } always {
    docker rm -f "$source_container" >/dev/null 2>&1 || true
  }

  if [[ "$POSTGRES_USER" != "$detected_user" || "$POSTGRES_DB" != "$detected_db" ]]; then
    log "Using Docker PostgreSQL identity from existing volume: user=$detected_user db=$detected_db"
  fi
  POSTGRES_USER="$detected_user"
  POSTGRES_DB="$detected_db"
}

ensure_dirs () {
  mkdir -p "$STATE_DIR" "$RUNTIME_DIR" "$POSTGRES_STATE_DIR" "$POSTGRES_DATA_DIR" "$POSTGRES_SOCKET_DIR"
}

find_pg_bin_dir () {
  if command -v initdb >/dev/null 2>&1; then
    local initdb_dir
    initdb_dir="$(dirname -- "$(command -v initdb)")"
    if [[ -x "$initdb_dir/pg_ctl" && -x "$initdb_dir/pg_isready" && -x "$initdb_dir/psql" ]]; then
      print -r -- "$initdb_dir"
      return 0
    fi
  fi

  local dir version major best_dir="" best_major=-1
  for dir in /usr/lib/postgresql/*/bin(N); do
    version="${dir:h:t}"
    major="${version%%.*}"
    if [[ "$major" == <-> ]] && (( major > best_major )) && [[ -x "$dir/initdb" ]]; then
      best_major=$major
      best_dir="$dir"
    fi
  done

  if [[ -n "$best_dir" ]]; then
    print -r -- "$best_dir"
    return 0
  fi

  return 1
}

install_postgres_with_apt () {
  local -a apt_cmd_prefix=()
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    if command -v sudo >/dev/null 2>&1; then
      apt_cmd_prefix=(sudo)
    else
      die "apt-get is available but sudo is not. Re-run as root to install PostgreSQL."
    fi
  fi

  log "Installing PostgreSQL with apt-get"
  "${apt_cmd_prefix[@]}" apt-get update
  "${apt_cmd_prefix[@]}" apt-get install -y postgresql postgresql-client
}

resolve_pg_bin_dir () {
  if command -v brew >/dev/null 2>&1; then
    if ! brew list --versions "$POSTGRES_FORMULA" >/dev/null 2>&1; then
      log "Installing $POSTGRES_FORMULA with Homebrew"
      brew install "$POSTGRES_FORMULA"
    fi
    print -r -- "$(brew --prefix "$POSTGRES_FORMULA")/bin"
    return 0
  fi

  local pg_bin_dir
  if pg_bin_dir="$(find_pg_bin_dir)"; then
    print -r -- "$pg_bin_dir"
    return 0
  fi

  if command -v apt-get >/dev/null 2>&1; then
    install_postgres_with_apt
    if pg_bin_dir="$(find_pg_bin_dir)"; then
      print -r -- "$pg_bin_dir"
      return 0
    fi
  fi

  cat >&2 <<'EOF'
Could not find PostgreSQL server binaries (initdb, pg_ctl, pg_isready, psql).

macOS: install Homebrew and rerun this script.
Ubuntu/Debian: sudo apt-get update && sudo apt-get install -y postgresql postgresql-client
EOF
  exit 1
}

build_proxy_export_lines () {
  local var value
  local -a exports=()

  for var in "${proxy_vars[@]}"; do
    if (( ${+parameters[$var]} )); then
      value="${(P)var}"
      exports+=("export $var=${(qqq)value}")
    fi
  done

  print -r -- "${(F)exports}"
}

parse_origin_assignments () {
  local raw_origin="$1"
  python3 - "$raw_origin" <<'PY2'
import shlex
import sys
from urllib.parse import urlparse

raw = sys.argv[1].strip()
if not raw:
    raise SystemExit("Public origin is required.")
parsed = urlparse(raw)
if parsed.scheme not in {"http", "https"}:
    raise SystemExit("Public origin must start with http:// or https://")
if not parsed.netloc:
    raise SystemExit("Public origin must include a host")
if parsed.path not in {"", "/"}:
    raise SystemExit("Public origin must not include a path")
if parsed.params or parsed.query or parsed.fragment:
    raise SystemExit("Public origin must not include params, query, or fragment")
if parsed.username or parsed.password:
    raise SystemExit("Public origin must not include user info")
normalized_origin = f"{parsed.scheme}://{parsed.netloc}"
assignments = {
    "PUBLIC_ORIGIN": normalized_origin,
    "PUBLIC_SCHEME": parsed.scheme,
    "PUBLIC_HOSTPORT": parsed.netloc,
    "PUBLIC_HOST": parsed.hostname or "",
}
for key, value in assignments.items():
    print(f"{key}={shlex.quote(value)}")
PY2
}

save_config () {
  local origin="$1"
  local assignments tmp_config
  ensure_dirs
  assignments="$(parse_origin_assignments "$origin")" || die "Invalid public origin: $origin"
  eval "$assignments"

  tmp_config="$(mktemp "$STATE_DIR/config.zsh.XXXXXX")"
  cat > "$tmp_config" <<EOF
PUBLIC_ORIGIN=${(qqq)PUBLIC_ORIGIN}
PUBLIC_SCHEME=${(qqq)PUBLIC_SCHEME}
PUBLIC_HOSTPORT=${(qqq)PUBLIC_HOSTPORT}
PUBLIC_HOST=${(qqq)PUBLIC_HOST}
EOF
  mv "$tmp_config" "$CONFIG_FILE"
}

load_postgres_identity () {
  if [[ -s "$POSTGRES_IDENTITY_FILE" ]]; then
    source "$POSTGRES_IDENTITY_FILE"
  fi
}

save_postgres_identity () {
  local tmp_identity
  ensure_dirs
  tmp_identity="$(mktemp "$STATE_DIR/postgres-identity.zsh.XXXXXX")"
  cat > "$tmp_identity" <<EOF
POSTGRES_DB=${(qqq)POSTGRES_DB}
POSTGRES_USER=${(qqq)POSTGRES_USER}
EOF
  mv "$tmp_identity" "$POSTGRES_IDENTITY_FILE"
}

load_config () {
  [[ -s "$CONFIG_FILE" ]] || die "Saved config is missing or empty at $CONFIG_FILE. Re-run ./self_host.zsh setup <public-origin> or ./self_host.zsh docker-setup <public-origin>."
  source "$CONFIG_FILE"
  [[ -n "${PUBLIC_ORIGIN:-}" ]] || die "Saved config at $CONFIG_FILE is invalid (missing PUBLIC_ORIGIN). Re-run ./self_host.zsh setup <public-origin> or ./self_host.zsh docker-setup <public-origin>."
  [[ -n "${PUBLIC_HOSTPORT:-}" ]] || die "Saved config at $CONFIG_FILE is invalid (missing PUBLIC_HOSTPORT). Re-run ./self_host.zsh setup <public-origin> or ./self_host.zsh docker-setup <public-origin>."
}

ensure_password () {
  mkdir -p "$POSTGRES_STATE_DIR"
  if [[ ! -f "$POSTGRES_PASSWORD_FILE" ]]; then
    require_command openssl
    openssl rand -hex 24 > "$POSTGRES_PASSWORD_FILE"
    chmod 600 "$POSTGRES_PASSWORD_FILE"
  fi
}

load_runtime_values () {
  PG_BIN_DIR="$(resolve_pg_bin_dir)"
  ensure_password
  POSTGRES_PASSWORD="$(<"$POSTGRES_PASSWORD_FILE")"
  DATABASE_URL_LOCAL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}"
  PROXY_EXPORTS="$(build_proxy_export_lines)"
}

load_docker_runtime_values () {
  ensure_password
  POSTGRES_PASSWORD="$(<"$POSTGRES_PASSWORD_FILE")"
  PROXY_EXPORTS="$(build_proxy_export_lines)"
}

write_runtime_scripts () {
  local postgres_boot_script="$RUNTIME_DIR/postgres_boot.sh"
  local backend_boot_script="$RUNTIME_DIR/backend_boot.sh"
  local frontend_build_script="$RUNTIME_DIR/frontend_build.zsh"
  local frontend_boot_script="$RUNTIME_DIR/frontend_boot.zsh"

  {
    print '#!/usr/bin/env bash'
    print 'set -euo pipefail'
    [[ -n "$PROXY_EXPORTS" ]] && print -r -- "$PROXY_EXPORTS"
    cat <<'EOF'
: "${PG_BIN_DIR:?PG_BIN_DIR is required}"
: "${POSTGRES_STATE_DIR:?POSTGRES_STATE_DIR is required}"
: "${POSTGRES_DATA_DIR:?POSTGRES_DATA_DIR is required}"
: "${POSTGRES_SOCKET_DIR:?POSTGRES_SOCKET_DIR is required}"
: "${POSTGRES_PASSWORD_FILE:?POSTGRES_PASSWORD_FILE is required}"
: "${POSTGRES_LOG_FILE:?POSTGRES_LOG_FILE is required}"
: "${POSTGRES_PORT:?POSTGRES_PORT is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"

export PATH="$PG_BIN_DIR:$PATH"
mkdir -p "$POSTGRES_STATE_DIR" "$POSTGRES_DATA_DIR" "$POSTGRES_SOCKET_DIR"

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
  pg_ctl -D "$POSTGRES_DATA_DIR" -l "$POSTGRES_LOG_FILE" -o "-p $POSTGRES_PORT -h 127.0.0.1 -k $POSTGRES_SOCKET_DIR" start
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
  } > "$postgres_boot_script"
  chmod +x "$postgres_boot_script"

  {
    print '#!/usr/bin/env bash'
    print 'set -euo pipefail'
    [[ -n "$PROXY_EXPORTS" ]] && print -r -- "$PROXY_EXPORTS"
    cat <<'EOF'
: "${BACKEND_DIR:?BACKEND_DIR is required}"
: "${PG_BIN_DIR:?PG_BIN_DIR is required}"
: "${DATABASE_URL_LOCAL:?DATABASE_URL_LOCAL is required}"
: "${POSTGRES_PORT:?POSTGRES_PORT is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${BACKEND_PORT:?BACKEND_PORT is required}"
: "${PUBLIC_ORIGIN:?PUBLIC_ORIGIN is required}"

cd "$BACKEND_DIR"
if [[ -z "${JAVA_HOME:-}" ]]; then
  if command -v /usr/libexec/java_home >/dev/null 2>&1; then
    JAVA_HOME="$(/usr/libexec/java_home -v 17)"
  elif command -v java >/dev/null 2>&1; then
    java_bin="$(readlink -f "$(command -v java)" 2>/dev/null || command -v java)"
    candidate_java_home="$(dirname "$(dirname "$java_bin")")"
    if [[ -x "$candidate_java_home/bin/java" ]]; then
      JAVA_HOME="$candidate_java_home"
    fi
  fi
fi
if [[ -n "${JAVA_HOME:-}" ]]; then
  export JAVA_HOME
  export PATH="$PG_BIN_DIR:$JAVA_HOME/bin:$PATH"
else
  export PATH="$PG_BIN_DIR:$PATH"
fi

export DATABASE_URL="$DATABASE_URL_LOCAL"
export DISABLE_DATABASE_PERSISTENCE=false
export CORS_ALLOWED_ORIGINS="$PUBLIC_ORIGIN"
export PORT="$BACKEND_PORT"
export BIND_HOST=127.0.0.1
unset DEBUG_MODE || true

until pg_isready -h 127.0.0.1 -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres >/dev/null 2>&1; do
  sleep 1
done

exec bash -lc './gradlew run'
EOF
  } > "$backend_boot_script"
  chmod +x "$backend_boot_script"

  {
    print '#!/usr/bin/env zsh'
    print 'set -euo pipefail'
    [[ -n "$PROXY_EXPORTS" ]] && print -r -- "$PROXY_EXPORTS"
    cat <<'EOF'
: "${FRONTEND_DIR:?FRONTEND_DIR is required}"
: "${NODE_VERSION:?NODE_VERSION is required}"
: "${PUBLIC_ORIGIN:?PUBLIC_ORIGIN is required}"

cd "$FRONTEND_DIR"
if command -v nvm-load >/dev/null 2>&1; then
  nvm-load
fi
if ! command -v nvm >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    . "$NVM_DIR/nvm.sh"
  fi
fi
command -v nvm >/dev/null 2>&1 || {
  echo "nvm is required. Install it, then rerun this command." >&2
  exit 1
}
nvm use "$NODE_VERSION"
npm ci --include=dev
UNLOCK_ALL_P="$UNLOCK_ALL_P" REACT_APP_UNLOCK_ALL_P="$UNLOCK_ALL_P" REACT_APP_CLIENT_ORIGIN="$PUBLIC_ORIGIN" npm run build
EOF
  } > "$frontend_build_script"
  chmod +x "$frontend_build_script"

  {
    print '#!/usr/bin/env zsh'
    print 'set -euo pipefail'
    [[ -n "$PROXY_EXPORTS" ]] && print -r -- "$PROXY_EXPORTS"
    cat <<'EOF'
: "${FRONTEND_DIR:?FRONTEND_DIR is required}"
: "${NODE_VERSION:?NODE_VERSION is required}"
: "${FRONTEND_PORT:?FRONTEND_PORT is required}"

cd "$FRONTEND_DIR"
if command -v nvm-load >/dev/null 2>&1; then
  nvm-load
fi
if ! command -v nvm >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    . "$NVM_DIR/nvm.sh"
  fi
fi
command -v nvm >/dev/null 2>&1 || {
  echo "nvm is required. Install it, then rerun this command." >&2
  exit 1
}
nvm use "$NODE_VERSION"
[[ -d build ]] || {
  echo "Missing frontend build output. Run ./self_host.zsh redeploy first." >&2
  exit 1
}
exec node scripts/serve-build.js --host 127.0.0.1 --port "$FRONTEND_PORT"
EOF
  } > "$frontend_boot_script"
  chmod +x "$frontend_boot_script"

  POSTGRES_BOOT_SCRIPT="$postgres_boot_script"
  BACKEND_BOOT_SCRIPT="$backend_boot_script"
  FRONTEND_BUILD_SCRIPT="$frontend_build_script"
  FRONTEND_BOOT_SCRIPT="$frontend_boot_script"
}

write_caddy_block () {
  local backup_file
  local previous_exists=0
  local caddy_status

  mkdir -p "$(dirname -- "$CADDYFILE")"
  backup_file="$STATE_DIR/Caddyfile.backup.$(date +%Y%m%d%H%M%S)"
  if [[ -f "$CADDYFILE" ]]; then
    cp "$CADDYFILE" "$backup_file"
    previous_exists=1
  else
    : > "$backup_file"
  fi

  if ! caddy_status="$(python3 - "$CADDYFILE" "$PUBLIC_HOSTPORT" "$BEGIN_MARKER" "$END_MARKER" "$BACKEND_PORT" "$FRONTEND_PORT" <<'PY2'
import pathlib
import re
import sys

caddyfile = pathlib.Path(sys.argv[1]).expanduser()
host = sys.argv[2]
begin_marker = sys.argv[3]
end_marker = sys.argv[4]
backend_port = sys.argv[5]
frontend_port = sys.argv[6]

managed_block = f"""{begin_marker}\n{host} {{\n\tencode zstd gzip\n\n\t@secret_hitler_backend path /check-login /new-lobby /ping /game /game/*\n\thandle @secret_hitler_backend {{\n\t\treverse_proxy 127.0.0.1:{backend_port}\n\t}}\n\n\thandle {{\n\t\treverse_proxy 127.0.0.1:{frontend_port}\n\t}}\n}}\n{end_marker}\n"""

text = caddyfile.read_text() if caddyfile.exists() else ""
status = "appended"

if begin_marker in text or end_marker in text:
    if begin_marker not in text or end_marker not in text:
        raise SystemExit("Managed Caddy block markers are incomplete; fix the file manually before rerunning.")
    pattern = re.compile(re.escape(begin_marker) + r"\n.*?\n" + re.escape(end_marker) + r"\n?", re.S)
    text, count = pattern.subn(managed_block, text, count=1)
    if count != 1:
        raise SystemExit("Could not replace the existing managed Caddy block.")
    status = "replaced"
else:
    lines = text.splitlines(keepends=True)
    host_pattern = re.compile(rf"^\s*{re.escape(host)}\s*\{{\s*$")
    candidates = []
    i = 0
    while i < len(lines):
        if host_pattern.match(lines[i]):
            depth = lines[i].count("{") - lines[i].count("}")
            j = i + 1
            while j < len(lines) and depth > 0:
                depth += lines[j].count("{") - lines[j].count("}")
                j += 1
            block = "".join(lines[i:j])
            if f"reverse_proxy 127.0.0.1:{backend_port}" in block and f"reverse_proxy 127.0.0.1:{frontend_port}" in block:
                candidates.append((i, j))
            i = j
        else:
            i += 1

    if len(candidates) > 1:
        raise SystemExit(f"Found multiple legacy Caddy blocks for {host}; migrate them manually before rerunning.")
    if len(candidates) == 1:
        start, end = candidates[0]
        lines[start:end] = [managed_block]
        text = "".join(lines)
        status = "migrated"
    else:
        if text and not text.endswith("\n"):
            text += "\n"
        if text:
            text += "\n"
        text += managed_block
        status = "appended"

caddyfile.write_text(text)
print(status)
PY2
)"; then
    if (( previous_exists )); then
      cp "$backup_file" "$CADDYFILE"
    else
      rm -f "$CADDYFILE"
    fi
    die "Failed to update $CADDYFILE"
  fi

  log "Caddyfile update status: $caddy_status"
  if ! caddy validate --config "$CADDYFILE" --adapter caddyfile; then
    if (( previous_exists )); then
      cp "$backup_file" "$CADDYFILE"
    else
      rm -f "$CADDYFILE"
    fi
    die "Caddy validation failed; restored the previous $CADDYFILE"
  fi

  if is_truthy "$SKIP_CADDY_RELOAD"; then
    log "Skipping Caddy reload because SELF_HOST_SKIP_CADDY_RELOAD=$SKIP_CADDY_RELOAD"
    return 0
  fi

  if ! caddy reload --config "$CADDYFILE" --adapter caddyfile; then
    log "Caddy reload failed after a successful validation. You can reload manually with: caddy reload --config $CADDYFILE --adapter caddyfile"
  fi
}

start_postgres_session () {
  tmuxnew "$POSTGRES_SESSION" "env PG_BIN_DIR='$PG_BIN_DIR' POSTGRES_STATE_DIR='$POSTGRES_STATE_DIR' POSTGRES_DATA_DIR='$POSTGRES_DATA_DIR' POSTGRES_SOCKET_DIR='$POSTGRES_SOCKET_DIR' POSTGRES_PASSWORD_FILE='$POSTGRES_PASSWORD_FILE' POSTGRES_LOG_FILE='$POSTGRES_LOG_FILE' POSTGRES_PORT='$POSTGRES_PORT' POSTGRES_DB='$POSTGRES_DB' POSTGRES_USER='$POSTGRES_USER' bash '$POSTGRES_BOOT_SCRIPT'"
}

start_backend_session () {
  tmuxnew "$BACKEND_SESSION" "env BACKEND_DIR='$BACKEND_DIR' PG_BIN_DIR='$PG_BIN_DIR' DATABASE_URL_LOCAL='$DATABASE_URL_LOCAL' POSTGRES_PORT='$POSTGRES_PORT' POSTGRES_USER='$POSTGRES_USER' BACKEND_PORT='$BACKEND_PORT' PUBLIC_ORIGIN='$PUBLIC_ORIGIN' bash '$BACKEND_BOOT_SCRIPT'"
}

start_frontend_session () {
  tmuxnew "$FRONTEND_SESSION" "env FRONTEND_DIR='$FRONTEND_DIR' NODE_VERSION='$NODE_VERSION' FRONTEND_PORT='$FRONTEND_PORT' zsh '$FRONTEND_BOOT_SCRIPT'"
}

print_local_attach_help () {
  cat <<EOF
Started tmux sessions:
  - $POSTGRES_SESSION
  - $BACKEND_SESSION
  - $FRONTEND_SESSION

Attach with:
  tmux attach -t $POSTGRES_SESSION
  tmux attach -t $BACKEND_SESSION
  tmux attach -t $FRONTEND_SESSION
EOF
}

run_frontend_build () {
  log "Building frontend"
  env FRONTEND_DIR="$FRONTEND_DIR" NODE_VERSION="$NODE_VERSION" PUBLIC_ORIGIN="$PUBLIC_ORIGIN" UNLOCK_ALL_P="$UNLOCK_ALL_P" zsh "$FRONTEND_BUILD_SCRIPT"
}

start_local_stack () {
  log "Starting self-hosted services in tmux"
  start_postgres_session
  start_backend_session
  start_frontend_session
  print_local_attach_help
}

stop_local_stack () {
  load_config
  load_runtime_values

  tmux kill-session -t "$FRONTEND_SESSION" &>/dev/null || true
  tmux kill-session -t "$BACKEND_SESSION" &>/dev/null || true
  tmux kill-session -t "$POSTGRES_SESSION" &>/dev/null || true

  if [[ -f "$POSTGRES_DATA_DIR/PG_VERSION" ]] && "$PG_BIN_DIR/pg_ctl" -D "$POSTGRES_DATA_DIR" status >/dev/null 2>&1; then
    log "Stopping PostgreSQL"
    "$PG_BIN_DIR/pg_ctl" -D "$POSTGRES_DATA_DIR" stop
  fi
}

stop_docker_stack_internal () {
  if command -v docker >/dev/null 2>&1 && [[ -f "$DOCKER_COMPOSE_FILE" ]]; then
    load_docker_runtime_values
    eval "$(build_docker_command 'down --remove-orphans')" >/dev/null 2>&1 || true
  fi
  tmux kill-session -t "$DOCKER_SESSION" &>/dev/null || true
}

migrate_docker_postgres_to_local () {
  command -v docker >/dev/null 2>&1 || return 0
  docker_postgres_volume_has_data || return 0

  log "Migrating Docker PostgreSQL data into local self-hosted state"
  local volume_name
  volume_name="$(docker_postgres_volume_name)"
  local source_port target_port
  source_port="$(pick_free_tcp_port)"
  target_port="$(pick_free_tcp_port)"
  while [[ "$target_port" == "$source_port" ]]; do
    target_port="$(pick_free_tcp_port)"
  done

  local source_container="secret-hitler-postgres-migrate-source-$$"
  local target_data_dir="$POSTGRES_STATE_DIR/migrate-local-data"
  local target_socket_dir="$POSTGRES_STATE_DIR/migrate-local-socket"
  local target_log_file="$POSTGRES_STATE_DIR/migrate-local.log"
  local source_user source_db

  backup_directory_if_present "$POSTGRES_DATA_DIR" "docker-import"
  rm -rf "$target_data_dir" "$target_socket_dir"

  {
    start_temp_docker_postgres "$volume_name" "$source_port" "$source_container"
    source_user="$(detect_docker_postgres_user "$source_container")" || die "Could not determine the PostgreSQL role used by the Docker volume."
    source_db="$(detect_docker_postgres_db "$source_container" "$source_user")"

    POSTGRES_USER="$source_user"
    POSTGRES_DB="$source_db"
    save_postgres_identity

    init_local_postgres_cluster "$target_data_dir" "$target_log_file" "$target_socket_dir"
    start_local_postgres_temp "$target_data_dir" "$target_log_file" "$target_socket_dir" "$target_port"

    docker exec "$source_container" env PGPASSWORD="$POSTGRES_PASSWORD" \
      pg_dump -h 127.0.0.1 -p 5432 -U "$source_user" -d "$source_db" --clean --if-exists --create --no-owner --no-privileges \
      | PGPASSWORD="$POSTGRES_PASSWORD" "$PG_BIN_DIR/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$target_port" -U "$POSTGRES_USER" -d postgres >/dev/null

    stop_local_postgres_temp "$target_data_dir"
    rm -rf "$POSTGRES_DATA_DIR"
    mv "$target_data_dir" "$POSTGRES_DATA_DIR"
    mkdir -p "$POSTGRES_SOCKET_DIR"
    ensure_tree_owned_by_current_user "$POSTGRES_STATE_DIR"
  } always {
    stop_local_postgres_temp "$target_data_dir"
    docker rm -f "$source_container" >/dev/null 2>&1 || true
    rm -rf "$target_socket_dir"
    [[ -d "$target_data_dir" ]] && rm -rf "$target_data_dir"
  }
}

migrate_local_postgres_to_docker () {
  command -v docker >/dev/null 2>&1 || return 0
  local_postgres_data_has_data || return 0

  log "Migrating local PostgreSQL data into Docker volume"
  local volume_name
  volume_name="$(docker_postgres_volume_name)"
  local source_port target_port
  source_port="$(pick_free_tcp_port)"
  target_port="$(pick_free_tcp_port)"
  while [[ "$target_port" == "$source_port" ]]; do
    target_port="$(pick_free_tcp_port)"
  done

  local source_socket_dir="$POSTGRES_STATE_DIR/migrate-local-source-socket"
  local source_log_file="$POSTGRES_STATE_DIR/migrate-local-source.log"
  local target_container="secret-hitler-postgres-migrate-target-$$"

  docker_volume_backup_if_present "$volume_name" "local-export"
  clear_docker_volume "$volume_name"
  rm -rf "$source_socket_dir"

  {
    start_local_postgres_temp "$POSTGRES_DATA_DIR" "$source_log_file" "$source_socket_dir" "$source_port"
    start_temp_docker_postgres "$volume_name" "$target_port" "$target_container"

    PGPASSWORD="$POSTGRES_PASSWORD" "$PG_BIN_DIR/pg_dump" -h 127.0.0.1 -p "$source_port" -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --create \
      | docker exec -i "$target_container" env PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -U "$POSTGRES_USER" -d postgres >/dev/null
  } always {
    stop_local_postgres_temp "$POSTGRES_DATA_DIR"
    docker rm -f "$target_container" >/dev/null 2>&1 || true
    rm -rf "$source_socket_dir"
  }
}

switch_to_local_mode () {
  local previous_mode
  previous_mode="$(read_mode)"

  if [[ "$previous_mode" == "docker" ]] || tmux has-session -t "$DOCKER_SESSION" &>/dev/null || docker_stack_has_runtime \
    || { [[ -z "$previous_mode" ]] && docker_postgres_volume_has_data; }; then
    log "Switching self-hosting mode from Docker to local tmux services"
    stop_docker_stack_internal
    migrate_docker_postgres_to_local
  fi

  repair_local_runtime_permissions
  save_postgres_identity
  write_mode "local"
}

switch_to_docker_mode () {
  local previous_mode
  previous_mode="$(read_mode)"

  if [[ "$previous_mode" == "local" ]] || tmux has-session -t "$POSTGRES_SESSION" &>/dev/null \
    || tmux has-session -t "$BACKEND_SESSION" &>/dev/null || tmux has-session -t "$FRONTEND_SESSION" &>/dev/null \
    || { [[ -z "$previous_mode" ]] && local_postgres_data_has_data; }; then
    log "Switching self-hosting mode from local tmux services to Docker"
    stop_local_stack
    migrate_local_postgres_to_docker
  fi

  sync_postgres_identity_from_docker_volume
  save_postgres_identity
  write_mode "docker"
}

ensure_docker_requirements () {
  require_command docker
  docker compose version >/dev/null 2>&1 || die "docker compose is required"
  [[ -f "$DOCKER_COMPOSE_FILE" ]] || die "Missing Docker Compose file: $DOCKER_COMPOSE_FILE"
}

build_docker_command () {
  local compose_args="$1"
  cat <<EOF
cd '$ROOT_DIR'
${PROXY_EXPORTS}
export UNLOCK_ALL_P='${UNLOCK_ALL_P}'
export REACT_APP_UNLOCK_ALL_P='${UNLOCK_ALL_P}'
export REACT_APP_CLIENT_ORIGIN='${PUBLIC_ORIGIN}'
export REACT_APP_SERVER_ADDRESS=''
export REACT_APP_SERVER_ADDRESS_HTTP=''
export REACT_APP_WEBSOCKET_HEADER=''
export CORS_ALLOWED_ORIGINS='${PUBLIC_ORIGIN}'
export BACKEND_PORT='${BACKEND_PORT}'
export FRONTEND_PORT='${FRONTEND_PORT}'
export POSTGRES_DB='${POSTGRES_DB}'
export POSTGRES_USER='${POSTGRES_USER}'
export POSTGRES_PASSWORD='${POSTGRES_PASSWORD}'
export DOCKER_POSTGRES_VOLUME_NAME='$(docker_postgres_volume_name)'
export DATABASE_URL='postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}'
docker compose -f '$DOCKER_COMPOSE_FILE' ${compose_args}
EOF
}

start_docker_stack () {
  local compose_args="$1"
  local command_string
  command_string="$(build_docker_command "$compose_args")"
  tmuxnew "$DOCKER_SESSION" "$command_string"
  cat <<EOF
Started Docker tmux session:
  - $DOCKER_SESSION

Attach with:
  tmux attach -t $DOCKER_SESSION
EOF
}

handle_setup () {
  local origin="$1"
  require_command tmux
  require_command caddy
  require_command python3
  save_config "$origin"
  load_config
  ensure_dirs
  load_postgres_identity
  load_runtime_values
  switch_to_local_mode
  load_runtime_values
  write_runtime_scripts
  write_caddy_block
  run_frontend_build
  if ! is_truthy "$SKIP_START"; then
    start_local_stack
  else
    log "Skipping service start because SELF_HOST_SKIP_START=$SKIP_START"
  fi
}

handle_redeploy () {
  require_command tmux
  require_command python3
  load_config
  ensure_dirs
  load_postgres_identity
  load_runtime_values
  switch_to_local_mode
  load_runtime_values
  write_runtime_scripts
  run_frontend_build
  if ! is_truthy "$SKIP_START"; then
    start_local_stack
  else
    log "Skipping service start because SELF_HOST_SKIP_START=$SKIP_START"
  fi
}

handle_start () {
  require_command tmux
  load_config
  ensure_dirs
  load_postgres_identity
  load_runtime_values
  switch_to_local_mode
  load_runtime_values
  write_runtime_scripts
  [[ -d "$FRONTEND_DIR/build" ]] || die "Missing frontend build output. Run ./self_host.zsh redeploy first."
  start_local_stack
}

handle_docker_setup () {
  local origin="$1"
  require_command tmux
  require_command caddy
  require_command python3
  ensure_docker_requirements
  save_config "$origin"
  load_config
  ensure_dirs
  load_postgres_identity
  load_docker_runtime_values
  switch_to_docker_mode
  load_docker_runtime_values
  write_caddy_block
  if ! is_truthy "$SKIP_START"; then
    start_docker_stack "up --build --force-recreate --remove-orphans"
  else
    log "Skipping Docker start because SELF_HOST_SKIP_START=$SKIP_START"
  fi
}

handle_docker_redeploy () {
  require_command tmux
  ensure_docker_requirements
  load_config
  ensure_dirs
  load_postgres_identity
  load_docker_runtime_values
  switch_to_docker_mode
  load_docker_runtime_values
  if ! is_truthy "$SKIP_START"; then
    start_docker_stack "up --build --force-recreate --remove-orphans"
  else
    log "Skipping Docker start because SELF_HOST_SKIP_START=$SKIP_START"
  fi
}

handle_docker_start () {
  require_command tmux
  ensure_docker_requirements
  load_config
  ensure_dirs
  load_postgres_identity
  load_docker_runtime_values
  switch_to_docker_mode
  load_docker_runtime_values
  start_docker_stack "up --remove-orphans"
}

handle_docker_stop () {
  ensure_docker_requirements
  load_config
  ensure_dirs
  load_postgres_identity
  load_docker_runtime_values
  eval "$(build_docker_command 'down --remove-orphans')"
  tmux kill-session -t "$DOCKER_SESSION" &>/dev/null || true
}

main () {
  local command="${1:-}"

  case "$command" in
    setup)
      [[ $# -eq 2 ]] || die "setup requires exactly one <public-origin> argument"
      handle_setup "$2"
      ;;
    redeploy)
      [[ $# -eq 1 ]] || die "redeploy takes no additional arguments"
      handle_redeploy
      ;;
    start)
      [[ $# -eq 1 ]] || die "start takes no additional arguments"
      handle_start
      ;;
    stop)
      [[ $# -eq 1 ]] || die "stop takes no additional arguments"
      stop_local_stack
      ;;
    docker-setup)
      [[ $# -eq 2 ]] || die "docker-setup requires exactly one <public-origin> argument"
      handle_docker_setup "$2"
      ;;
    docker-redeploy)
      [[ $# -eq 1 ]] || die "docker-redeploy takes no additional arguments"
      handle_docker_redeploy
      ;;
    docker-start)
      [[ $# -eq 1 ]] || die "docker-start takes no additional arguments"
      handle_docker_start
      ;;
    docker-stop)
      [[ $# -eq 1 ]] || die "docker-stop takes no additional arguments"
      handle_docker_stop
      ;;
    -h|--help|help|"")
      usage
      ;;
    *)
      die "Unknown command: $command"
      ;;
  esac
}

main "$@"

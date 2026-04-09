#!/usr/bin/env zsh

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd -- "$(dirname -- "$0")" && pwd -P)}"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
STATE_DIR="${SELF_HOST_STATE_DIR:-$ROOT_DIR/.local/self-hosting}"
RUNTIME_DIR="$STATE_DIR/runtime"
CONFIG_FILE="$STATE_DIR/config.zsh"
CADDYFILE="${SELF_HOST_CADDYFILE:-$HOME/Caddyfile}"
NODE_VERSION="${SELF_HOST_NODE_VERSION:-16.20.2}"
POSTGRES_FORMULA="${POSTGRES_FORMULA:-postgresql@16}"
POSTGRES_PORT="${SELF_HOST_POSTGRES_PORT:-54339}"
POSTGRES_DB="${SELF_HOST_POSTGRES_DB:-secret_hitler_self_host}"
POSTGRES_USER="${SELF_HOST_POSTGRES_USER:-secret_hitler}"
POSTGRES_STATE_DIR="$STATE_DIR/postgres"
POSTGRES_DATA_DIR="$POSTGRES_STATE_DIR/data"
POSTGRES_PASSWORD_FILE="$POSTGRES_STATE_DIR/password.txt"
POSTGRES_LOG_FILE="$POSTGRES_STATE_DIR/postgres.log"
BACKEND_PORT="${SELF_HOST_BACKEND_PORT:-4040}"
FRONTEND_PORT="${SELF_HOST_FRONTEND_PORT:-6010}"
UNLOCK_ALL_P="${UNLOCK_ALL_P:-true}"
DOCKER_COMPOSE_FILE="${SELF_HOST_DOCKER_COMPOSE_FILE:-$ROOT_DIR/docker-compose.secrethitler.prod.yml}"
BEGIN_MARKER="# BEGIN Secret-Hitler-Online managed by self_host.zsh"
END_MARKER="# END Secret-Hitler-Online managed by self_host.zsh"
POSTGRES_SESSION="secret-hitler-postgres"
BACKEND_SESSION="secret-hitler-backend"
FRONTEND_SESSION="secret-hitler-frontend"
DOCKER_SESSION="secret-hitler-docker"
SKIP_START="${SELF_HOST_SKIP_START:-0}"
SKIP_CADDY_RELOAD="${SELF_HOST_SKIP_CADDY_RELOAD:-0}"

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

ensure_dirs () {
  mkdir -p "$STATE_DIR" "$RUNTIME_DIR" "$POSTGRES_STATE_DIR" "$POSTGRES_DATA_DIR"
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
  tmuxnew "$POSTGRES_SESSION" "env PG_BIN_DIR='$PG_BIN_DIR' POSTGRES_STATE_DIR='$POSTGRES_STATE_DIR' POSTGRES_DATA_DIR='$POSTGRES_DATA_DIR' POSTGRES_PASSWORD_FILE='$POSTGRES_PASSWORD_FILE' POSTGRES_LOG_FILE='$POSTGRES_LOG_FILE' POSTGRES_PORT='$POSTGRES_PORT' POSTGRES_DB='$POSTGRES_DB' POSTGRES_USER='$POSTGRES_USER' bash '$POSTGRES_BOOT_SCRIPT'"
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
  load_docker_runtime_values
  start_docker_stack "up --remove-orphans"
}

handle_docker_stop () {
  ensure_docker_requirements
  load_config
  ensure_dirs
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

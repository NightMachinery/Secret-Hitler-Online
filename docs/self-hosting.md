# Self-hosting

Use `./self_host.zsh` to run this project behind Caddy at a user-supplied public origin.

## What it does

- Saves your public origin once during `setup`
- Manages a marked Secret-Hitler block in `~/Caddyfile`
- Runs normal self-hosting with tmux-managed local processes:
  - PostgreSQL on `127.0.0.1:54339`
  - backend on `127.0.0.1:4040`
  - frontend on `127.0.0.1:6010`
- Provides separate Docker-only commands when you explicitly want Docker

`redeploy` always uses the latest **local** working tree. It does **not** pull from git.

## Prerequisites

Normal mode:

- `tmux`
- `caddy`
- `python3`
- Java 17+
- `nvm` with Node `16.20.2` installed
- PostgreSQL binaries (`initdb`, `pg_ctl`, `psql`, `pg_isready`)
  - the script will try to install PostgreSQL with Homebrew or `apt-get` if needed

Docker mode:

- `tmux`
- `caddy`
- Docker with `docker compose`

## URL format

Pass a full origin with scheme, and no path/query/fragment.

Valid examples:

- `https://example.com`
- `https://play.example.com`
- `http://example.com:8080`

Invalid examples:

- `example.com`
- `https://example.com/game`
- `https://example.com?x=1`

## Normal self-hosting commands

Initial setup:

```bash
./self_host.zsh setup https://example.com
```

After setup:

```bash
./self_host.zsh redeploy
./self_host.zsh start
./self_host.zsh stop
```

Behavior:

- `setup`
  - saves the public origin
  - updates `~/Caddyfile`
  - validates the Caddyfile with the Caddyfile adapter
  - reloads Caddy
  - installs frontend dependencies and builds the frontend
  - starts tmux sessions
- `redeploy`
  - rebuilds from current local source
  - restarts the tmux-managed services
- `start`
  - starts services from the saved config without rebuilding
- `stop`
  - stops tmux sessions
  - stops the local PostgreSQL server with `pg_ctl`

### tmux sessions

Normal mode uses these sessions:

- `secret-hitler-postgres`
- `secret-hitler-backend`
- `secret-hitler-frontend`

Attach to logs with:

```bash
tmux attach -t secret-hitler-postgres
tmux attach -t secret-hitler-backend
tmux attach -t secret-hitler-frontend
```

## Docker commands

Docker is intentionally separate from the default self-host flow.

Initial Docker setup:

```bash
./self_host.zsh docker-setup https://example.com
```

After setup:

```bash
./self_host.zsh docker-redeploy
./self_host.zsh docker-start
./self_host.zsh docker-stop
```

Behavior:

- `docker-setup`
  - saves the public origin
  - updates `~/Caddyfile`
  - validates/reloads Caddy with the Caddyfile adapter
  - starts `docker compose up --build --force-recreate --remove-orphans` in tmux
- `docker-redeploy`
  - reruns the Docker stack from the current local working tree
- `docker-start`
  - starts the Docker stack without the rebuild/recreate flags
- `docker-stop`
  - runs `docker compose down --remove-orphans`
  - stops the Docker tmux session

Docker logs run in:

- `secret-hitler-docker`

Attach with:

```bash
tmux attach -t secret-hitler-docker
```

## Caddy management

`setup` and `docker-setup` manage a marked block in `~/Caddyfile`.

Managed markers:

```text
# BEGIN Secret-Hitler-Online managed by self_host.zsh
# END Secret-Hitler-Online managed by self_host.zsh
```

The generated block routes:

- `/check-login`, `/new-lobby`, `/ping`, `/game`, `/game/*` to `127.0.0.1:4040`
- everything else to `127.0.0.1:6010`

The script will:

- replace the existing managed block if present
- migrate one matching legacy manual block for the same host if present
- append a new managed block otherwise

If validation fails, the previous `~/Caddyfile` is restored.

## Proxy passthrough

The script does not hardcode proxy settings.

If proxy variables already exist in the shell environment when you invoke `self_host.zsh`, they are forwarded into the build/runtime commands. This includes common upper/lower-case proxy names and npm proxy variables, for example:

```bash
export ALL_PROXY=http://127.0.0.1:9087
export all_proxy=http://127.0.0.1:9087
export http_proxy=http://127.0.0.1:9087
export https_proxy=http://127.0.0.1:9087
export HTTP_PROXY=http://127.0.0.1:9087
export HTTPS_PROXY=http://127.0.0.1:9087
export npm_config_proxy=http://127.0.0.1:9087
export npm_config_https_proxy=http://127.0.0.1:9087
```

Then run the script normally:

```bash
./self_host.zsh setup https://example.com
```

## Notes

- The frontend build bakes in `REACT_APP_CLIENT_ORIGIN` for public metadata.
- API and websocket traffic use same-origin browser fallbacks behind Caddy.
- Local self-hosting state is stored under `.local/self-hosting/`.

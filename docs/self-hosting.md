# Self-hosting

Use `./self_host.zsh` to run this project behind Caddy at a user-supplied public origin.

The supported production path is the self-host flow in this document. Legacy Heroku-specific backend build artifacts have been removed, and Docker mode uses the normal Gradle application entrypoint.

## What it does

- Saves your public origin once during `setup`
- Manages a marked Secret-Hitler block in `~/Caddyfile`
- Uses the browser's current origin for invite/share URLs in the shipped frontend, so no public app URL is hardcoded into tracked frontend source files
- Runs normal self-hosting with tmux-managed local processes:
  - PostgreSQL on `127.0.0.1:54339`
  - backend on `127.0.0.1:4040`
  - frontend on `127.0.0.1:6010`
  - production-style local mode (`start` / `redeploy`) serves the built frontend with `serve-build.js` and runs backend Gradle `run`
  - development local mode (`dev-start`) serves the frontend with the React dev server and runs backend Gradle `runLocal`
- Provides separate Docker-only commands when you explicitly want Docker
- Automatically switches modes:
  - starting local mode stops the Docker stack first
  - starting Docker mode stops the tmux-managed local stack first
  - PostgreSQL data is migrated across modes during the switch
- Repairs common ownership issues left behind by Docker-managed artifacts before starting local mode

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
./self_host.zsh dev-start
./self_host.zsh stop
```

Behavior:

- `setup`
  - saves the public origin
  - updates `~/Caddyfile`
  - validates the Caddyfile with the Caddyfile adapter
  - reloads Caddy
  - installs frontend dependencies and builds the frontend
  - stops any currently running local tmux stack first
  - starts the production-style tmux sessions
  - if a Docker-based self-host already exists, stops it and migrates its PostgreSQL data into local mode
- `redeploy`
  - rebuilds from current local source
  - stops any currently running local tmux stack first
  - restarts the production-style tmux-managed services
  - if the previous active mode was Docker, stops it and migrates PostgreSQL first
- `start`
  - stops any currently running local tmux stack first
  - starts production-style services from the saved config without rebuilding
  - frontend must already have `frontend/build`
  - if the previous active mode was Docker, stops it and migrates PostgreSQL first
- `dev-start`
  - stops any currently running local tmux stack first
  - starts the backend with `./gradlew runLocal`
  - starts the frontend with the React dev server behind Caddy at the saved public origin
  - does not require an existing `frontend/build`
  - installs frontend dependencies first only when `frontend/node_modules` is missing
  - backend Java changes still require a manual restart
  - if the previous active mode was Docker, stops it and migrates PostgreSQL first
- `stop`
  - stops tmux sessions for whichever local mode is active (`start` or `dev-start`)
  - stops the local PostgreSQL server with `pg_ctl`

`setup`, `redeploy`, `start`, and `dev-start` all stop the current local stack before continuing. That means switching between production-style local mode and development local mode is deterministic:

- `start` after `dev-start` replaces the React dev server with the static built frontend
- `dev-start` after `start` replaces the static frontend/backend runtime with the dev server + `runLocal`
- `redeploy` after `dev-start` stops the dev stack, rebuilds the frontend, then brings the production-style local stack back up
- if `SELF_HOST_SKIP_START=1`, the command still does its prep/build work but leaves the local stack stopped

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
  - stops the local tmux-managed stack if it is active
  - migrates PostgreSQL data from local mode into Docker mode
  - starts `docker compose up --build --force-recreate --remove-orphans` in tmux
- `docker-redeploy`
  - reruns the Docker stack from the current local working tree
  - stops the local tmux-managed stack if it is active
  - migrates PostgreSQL data from local mode into Docker mode
- `docker-start`
  - starts the Docker stack without the rebuild/recreate flags
  - stops the local tmux-managed stack if it is active
  - migrates PostgreSQL data from local mode into Docker mode
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

For local backend startup, `self_host.zsh` also translates `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` into JVM proxy flags for Gradle automatically, so Gradle dependency downloads use the same proxy path.

Those proxy values are handed into the tmux-managed local sessions as literal environment values, so `start` / `dev-start` also work with `NO_PROXY` lists such as `127.0.0.1,localhost,::1`.

For backend startup visibility, self-hosting runs Gradle with verbose logging by default (`--console=plain --info`). You can override that with `SELF_HOST_BACKEND_GRADLE_ARGS`, for example:

```bash
export SELF_HOST_BACKEND_GRADLE_ARGS="--console=plain --debug"
./self_host.zsh start
```

## Notes

- The frontend build bakes in `REACT_APP_CLIENT_ORIGIN` for public metadata.
- API and websocket traffic use same-origin browser fallbacks behind Caddy.
- `dev-start` keeps that same-origin/Caddy routing, but serves the frontend from the React dev server for hot reload.
- Local self-hosting state is stored under `.local/self-hosting/`.
- The script remembers the effective PostgreSQL role/database names under `.local/self-hosting/` so mode switches keep using the same app database identity.
- If Docker mode already has a PostgreSQL volume, the script re-detects that role/database identity before starting the stack.
- If you override `SELF_HOST_DOCKER_POSTGRES_VOLUME`, the Docker Compose stack uses that same volume name.

# Development setup for Secret Hitler Online

## Quick start using Docker:
- Run everything with Docker Compose (DB + backend + frontend):
  - `DOCKER_UID=$(id -u) DOCKER_GID=$(id -g) docker compose up --build`
  - Open frontend: [http://localhost:3000](http://localhost:3000)
  - Backend health: [http://localhost:4040/ping](http://localhost:4040/ping)
- Alternative: only DB in Docker, run app locally:
  - `docker compose up -d db`  (or use docker run …)
  - `export DATABASE_URL=postgres://secret:secret@localhost:5432/secrethitler`
  - In backend/: `./gradlew runLocal`
  - In frontend/: `npm install && npm run devLocal`
  - Open frontend: [http://localhost:3000](http://localhost:3000)

## Public self-hosting (production)

Preferred workflow: use `./self_host.zsh` as documented in `docs/self-hosting.md`. The legacy compose notes below are still useful as reference, but the script-based flow is the supported path.

The backend no longer carries Heroku-specific Gradle/plugin wiring; public hosting should use the self-host or Fly.io flows documented in this repo.

Use `docker-compose.prod.yml` when running a public instance.

- Start the production stack:
  - `DOCKER_UID=$(id -u) DOCKER_GID=$(id -g) docker compose -f docker-compose.prod.yml up --build -d`
- Default public frontend URL in that file:
  - `http://example.com:6010`
- Default backend URL in that file:
  - `http://example.com:4040`

If you want to host this behind `http://1.2.3.4:6010`, run:

```bash
(
export REACT_APP_CLIENT_ORIGIN=http://1.2.3.4:6010
export CORS_ALLOWED_ORIGINS=http://1.2.3.4:6010
export REACT_APP_SERVER_ADDRESS=1.2.3.4:4040
export REACT_APP_SERVER_ADDRESS_HTTP=http://1.2.3.4:4040
docker compose -f docker-compose.prod.yml up --build -d
)
```

To avoid root-owned backend Gradle artifacts on Linux, also pass your host UID/GID:

```bash
(
export DOCKER_UID="$(id -u)"
export DOCKER_GID="$(id -g)"
docker compose -f docker-compose.prod.yml up --build -d
)
```

If your server can only reach package registries through a local proxy (for example, on the host at `0.0.0.0:1087`), run:

```bash
(
export HTTP_PROXY=http://host.docker.internal:1087
export HTTPS_PROXY=http://host.docker.internal:1087
export NO_PROXY=localhost,127.0.0.1,db,backend,frontend,host.docker.internal
export GRADLE_OPTS="-Dhttp.proxyHost=host.docker.internal -Dhttp.proxyPort=1087 -Dhttps.proxyHost=host.docker.internal -Dhttps.proxyPort=1087"
docker compose -f docker-compose.prod.yml up --build -d
)
```

Notes:
- `host.docker.internal` points from container to host (mapped with `host-gateway` in compose).
- Your host proxy must listen on `0.0.0.0:1087`; containers use `host.docker.internal:1087`.
- If `ufw` is enabled, allow Docker bridge subnets to reach the proxy port:
  - `sudo ufw allow from 172.16.0.0/12 to any port 1087 proto tcp`
- Frontend invite/share/meta links use `REACT_APP_CLIENT_ORIGIN` (or browser origin fallback)
- Frontend API/websocket targets use `REACT_APP_SERVER_ADDRESS*`
- Backend CORS allow-list uses `CORS_ALLOWED_ORIGINS` (comma-separated, `*` supported)

Make sure your firewall allows inbound traffic to:
- `6010` for the frontend
- `4040` for backend HTTP + websocket traffic

### Following container logs

Development compose (`docker-compose.yml`):

```bash
# all services
docker compose logs -f

# specific services
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f db
```

Production compose (`docker-compose.prod.yml`):

```bash
# all services
docker compose -f docker-compose.prod.yml logs -f

# specific services
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f db
```

---

Your setup will vary depending on if you're only making changes to the frontend, or if you're making changes to the frontend and the backend at once.

## Frontend Only

Follow these instructions if you are only making changes to the frontend. These instructions will allow you to connect to the development server rather than needing to run the instance locally.

### Running frontend server

Open a terminal window and run the following commands to clone the project and set up the frontend dependencies:

```bash
git clone git@github.com:ShrimpCryptid/Secret-Hitler-Online.git
cd Secret-Hitler-Online/frontend

npm install
npm run devServer
```

The webpage should open automatically in your browser, but is usually hosted at [localhost:3000](http://localhost:3000).

## Changing frontend + backend

If you're modifying the backend, you'll need to run the server locally. You'll need two terminal windows to run the frontend and backend.

### Running backend server

In your first terminal, clone the repo if you haven't yet. Navigate to the `backend` subdirectory, then use gradle to start the server.

```bash
git clone git@github.com:ShrimpCryptid/Secret-Hitler-Online.git
cd Secret-Hitler-Online/backend

./gradlew runLocal
```

This will start the backend server at [`http://localhost:4040`](http://localhost:4040) by default. This will also set the server in debug-mode, so the CORS policy will not block access from the frontend.

**Every time you make changes to Java files, you'll need to stop and restart the development server.**

You can also run the backend-server using your preferred IDE by launching the Main-method in `ApplicationTest` found in the test directory.

### Running frontend server

Open another terminal at the root of the project, and run the following commands.

```bash
cd frontend

npm install
npm run devLocal
```

Note: You may need to modify `.env.local` based on the address your dev server is mounted to. By default, `.env.local` is configured to use `localhost:4040`.

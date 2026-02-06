# Development setup for Secret Hitler Online

## Quick start using Docker:
- Run everything with Docker Compose (DB + backend + frontend):
  - `docker compose up --build`
  - Open frontend: [http://localhost:3000](http://localhost:3000)
  - Backend health: [http://localhost:4040/ping](http://localhost:4040/ping)
- Alternative: only DB in Docker, run app locally:
  - `docker compose up -d db`  (or use docker run …)
  - `export DATABASE_URL=postgres://secret:secret@localhost:5432/secrethitler`
  - In backend/: `./gradlew runLocal`
  - In frontend/: `npm install && npm run devLocal`
  - Open frontend: [http://localhost:3000](http://localhost:3000)

## Public self-hosting (production)

Use `docker-compose.prod.yml` when running a public instance.

- Start the production stack:
  - `docker compose -f docker-compose.prod.yml up --build -d`
- Default public frontend URL in that file:
  - `http://example.com:6666`
- Default backend URL in that file:
  - `http://example.com:4040`

If you want to host this behind `http://1.2.3.4:6666`, run:

```bash
export REACT_APP_CLIENT_ORIGIN=http://1.2.3.4:6666
export CORS_ALLOWED_ORIGINS=http://1.2.3.4:6666
export REACT_APP_SERVER_ADDRESS=1.2.3.4:4040
export REACT_APP_SERVER_ADDRESS_HTTP=http://1.2.3.4:4040
docker compose -f docker-compose.prod.yml up --build -d
```

Make sure your firewall allows inbound traffic to:
- `6666` for the frontend
- `4040` for backend HTTP + websocket traffic

- Frontend invite/share/meta links use `REACT_APP_CLIENT_ORIGIN` (or browser origin fallback)
- Frontend API/websocket targets use `REACT_APP_SERVER_ADDRESS*`
- Backend CORS allow-list uses `CORS_ALLOWED_ORIGINS` (comma-separated, `*` supported)

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

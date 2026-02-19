# Caddy setup for `secrethitler.pinky.lilf.ir`

This project serves:

- **Frontend** on `127.0.0.1:6010`
- **Backend API + WebSocket** on `127.0.0.1:4040`

When using Caddy, route backend paths to port `4040`, and all other traffic to `6010`.

## Caddyfile block

```caddy
secrethitler.pinky.lilf.ir {
	encode zstd gzip

	@secrethitler_backend path /check-login /new-lobby /ping /game /game/*
	handle @secrethitler_backend {
		reverse_proxy 127.0.0.1:4040
	}

	handle {
		reverse_proxy 127.0.0.1:6010
	}
}
```

## Why this split is required

The React frontend is served from `6010`, but the game server endpoints are on `4040`:

- HTTP: `/check-login`, `/new-lobby`, `/ping`
- WebSocket: `/game`

If `/game` is not routed to backend, live game updates will fail.

## Production compose pairing

Use the production compose file created for this domain:

```bash
docker compose -f docker-compose.secrethitler.prod.yml up -d --force-recreate --remove-orphans
```

This compose file binds services to localhost:

- `127.0.0.1:6010` (frontend)
- `127.0.0.1:4040` (backend)

Caddy then exposes them publicly on HTTPS.

## Redeploy flow

On the remote server, redeploy with:

```bash
cd /path/to/Secret-Hitler-Online
git pull --ff-only origin development
docker compose -f docker-compose.secrethitler.prod.yml up -d --force-recreate --remove-orphans
```

Why not `--build`? This compose file uses `image:` + bind mounts (no `build:` blocks), so `--build` does not rebuild app images here.

## Verify deployment

```bash
docker compose -f docker-compose.secrethitler.prod.yml ps
docker compose -f docker-compose.secrethitler.prod.yml logs -f --tail=100 backend frontend
```

## Reload and validate Caddy

```bash
caddy validate --config ~/Caddyfile
caddy reload --config ~/Caddyfile
```

If running via systemd, you can also use:

```bash
sudo systemctl reload caddy
```

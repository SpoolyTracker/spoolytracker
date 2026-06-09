# Self-Hosting SpoolyTracker

## Requirements

- Docker and Docker Compose
- A domain or localhost setup
- Strong generated secrets

## Quick Start

```bash
cp .env.selfhost.example .env.selfhost
docker compose --env-file .env.selfhost -f docker-compose.selfhost.yml up -d
```

Open the web app at `http://localhost:5173`.

Login with the admin configured in:

- `BOOTSTRAP_ADMIN_USERNAME`
- `BOOTSTRAP_ADMIN_PASSWORD`

The password must be at least 12 characters.

## Runtime URLs

The web container uses runtime variables, not baked Vite values:

- `API_PUBLIC_URL`
- `AI_ENGINE_PUBLIC_URL`
- `SELF_HOSTED=true`

The API uses:

- `SELF_HOSTED=true`
- `JWT_SECRET`
- database and Redis credentials
- `BOOTSTRAP_ADMIN_*`

## Mobile App

The official mobile app source is not part of this public repository and does not have a Docker image.

If your distributed mobile build supports a configurable backend URL, point it at your self-hosted API, for example:

```txt
http://your-server:3000
```

Self-hosting this repository is fully usable with the web dashboard even without the mobile app source.

## pgAdmin

pgAdmin is optional:

```bash
docker compose --env-file .env.selfhost -f docker-compose.selfhost.yml --profile admin up -d
```

## Security Notes

Change every value in `.env.selfhost`. Never expose Postgres or Redis directly to the internet.

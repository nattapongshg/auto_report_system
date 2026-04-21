# Auto Report System

Automated monthly revenue-share report generator for Sharge EV-charging
locations. Fetches transaction data from Metabase → users fill per-location
costs in the UI → generates branded Excel reports → emails customers.

**Stack** — FastAPI · PostgreSQL · PostgREST · React/Vite · Caddy · Docker Compose

## Quick links

- **[deploy/README.md](deploy/README.md)** — first-time EC2 setup + redeploy
- **[CLAUDE.md](CLAUDE.md)** — architecture & conventions
- **[.env.example](.env.example)** — required env vars
- **[docker-compose.yml](docker-compose.yml)** — services on the box

## Architecture (one box)

```
                                ┌──────────────────────────┐
  internet ──── 80/443 ───────► │  caddy (TLS + static FE) │
                                │   ├── / → React build    │
                                │   └── /api → backend     │
                                └───────┬──────────────────┘
                                        │ (internal docker net)
                ┌───────────────────────┼───────────────┐
                ▼                       ▼               ▼
        ┌──────────────┐       ┌────────────────┐  ┌─────────────┐
        │  FastAPI     │◄──────│  postgrest     │  │  postgres   │
        │  backend     │       │  (REST layer)  │◄─│   + volume  │
        └──────┬───────┘       └────────┬───────┘  └─────────────┘
               │                        │
               ▼                        └── reads/writes app tables
       ┌───────────────┐                    (locations, workflow, etc.)
       │  Metabase     │
       │  (same VPC,   │
       │   no VPN)     │
       └───────────────┘
```

Everything runs on **one t3.medium EC2** inside the Sharge VPC so the backend
can reach Metabase directly without a VPN tunnel.

## Local development

```bash
# Backend
cd backend
python -m venv venv
./venv/Scripts/pip install -r requirements.txt       # Windows; use venv/bin on Linux
cp .env.example .env                                  # fill secrets
./venv/Scripts/uvicorn app.main:app --reload --port 8009

# Frontend
cd frontend
npm install
npm run dev                                           # http://localhost:5173
```

Point `vite.config.ts` proxy at the backend port you chose.

## Deploy

See [deploy/README.md](deploy/README.md). Short version:

```bash
git clone <repo> /opt/auto-report && cd /opt/auto-report
cp .env.example .env   # fill everything
docker compose up -d
```

Pushing to `main` triggers `.github/workflows/deploy.yml` which SSHes into the
box and runs `git pull + docker compose up`.

## Project layout

```
.
├── backend/
│   ├── app/             FastAPI routers + engine (fetcher, privilege calc, excel, email)
│   ├── db/init/*.sql    Schema applied by postgres container on first boot
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/            React + Vite + Tailwind (served static by Caddy)
├── deploy/              Setup docs + Caddyfile + helper scripts
├── docker-compose.yml
└── .github/workflows/   CI deploy on push to main
```

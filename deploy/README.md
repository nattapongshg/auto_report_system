# Deployment — single EC2 (Docker Compose)

Target: **t3.medium** in the Sharge VPC, same network as Metabase.

Services on one box:
- `postgres` (data) — volume-backed, not exposed
- `postgrest` (REST layer) — internal only
- `backend` (FastAPI) — internal only
- `caddy` (reverse proxy + static FE) — 80/443 exposed

## First-time setup on the EC2 box

```bash
# 1. Install Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER        # re-login after this

# 2. Clone
git clone <repo-url> /opt/auto-report
cd /opt/auto-report

# 3. Create .env from the template and fill secrets
cp .env.example .env
openssl rand -hex 48                 # → paste as JWT_SECRET
python3 deploy/gen-jwt.py "<jwt-secret>"    # → paste SERVICE_JWT and ANON_JWT
# Also set METABASE_*, SMTP_*, SITE_ADDRESS

# 4. Build frontend (locally OR in CI — Caddy serves from frontend/dist)
cd frontend && npm ci && npm run build && cd ..

# 5. Start everything
docker compose up -d
docker compose logs -f backend       # tail to verify healthy
```

## One-time data migration from Supabase Cloud

```bash
# On your laptop with VPN + Supabase keys:
pip install asyncpg httpx
export OLD_SUPABASE_URL=https://tbvjmmmpbzpbdrvimdlp.supabase.co
export OLD_SUPABASE_SERVICE_KEY=eyJ...                # from old .env
# SSH tunnel to EC2 Postgres OR run this ON the EC2 box:
export NEW_DATABASE_URL=postgresql://postgres:<pw>@localhost:5432/auto_report
python deploy/migrate-from-supabase.py
```

Runs table-by-table in FK order with `INSERT ... ON CONFLICT DO UPDATE`, so
safe to re-run.

**Note:** `metabase_rows` (raw Q1144 data) is NOT migrated — it would be 100+MB
per month via REST. Just re-fetch snapshots on the new box via the UI's
**Fetch Data** button, or from your laptop run `deploy/backfill-raw-rows.py`
against the new DB to push existing local JSON files.

## Redeploy (updates)

```bash
cd /opt/auto-report
git pull
cd frontend && npm ci && npm run build && cd ..
docker compose build backend
docker compose up -d
```

### Or via GitHub Actions (set these repo secrets)

| Secret | Value |
|--------|-------|
| `DEPLOY_HOST` | ec2 public DNS or bastion |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_KEY` | private SSH key with access to the host |

Push to `main` → workflow SSHes in and runs a deploy script (see
`.github/workflows/deploy.yml`).

## Logs / troubleshooting

```bash
docker compose logs -f backend        # FastAPI
docker compose logs -f postgrest      # REST layer
docker compose logs -f caddy          # reverse proxy
docker compose exec postgres psql -U postgres auto_report
```

## Rollback

```bash
git checkout <previous-tag>
docker compose build backend
docker compose up -d
```

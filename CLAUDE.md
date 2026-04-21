# Auto Report System — CLAUDE.md

Monthly revenue-share report generator for Sharge EV charging locations.
Fetches transaction data from Metabase → user fills per-location costs → generates branded Excel → emails customers.

## Stack

- **Backend:** FastAPI (Python 3.11), httpx, openpyxl, Supabase (PostgREST)
- **Frontend:** Vite + React 19 + TypeScript + Tailwind v4, React Router
- **Email:** SMTP (Office 365 via `smtp.office365.com:587`)
- **Data source:** Metabase (question IDs below) — requires VPN to `metabase.shargethailand.com`
- **Storage:** Supabase PostgreSQL (service_key auth, RLS allow-all)

## Running locally

```bash
# Backend
cd backend && ./venv/Scripts/uvicorn.exe app.main:app --host 127.0.0.1 --port 8009 --reload

# Frontend
cd frontend && npm run dev   # vite on :5173, proxies /api + /output to backend
```

The active backend port changes often because Windows leaves TCP sockets in LISTEN from stale uvicorn processes that `taskkill` can't always reap. When hit, bump to next port and update `frontend/vite.config.ts` proxy targets.

## Directory map

```
backend/app/
├── api/                          # FastAPI routers (all under /api/v1)
│   ├── workflow.py               # per-location monthly flow (init / save / send / bulk / reset)
│   ├── monthly.py                # snapshot fetch from Metabase
│   ├── group_reports.py          # consolidated group reports
│   ├── locations.py              # CRUD for location configs
│   ├── schedules.py              # recurring auto-send schedules (day-of-month)
│   ├── privileges.py             # privilege_configs CRUD
│   ├── metabase.py               # thin Metabase passthrough
│   └── uploads.py                # bill image upload
├── engine/
│   ├── fetcher.py                # Metabase date-range fetch w/ adaptive 6-hr window split
│   ├── privilege_calc.py         # revenue calc per row + privilege lookup
│   ├── excel_builder.py          # branded xlsx (Summary + data sheet + optional image)
│   ├── email_service.py          # SMTP send with HTML + inline logo
│   └── metabase_client.py        # Metabase API wrapper
├── supabase_client.py            # Tiny httpx wrapper over PostgREST
├── config.py                     # pydantic-settings (env vars)
└── main.py                       # FastAPI app + CORS + static /output mount

backend/
├── *.sql                         # Supabase migrations (run manually in SQL Editor)
├── data/<year-month>.json        # cached Metabase snapshots (raw rows+cols)
├── output/*.xlsx                 # generated reports (served at /output/<name>)
└── uploads/                      # uploaded bill images

frontend/src/
├── pages/                        # MonthlyRun, Groups, Locations, Schedules, Privileges, Dashboard
├── components/                   # Sidebar, SendReportDialog, GroupReportDialog
└── lib/api.ts                    # Metabase passthrough client only
```

## Data model — Supabase tables

- `locations` — master list (757 rows). Key columns: `name`, `station_code`, `group_name`, `is_report_enabled`, `location_share_rate`, `transaction_fee_rate`, `electricity_cost`, `internet_cost`, `etax`, `email_recipients[]`.
- `monthly_snapshots` — one per (year_month, question_id) fetch. Status: `fetching | completed | failed`. Stores `file_path` pointing to `data/<ym>.json`.
- `monthly_location_inputs` — per-location entry for a snapshot. Status: `pending | generating | sent | failed`. Holds user-entered costs + computed preview (revenue/gp/share) + output file info.
- `group_report_inputs` — same idea but per group. Unique on (snapshot_id, group_name).
- `report_schedules` — recurring jobs (location_ids + trigger_day 1-28 + last_run tracking).
- `privilege_configs` — revenue calc rules, keyed primarily by `privilege_program_name` (fallback: `discount_label`). Has `privilege_type` (percent | credit | mixed) and optional `share_rate`.

## Metabase questions

- **Q1144** — "Invoice Report - Enhanced" (currently used). Clone of Q1097 + joins `payment_methods → privilege_programs` to surface `privilege_program_name`, plus `price_per_kwh`. Script: [backend/scripts/create_enhanced_question.py](backend/scripts/create_enhanced_question.py).
- **Q1097** — legacy. Missing authoritative privilege name.
- **Q748** — "Nop Request". Payment-centric (multiple rows per invoice). Has `Privilege Programs Name` directly. Used as reference to build Q1144.

The column `vin` on these questions is actually `privilege_codes.vin` (a campaign/batch code like `GRABDRIPRI1FEBD22`), not a car VIN, for credit-type payments. For stripe-paid rows it is a real car VIN.

## Revenue calc — `privilege_calc.calc_revenue`

Rules (in order, see [backend/app/engine/privilege_calc.py](backend/app/engine/privilege_calc.py)):

1. `invoice_status == "refunded"` → **revenue = 0** (full refund)
2. Partial refund → `net_payment = max(0, payment_amount - total_refund)`
3. `billed_to_organization` → `invoice_amount - total_refund`
4. Lookup privilege config: first by `privilege_program_name`, then `discount_label` (with/without " Used")
5. `privilege_type == "percent"` → `net_payment`
6. `privilege_type == "credit"` → `kwh * share_rate` if `share_rate` set, else `total_discount` (credit has no cash flow so refunds don't reduce it)
7. `privilege_type == "mixed"` with `net_payment == 0` → same as credit; else `net_payment`

`_display_name` for Excel column S uses `privilege_program_name` if present, else `discount_label`. Both are written to separate columns: **S=Privilege Name** and **T=Discount Label**.

`process_rows` filters `kwh <= 0` early. `init_month` (workflow.py) does the same when computing preview_rows and etax_count.

## eTax

- `ETAX_PER_DOC = 1` THB per e-tax document (pre-VAT).
- `etax_count` = count of rows where `etax_number` is non-null AND `kwh > 0`, computed during `init_month`.
- `etax` saved to `monthly_location_inputs.etax = etax_count × 1`.
- VAT 7% is added downstream (`etax_incl_vat = etax × 1.07`).

## Cost totals formula

```
tx_fee        = revenue × transaction_fee_rate   (per-location, default 3.65%)
vat_on_fee    = tx_fee × 7%
total_fee     = tx_fee + vat_on_fee              (no transfer_fee — was removed)
internet_vat  = internet × 1.07
etax_vat      = etax × 1.07
remaining     = revenue - total_fee - electricity - internet_vat - etax_vat
location_share = remaining × location_share_rate (per-location, default 40%)
```

Electricity is entered by the user as the actual MEA bill amount (already VAT-inclusive). Internet and eTax are entered pre-VAT.

## Report flows

**Single location** (per row in Monthly Reports):
1. Click **Send** → dialog pre-fills electricity/internet/etax/email
2. Two buttons: **Generate Only** (saves Excel, status → sent, no email) or **Send Report** (generate + email)
3. Can **Resend** for `status=sent` rows (same dialog)

**Group report** (per group card above the table):
1. Click **Send** on a group card → big dialog with per-location cost inputs
2. `Electricity` is the main manual entry; batch fill via paste or Excel/CSV upload (click `batch` above the column). Template download available.
3. Output: one Excel with `Summary` + `By Location` + data sheet; one email with that attachment.

**Scheduled** (Schedules page):
- Pick locations + day-of-month. Click ▶ to run manually. Uses `locations.electricity_cost` as default; skips locations with 0 electricity and reports in `last_run_detail`. No cron loop wired yet — must trigger manually.

## Backend conventions

- **Endpoints are verb-forward**, not REST-strict: `/workflow/{sid}/send/{eid}`, `/workflow/{sid}/reset/{eid}`, `/group-reports/{sid}/send`, `/schedules/{id}/run`.
- **Background tasks** via `BackgroundTasks` for generate+send. Status transitions: `pending → generating → sent | failed`.
- **Supabase client** is a thin httpx wrapper — pass raw PostgREST filter strings (e.g. `"is_active=eq.true&order=name.asc"`). Use `insert_many` for batch inserts (splits to 200-row chunks).
- **Privilege cache** — `privilege_calc._privilege_cache` module-level; call `refresh_cache()` after any `privilege_configs` write so subsequent report runs see fresh rules.

## Frontend conventions

- **Vite proxy** in `vite.config.ts` routes `/api` and `/output` to the backend port. Update when backend port changes.
- **Inline editing with drafts** pattern (see Locations, MonthlyRun): server state in `items`, pending edits in `drafts: Record<id, Partial<T>>`. "Save All" fans out PUT requests.
- **Chip-style email input** (SendReportDialog, GroupReportDialog): Enter / comma / space commits; Backspace on empty deletes last.
- **StatusBadge** exported from `Dashboard.tsx` — maps status string → colored pill.

## Things that will bite

- **Windows + uvicorn orphan sockets** — `--reload` sometimes leaves processes holding TCP ports even after taskkill; the fix is to bump port and update `vite.config.ts`. Reboot clears them.
- **`.env` is loaded once at startup** — changes to `SMTP_*`, `METABASE_*` require a full restart (reload ≠ re-read env).
- **Snapshot re-init** — once `monthly_location_inputs` exist for a snapshot, `init_month` is a no-op. Use the **Reset** button on Monthly Reports to delete entries and re-init with current logic / current locations.
- **Per-snapshot question ID matters** — switching the default Metabase question (currently 1144) doesn't retroactively update old snapshots. Delete stale snapshots after changing question.
- **Office 365 SMTP AUTH** — tenant admin must enable SMTP AUTH for the sending user (or tenant) or you'll hit `535 5.7.139 SmtpClientAuthentication is disabled`. No Basic Auth token is auto-provisioned.
- **Metabase access** — `metabase.shargethailand.com` requires VPN. Snapshot fetches will fail with `All connection attempts failed` without it. Production plan is to move the fetch worker to AWS Lambda inside the VPC.
- **Two parallel "send" paths** — per-location (`workflow.send`) and per-group (`group_reports.send`) have overlapping logic for build+email. If you touch one, sanity-check the other.
- **Backend has no auto-retry for failed emails**. A `failed` entry must be manually resent (Resend/Retry button).

## Operational tasks

- **Add a new location group:** Groups page → New Group → name + checkbox picker. Membership is stored as `locations.group_name` (string column, not a FK).
- **Reseed privilege_configs from Metabase:** `cd backend && PYTHONPATH=. ./venv/Scripts/python.exe scripts/seed_privilege_programs.py 2026-01-01 2026-04-01`. Inserts new `privilege_program_name`s and back-fills existing rows keyed by `discount_label`.
- **Regenerate the enhanced Metabase question:** `scripts/create_enhanced_question.py` — idempotent (updates Q1144 if exists, else creates).

## Not built / intentionally deferred

- Cron loop for schedules (must trigger manually via the ▶ button).
- Monthly auto-fetch (no scheduler yet; user clicks Fetch Data).
- VPN bridge for headless Metabase access (options discussed: Cloudflare Tunnel, AWS Lambda-in-VPC, reverse proxy on internal box).
- Refund display in row-level Excel was added (`Total Refund` column) but `By Location` summary doesn't break it out yet.

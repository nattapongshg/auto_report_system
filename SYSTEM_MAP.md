# Sharge System Map

Generated from:

- Repositories cloned into this workspace
- Metabase metadata for `Sharge UAT` / database `33`
- Code inspection of API, worker, admin, mobile, fleet, and socket services

## 1. Top-level architecture

```text
Sharge Mobile  ----\
                    \
Sharge Fleet   ------>  sharge-backend (NestJS / TypeORM / main product API) ----> PostgreSQL
                      /
Other internal APIs --/

Sharge Admin Web  -> sharge-admin API (Fastify / TypeORM) -----------------------> PostgreSQL

Sharge CMS (Flask admin + workers) ----------------------------------------------> PostgreSQL
     | \
     |  -> S3 (report files)
     |  -> SES (email delivery)
     \  -> sharge-backend API for some internal operations

Chargers / EVSEs <---- WebSocket ---- sharge-socket-server ---- Lambda invoke ----> sharge-backend OCPP processing

Metabase ------------------------------------------------------------------------> PostgreSQL replica / metadata sync
```

## 2. Repository map

### `sharge-backend`

- Stack: NestJS, TypeORM, PostgreSQL, AWS/serverless
- Role: main business backend for mobile, fleet, CMS, eTax, and charger-related processing
- Key API surfaces:
  - `mobile` API under `src/apis/mobile`
  - `fleet` API under `src/apis/fleet`
  - `cms` API under `src/apis/cms`
  - `etax-admin` and `etax-web` APIs under `src/apis/etax-admin` and `src/apis/etax-web`
- Key domains visible in code:
  - auth, bookings, cars, devices
  - invoices, payments, payment methods, top-ups
  - notifications
  - privileges
  - fleet organizations and budgets
  - OCPI / OCPP / OSCP integrations
  - eTax

### `sharge-mobile`

- Stack: React Native
- Role: end-user mobile application
- Primary dependency: `sharge-backend`
- Key flows visible in API client:
  - auth and profile
  - bookings
  - cars / VIN / license plates
  - invoices and tax invoice requests
  - payment methods and top-ups
  - sessions
  - organizations and fleet user views
  - tokens, locations, commands, privileges

### `sharge-fleet`

- Stack: React + Vite
- Role: fleet customer portal
- Primary dependency: `sharge-backend` fleet API
- Key user-facing capabilities:
  - organization list
  - sessions
  - invoices
  - locations
  - budget cycles and assets
  - report generation and report status polling

### `sharge-admin`

- Stack:
  - `api`: Fastify + TypeORM
  - `web`: React Admin
- Role: internal operator/admin console
- Data access model: connects to PostgreSQL directly through its own API, not through `sharge-backend`
- Key internal capabilities:
  - auth for operator admins
  - sessions, invoices, locations, operators
  - stats
  - report request endpoints backed by `report_queue`

### `sharge-cms`

- Stack: Flask-style Python app + background tasks + SQLAlchemy
- Role:
  - internal CMS / back office
  - admin views over operational data
  - report generation worker
  - email + S3 delivery for generated files
- Key internal services:
  - report generation
  - organization budget cycle processing
  - invoice, payment, privilege, token, tariff, tax operations
- Important note:
  - current Excel/CSV report generation logic lives here, not in Metabase

### `sharge-socket-server`

- Stack: Node + `ws`
- Role: charger WebSocket entry point
- Function:
  - accepts charger connections
  - handles OCPP messages
  - invokes backend Lambda for event processing
  - exposes admin endpoint to send OCPP commands back to connected chargers

## 3. Main integration boundaries

## Product/API boundary

- `sharge-mobile` and `sharge-fleet` both depend on `sharge-backend`
- `sharge-backend` is the main source of business rules
- `sharge-backend` owns the public/domain APIs for sessions, invoices, org budgets, locations, commands, payments, and tokens

## Internal operations boundary

- `sharge-admin` is a separate internal system with its own API and DB models
- `sharge-cms` is another internal system for admin workflows and long-running background jobs
- `sharge-admin` and `sharge-cms` both read/write the same database domain, but through separate codebases

## Charger boundary

- chargers do not talk to `sharge-backend` directly
- chargers connect to `sharge-socket-server`
- `sharge-socket-server` forwards message processing into backend Lambda tasks

## BI/reporting boundary

- Metabase reads from the database layer and is currently external to product flow
- Metabase is suitable as a read/report/query layer
- existing operational report generation is already implemented separately in `sharge-cms`

## 4. Current report architecture

There are already two report systems in the codebase.

### A. Operational queued reports

Used by fleet/admin/CMS flows.

Flow:

```text
Fleet UI or Admin UI
  -> inserts a row into report_queue
  -> CMS worker picks the next unprocessed row
  -> Python report generator queries PostgreSQL
  -> generates CSV/XLSX
  -> uploads file to S3
  -> may email user via SES
  -> marks report_queue.processed_at
```

Key facts:

- `report_queue` exists in both backend and CMS models
- `sharge-backend` fleet API can enqueue:
  - `fleet_invoice`
  - `fleet_session`
- `sharge-admin` API can enqueue:
  - `cpo_session`
  - `cpo_invoice`
  - `cpo_session_invoice`
- `sharge-cms` contains the actual report generators and worker runner

### B. Metabase reports

- Metabase can export saved questions directly through API
- this is separate from `report_queue`
- good for BI/reporting and analyst-owned questions
- currently not wired into the existing internal report worker

## 5. Data domains from schema + code

The database schema exposed through Metabase has `90 tables` and `1244 fields` in `public`.

## Core business domains

### User/Auth

Representative tables:

- `users`
- `auth_attempts`
- `auth_penalties`
- `auth_tokens`
- `phone_numbers`
- `users_phone_numbers`
- `users_devices`
- `notifications`
- `notification_templates`

Likely owners:

- `sharge-backend`
- `sharge-admin` for operator auth/audit views

### Charging sessions / booking / location

Representative tables:

- `bookings`
- `devices`
- `evse_groups`
- `ocpi_locations`
- `ocpi_evses`
- `ocpi_connectors`
- `ocpp_events`
- `ocpp_central_system_queue`

Likely owners:

- `sharge-backend`
- `sharge-socket-server` at runtime for live charger communication
- `sharge-admin` / `sharge-cms` for support and operations

### Payment / billing / tax

Representative tables:

- `payments`
- `payment_methods`
- `wallet_transactions`
- `top_up_sessions`
- `invoices`
- `invoice_refund_requests`
- `organization_invoices`
- `etax_documents`
- `etax_invoice_numbers`
- `etax_products`
- `etax_queue`
- `tax_credentials`
- `tax_information`

Likely owners:

- `sharge-backend`
- `sharge-admin`
- `sharge-cms`

### Fleet / organization / budgets

Representative tables:

- `organizations`
- `organizations_members`
- `organizations_tokens`
- `organization_member_tokens`
- `organization_budget_cycles`
- `organization_budget_usages`
- `organization_token_budgets`
- `organizations_tariffs`

Likely owners:

- `sharge-backend` fleet API
- `sharge-fleet`
- `sharge-cms` for processing budget cycles

### Privileges / campaigns / partner programs

Representative tables:

- `privilege_programs`
- `privilege_codes`
- `privilege_codes_customer_groups`
- `customer_groups`
- `membership_cards`
- `membership_rewards`
- `the1_verifications`
- `porsche_credits`
- `rever_tyc_records`
- `partner_integrations`

Likely owners:

- `sharge-backend`
- `sharge-cms`

### Interoperability standards

Representative tables:

- `ocpi_*`
- `oscp1_*`
- `oscp2_*`

Likely owners:

- `sharge-backend` integrations
- external roaming / energy ecosystem connections

## 6. Notable system patterns

### Pattern 1: Multiple internal apps share the same data model

- `sharge-backend`, `sharge-admin`, and `sharge-cms` all understand overlapping parts of the same PostgreSQL schema
- this gives flexibility, but also means business logic is distributed

### Pattern 2: Report generation is already split into enqueue vs worker

- enqueue APIs live in `sharge-backend` and `sharge-admin`
- generation logic lives in `sharge-cms`
- this is a good integration point for new reporting capabilities

### Pattern 3: Fleet is a first-class product slice

- present in mobile, backend, fleet portal, CMS reports, and DB schema
- tables and APIs around `organizations`, `budget_cycles`, `organization_invoices`, and `report_queue` are central

### Pattern 4: Metabase is adjacent, not embedded

- Metabase reads the same data world
- current product systems do not appear to call Metabase directly
- if Metabase is used for new reports, it should likely be attached to the existing `report_queue` architecture rather than replacing it immediately

## 7. Best integration points for new report automation

If you want to extend reporting without fighting the existing system, the cleanest options are:

### Option A: Extend `report_queue`

- keep request flow in `sharge-backend` or `sharge-admin`
- add new template types in `report_queue`
- let `sharge-cms` worker handle new generation logic
- useful when report output is operational, permissioned, and should follow the current S3/email pipeline

Best for:

- fleet exports
- admin exports
- scheduled operational reports
- reports that must be tied to user/org permissions

### Option B: Add Metabase-backed generators behind `report_queue`

- create a new report type whose worker does:
  - call Metabase question export API
  - save raw result
  - optionally transform into company Excel format
  - upload to S3 / email recipient
- keeps a single delivery mechanism while reusing existing Metabase questions

Best for:

- analyst-owned questions
- fast BI report rollout
- minimizing duplicate SQL

### Option C: Keep Metabase separate for BI, use code for operational reporting

- use Metabase for dashboards and ad hoc analysis
- use `sharge-cms` / backend for reports that are business-critical or workflow-driven

Best for:

- avoiding scope creep
- preserving stable operational exports

## 8. Recommended ownership model

Based on the current ecosystem, a practical ownership split would be:

- `sharge-backend`
  - business APIs
  - auth and permissions
  - enqueue/report request APIs for product surfaces

- `sharge-cms`
  - long-running report processing
  - Excel generation
  - S3 upload
  - email delivery
  - scheduled jobs

- `Metabase`
  - analyst-managed saved questions
  - dashboard exploration
  - source for BI-oriented exports where SQL already exists

- `sharge-admin` / `sharge-fleet`
  - user interfaces to request exports and download results

## 9. Immediate next steps

The highest-value next mapping tasks are:

1. map each important report to its source:
   - `report_queue` template
   - CMS generator class
   - DB tables used
   - UI entry point
2. map each product surface to API base URL and auth model
3. build a "table to owner repo" map for the most important 20-30 tables
4. design how a new Metabase export report type fits into the existing `report_queue` worker

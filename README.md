# CVE Ingestion & Explorer

A full-stack project that ingests NVD CVE API v2 data into a local database, keeps it synchronized in batches, and exposes searchable APIs plus a two-page UI:

- `/cves/list` -> paginated CVE table + total records + filters + result-per-page controls
- `/cves/:cveId` -> detailed CVE view with scores, metadata, CPEs, and references

This implementation is designed to be both recruiter-attractive and interview-explainable.

## 1) Features Delivered Against Problem Statement

1. **Consume and store CVEs in DB**
- NVD API v2 pull (`/rest/json/cves/2.0`)
- Data stored in SQLite (`cve_records` table)

2. **Chunked API ingestion**
- Uses `startIndex` + `resultsPerPage` while syncing all pages

3. **Data cleansing + de-duplication**
- Invalid date records are discarded
- Score normalization (CVSS v2/v3 to `base_score`)
- Upsert on `cve_id` (primary key) prevents duplicates

4. **Periodic batch synchronization**
- Incremental scheduler via cron (`SYNC_CRON`)
- Manual sync endpoint and scripts for incremental/full refresh

5. **Read/filter API**
- By CVE ID
- By year
- By CVE score (`score`, `scoreMin`, `scoreMax`)
- By last modified in N days

6. **UI in HTML/CSS/JavaScript**
- Clean two-page UI with responsive layout and animated visual identity

7. **API documentation**
- `docs/API.md`

8. **Unit tests**
- Transformer tests and API tests using Vitest + Supertest

9. **Code quality**
- Layered design: config, DB, services, routes, UI

## 2) Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite (`better-sqlite3`)
- **Scheduler**: node-cron
- **Validation**: zod
- **Frontend**: HTML, CSS, Vanilla JS
- **Testing**: Vitest, Supertest

## 3) Run Locally

## Prerequisites
- Node.js 18+

## Setup

1. Install dependencies
```bash
npm install
```

2. Configure environment
```bash
copy .env.example .env
```

3. Start server
```bash
npm start
```

App runs at `http://localhost:3000`.

## Useful Commands

```bash
npm run sync:once   # manual incremental sync
npm run sync:full   # full refresh sync
npm test            # run tests
```

## Deploy on Render

This app is deploy-ready on Render and includes a blueprint file at `render.yaml`.

### Option A: Blueprint deploy (recommended)

1. Push this repository to GitHub.
2. In Render, click **New +** -> **Blueprint**.
3. Select this repository.
4. Confirm the web service settings from `render.yaml`.
5. Add `NVD_API_KEY` in Render environment variables (optional but recommended).
6. Deploy.

The service uses:

- `npm install` as build command
- `npm start` as start command
- `/api/health` as health check
- Persistent disk mounted at `/var/data`
- `DB_PATH=/var/data/cve.db` for durable SQLite storage

### Option B: Manual web service setup

If you prefer manual setup instead of blueprint:

1. Create a **Web Service** in Render from your GitHub repo.
2. Set **Environment** to `Node`.
3. Build command: `npm install`
4. Start command: `npm start`
5. Health check path: `/api/health`
6. Add a persistent disk mounted at `/var/data`.
7. Add environment variable `DB_PATH=/var/data/cve.db`.
8. Add other env vars from `.env.example` as needed.

### Important notes for Render

- Keep `PORT` unset in Render. Render injects its own `PORT`.
- Use at least the Starter plan if you need persistent disk for SQLite.
- If cold starts are a concern, set `BOOTSTRAP_SYNC_ON_START=false` and trigger sync manually via `POST /api/sync`.

## 4) API Endpoints

- `GET /api/health`
- `GET /api/cves`
- `GET /api/cves/:cveId`
- `GET /api/sync/state`
- `POST /api/sync`

Detailed request/response docs are in `docs/API.md`.

## 5) Project Structure

```text
src/
  app.js
  server.js
  config/env.js
  db/
    client.js
    schema.js
    cveRepository.js
  services/
    nvdClient.js
    nvdTransformer.js
    cveSyncService.js
  routes/
    api.js
  public/
    css/styles.css
    js/cves-list.js
    js/cve-detail.js
  views/
    cves-list.html
    cve-detail.html
  scripts/
    syncOnce.js
    fullSync.js
tests/
  api.test.js
  nvdTransformer.test.js
docs/
  API.md
```

## 6) Interview Talking Points (DBMS / OS / System Design)

### DBMS Concepts You Can Explain

- **Primary key + upsert**: `cve_id` as PK guarantees uniqueness and enables conflict-aware upsert.
- **Indexing**: indexes on `published_at`, `last_modified_at`, and `base_score` optimize filter queries.
- **Pagination strategy**: SQL `LIMIT/OFFSET` controls memory footprint and API latency.
- **Normalization vs denormalization**:
  - Normalized searchable columns for filters (fast query path)
  - JSON blobs retained for full fidelity and future flexibility.
- **Transactions**: batch upsert is wrapped in a transaction for atomic writes and throughput.

### Operating Systems Concepts You Can Explain

- **Scheduling**: cron-like periodic jobs model OS schedulers running recurring tasks.
- **Concurrency control**: in-process sync lock prevents overlapping jobs (critical section concept).
- **I/O behavior**: network pull + disk write pipeline is I/O bound, not CPU bound.
- **Durability and WAL**: SQLite WAL improves concurrent read/write behavior.

### Networking / API Concepts You Can Explain

- **Rate limiting handling**: retries with backoff for 429 and 5xx responses.
- **Chunked ingestion**: offset-based page fetch to handle large datasets safely.
- **Idempotency**: sync can be rerun without duplicate records due to upsert semantics.

### Security / Production Readiness Concepts

- Input validation with zod for query and request body safety.
- Escaped UI rendering to reduce XSS risk in client-side table rendering.
- Environment-based config for secrets and deployment portability.

## 7) Demo Flow for Recruiter (5-7 minutes)

1. Open `/cves/list` and show total records + result-per-page options (`10`, `50`, `100`).
2. Apply filters (year, score range, modified-in-days) and explain indexed querying.
3. Click a row to open `/cves/:cveId` detail page.
4. Trigger incremental sync and show sync state endpoint.
5. Mention test coverage and how incremental vs full sync works.

## 8) Notes

- NVD may enforce stricter rate limits without an API key. Add `NVD_API_KEY` in `.env` for better throughput.
- For quick demo runs, set `NVD_SYNC_MAX_PAGES` to a small number such as `2`.

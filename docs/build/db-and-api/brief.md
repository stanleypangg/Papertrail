# Phase 3 — SQLite cache + API routes + tests

## Goal
`script_id → world` cache via Drizzle/SQLite. Two API routes that wrap the Phase 2
`worldGenerator`: secret-gated `POST /api/sleuth/worlds/generate` and
`GET /api/sleuth/worlds/[operationId]` with auto-regeneration on Marble expiry.
All 6 unit-test paths green via `pnpm test`.

## Source of truth (read both, in this order)
- `/Applications/Development/HuskyHack/.worktrees/sleuth/.autopilot/CONTEXT.md` — **binding overlay** (wins ties)
- `/Users/rubbishtsui/.gstack/projects/rubbishtsui/sleuth-autopilot-prompt.md` — full plan, **Phase 3** (~lines 107-138)

## Coexist contract (binding)
- All sleuth code in sleuth namespaces:
  - `lib/sleuth/db/*` (NOT `lib/db/*` — PageWorld owns root `lib/`).
  - `app/api/sleuth/worlds/*` (NOT `app/api/worlds/*` — PageWorld already owns `app/api/worlds/`).
- DB file: `sleuth.db` at repo root (already gitignored; verified in `.gitignore`).
- Table: `sleuth_worlds` (namespaced so it can never collide with PageWorld if PageWorld ever adopts SQLite).
- Toolchain: `pnpm`. No `bun`. No dev server during impl.
- Verification: `pnpm lint && pnpm typecheck && pnpm test` (no `pnpm build` needed; route handlers compile via tsc).
- No emojis. No `process.env.X!`. Use `requireEnv()`.
- Env var name: `SLEUTH_WORLD_PROVIDER` (NOT `WORLD_PROVIDER`). Secret gate: `SLEUTH_SECRET`.

## Files to deliver

### Source (4)

- `lib/sleuth/db/schema.ts`
  - Drizzle schema using `sqliteTable` from `drizzle-orm/sqlite-core`.
  - Table name `sleuth_worlds`, exported as `worlds`:
    - `script_id: text PRIMARY KEY`
    - `operation_id: text` (current Marble op id; null while only mock-cached)
    - `splat_url: text` (set when poll resolves done)
    - `status: text` — `'pending' | 'done' | 'error'` (typed via Drizzle column type)
    - `world_prompt_json: text` (JSON-serialized `WorldPrompt` for re-generation on expiry)
    - `created_at: integer` (`mode: 'timestamp'`)
    - `expires_at: integer` (`mode: 'timestamp'`, nullable)
  - Export inferred types `WorldRow` (`typeof worlds.$inferSelect`) and `NewWorldRow` (`typeof worlds.$inferInsert`).

- `lib/sleuth/db/client.ts`
  - Lazy singleton `getDb(): BetterSQLite3Database<typeof schema>`.
  - Resolves DB path from `process.env.SLEUTH_DB_PATH` (defaults to `sleuth.db` at repo root).
  - Calls `db.run(sql\`PRAGMA journal_mode = WAL\`)` once on first init (best-effort; ignore failure).
  - Auto-creates the `sleuth_worlds` table if missing via raw `CREATE TABLE IF NOT EXISTS` (so tests don't need a separate migration step). The DDL must mirror `schema.ts` exactly.
  - Export `resetDb()` for tests: closes the cached connection so the next `getDb()` re-opens (used after swapping `SLEUTH_DB_PATH` in test setup).

- `app/api/sleuth/worlds/generate/route.ts`
  - `POST` handler.
  - Read header `x-sleuth-secret`. Compare against `requireEnv('SLEUTH_SECRET')`. On mismatch → 401 `{ error: 'unauthorized' }`.
  - Parse JSON body: `{ script_id: string; world_prompt: WorldPrompt; display_name?: string }`. Validate with zod (`SLEUTH_GENERATE_SCHEMA`); 400 on parse error with the zod issues.
  - DB lookup by `script_id`:
    - If row exists with `status === 'done'` and a non-empty `splat_url` → return `{ done: true, splat_url, cached: true }`.
    - Otherwise call `worldGenerator.generate(input)`. Upsert row with `operation_id`, `status: 'pending'`, `world_prompt_json: JSON.stringify(world_prompt)`, `created_at: now()`, `expires_at: null`. Return `{ operation_id, degraded? }`.
  - Use `NextResponse.json` for all responses.
  - Import `worldGenerator` from `@/lib/sleuth/world-generator` so the singleton handles the worldlabs-with-mock-fallback wiring.

- `app/api/sleuth/worlds/[operationId]/route.ts`
  - `GET` handler. Next 16 dynamic route param: `{ params }: { params: Promise<{ operationId: string }> }` → `await params`.
  - Call `worldGenerator.poll(operation_id)`.
  - On `{ done: false }` → return `{ done: false, operation_id }` so the client keeps polling.
  - On `{ done: true, splat_url }` → upsert/update DB row (status=done, splat_url) for the row whose `operation_id === operation_id`. Return `{ done: true, splat_url, degraded? }`.
  - On thrown `MarbleOperationError` with `kind === 'expired'`:
    - Look up the SQLite row by `operation_id`. Read `world_prompt_json`. Re-call `worldGenerator.generate(...)`. Update the row's `operation_id` to the new one (keep `status: 'pending'`). Return `{ done: false, operation_id: <new>, regenerated: true }` so the client can keep polling without seeing an error.
    - If the row is missing (can't recover the prompt) → 410 `{ error: 'expired-and-unrecoverable' }`.
  - On any other thrown error → 502 `{ error: 'poll-failed', detail: <message> }`.

### Config (1)

- `drizzle.config.ts` (repo root, NEW file — PageWorld doesn't have one yet, so this is a fresh add)
  - `schema: './lib/sleuth/db/schema.ts'`, `out: './drizzle/sleuth'`, `dialect: 'sqlite'`, `dbCredentials.url: 'sleuth.db'`.
  - Documents: `pnpm db:push` (already in `package.json` scripts) is the migration command.

### Tests (2 files, 6 cases)

- `test/sleuth/api/generate.test.ts` — **3 cases**
  Each test sets up a fresh in-memory SQLite via `SLEUTH_DB_PATH=':memory:'` and calls `resetDb()` in `beforeEach`. Stubs `SLEUTH_SECRET` and `WLT_API_KEY` via `vi.stubEnv`. Mocks the `worldGenerator` module via `vi.mock` so the route uses a controllable stub.
  1. **No secret header → 401.** Calls the `POST` handler with no `x-sleuth-secret`; expects 401, expects no DB writes.
  2. **Cache hit → returns cached splat without calling the provider.** Pre-seeds `sleuth_worlds` with `status: 'done'`, `splat_url: '/cached.splat'` for `script_id: 'the-empress-last-tea'`. POST with valid secret → response is `{ done: true, splat_url: '/cached.splat', cached: true }`. Provider stub `generate` was NOT called.
  3. **Cache miss → provider is called and DB row is written pending.** No pre-seed. Stub provider returns `{ operation_id: 'op_test' }`. POST with valid secret + script_id `'new-script'` → response is `{ operation_id: 'op_test' }`. DB row exists with `status: 'pending'`, `operation_id: 'op_test'`, `world_prompt_json` matches the input.

- `test/sleuth/api/operation.test.ts` — **3 cases**
  Same setup pattern.
  1. **Pending → returns `{ done: false }`.** Stub `worldGenerator.poll` returns `{ done: false }`. GET handler → response `{ done: false, operation_id }`. DB unchanged.
  2. **Done → updates DB and returns splat.** Pre-seed row with `operation_id: 'op_done'`, `status: 'pending'`. Stub poll returns `{ done: true, splat_url: 'https://cdn/x.spz' }`. GET → response `{ done: true, splat_url: 'https://cdn/x.spz' }`. DB row now has `status: 'done'`, `splat_url` updated.
  3. **Expired → re-generates and returns the new operation_id.** Pre-seed row with `operation_id: 'op_old'`, `status: 'pending'`, `world_prompt_json: '{"type":"text","text_prompt":"parlour"}'`. Stub poll throws `new MarbleOperationError('expired', 'expired')`. Stub generate returns `{ operation_id: 'op_new' }`. GET → response `{ done: false, operation_id: 'op_new', regenerated: true }`. DB row now has `operation_id: 'op_new'`, `status: 'pending'`.

## Verification gate (run before opening PR)
```bash
pnpm lint
pnpm typecheck
pnpm test  # all 6 new cases pass; previous 13 still green; no "skipped"
```

## Out of scope
- Backboard chat client (Phase 4).
- OpenAI image client (Phase 4).
- Any UI route (`app/scripts/[id]/page.tsx` is Phase 6).
- Real Marble round-trip — tests use the mocked `worldGenerator`.
- Modifying any PageWorld code (`app/api/worlds/route.ts`, `lib/worldStore.ts`, etc. are read-only).
- Migration files — `pnpm db:push` is the migration story for the hackathon.

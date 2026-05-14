# Phase 2 — World provider abstraction + tests

## Goal
Type-safe Marble client, mock fallback, factory with **runtime** degradation.
All 11 unit-test paths green via `pnpm test`.

## Source of truth (read both, in this order)
- `/Applications/Development/HuskyHack/.worktrees/sleuth/.autopilot/CONTEXT.md` — **binding overlay** (wins ties)
- `/Users/rubbishtsui/.gstack/projects/rubbishtsui/sleuth-autopilot-prompt.md` — full plan, esp. **Phase 2** (~lines 83-104)

## Coexist contract (binding)
- All sleuth code in `lib/sleuth/`. **PageWorld files are read-only.**
- Toolchain: `pnpm`. No `bun`. No dev server during impl.
- Verification: `pnpm lint && pnpm typecheck && pnpm test` (no `pnpm build` needed for this phase — no app routes change).
- No emojis. No `process.env.X!` non-null assertions. Use `requireEnv()`.

## Files to deliver

### Source (4)
- `lib/sleuth/world-generator/types.ts`
  - `WorldPrompt` interface: `{ type: 'text', text_prompt: string, disable_recaption?: boolean | null }`
  - `GenerateInput` interface: `{ script_id: string; world_prompt: WorldPrompt; display_name?: string }`
  - `GenerateResult` interface: `{ operation_id: string; degraded?: boolean }`
  - `PollResult` interface: `{ done: boolean; splat_url?: string; degraded?: boolean; error?: string }`
  - `WorldGenerator` interface: `{ generate(input): Promise<GenerateResult>; poll(operation_id): Promise<PollResult> }`
  - Error classes (each extends Error, with `name` set in constructor): `MarbleAuthError`, `MarbleRateLimitError`, `MarbleServerError`, `MarbleOperationError`
  - Re-export the `WorldsGenerateRequest` and `GetOperationResponse_Union_World__PanoDepthToRgbResult__` shapes from `marble.gen.ts` as type aliases so call sites are typed.

- `lib/sleuth/world-generator/worldlabs.ts`
  - Endpoint constants: base `https://api.worldlabs.ai/marble/v1`, paths `/worlds:generate` and `/operations/{operation_id}`.
  - Header: `WLT-Api-Key: <key>` (NOT `Authorization: Bearer`).
  - **Lazy env access** — call `requireEnv('WLT_API_KEY')` inside each method (NOT at module top-level). Reason: factory module imports this even in mock mode (per plan §verification "WORLD_PROVIDER=mock bun dev runs with no WLT_API_KEY in env").
  - `generate(input)`: POST `/worlds:generate` with body matching `WorldsGenerateRequest` (model `marble-1.0-draft`, `world_prompt`, optional `display_name`). Returns `{ operation_id }`.
  - `poll(operation_id)`: GET `/operations/{id}`. On `done: false` → `{ done: false }`. On `done: true` → walk response to find SPZ splat URL (the `assets.splats.spz_urls` map — first non-empty value). Return `{ done: true, splat_url }`. On `error` field set → throw `MarbleOperationError`.
  - **Retry policy**: one retry with 1s delay on 5xx response or fetch network error. Apply to both methods.
  - **Status mapping** (after retry exhausted): 401 → `MarbleAuthError`; 429 → `MarbleRateLimitError`; 5xx → `MarbleServerError`. Other non-2xx → `MarbleServerError` with the body included.
  - 404 on poll → `MarbleOperationError` with `kind: 'expired'` so route handler (Phase 3) can re-generate.
  - **No `??` fallback chains in response parsing.** Use the typed shapes from `marble.gen.ts`.
  - Export both as named exports AND export a class `WorldlabsProvider implements WorldGenerator`. The factory uses the class instance.

- `lib/sleuth/world-generator/mock.ts`
  - `MockProvider implements WorldGenerator`.
  - Constructor: `constructor(scriptIdToSplat: Map<string, string> = new Map(), fallbackSplatUrl: string = DEFAULT_FALLBACK_SPLAT_URL)`.
  - Export const `DEFAULT_FALLBACK_SPLAT_URL = '/splats/sleuth/the-empress-last-tea-cached.splat'` (relative URL served from `public/`; the actual binary lands there in Phase 1's safety-net commit).
  - `generate({ script_id })`: returns `{ operation_id: 'mock-' + script_id + '-' + Date.now() }`. Stores `op_id → splat_url` in an internal map (`scriptIdToSplat[script_id] ?? fallbackSplatUrl`).
  - `poll(operation_id)`: looks up the stored splat url; returns `{ done: true, splat_url }`. If unknown op_id, returns the fallback splat — never throws.

- `lib/sleuth/world-generator/index.ts`
  - Reads `process.env.SLEUTH_WORLD_PROVIDER` (per CONTEXT.md, NOT `WORLD_PROVIDER`). Default `'worldlabs'`.
  - Exports a singleton `worldGenerator: WorldGenerator` constructed once per module load.
  - When provider is `'worldlabs'`: returns a wrapping `WorldGenerator` that:
    - On `generate(input)`: tries `worldlabsProvider.generate(input)`; on **any thrown error**, calls `mockProvider.generate(input)` and returns `{ operation_id, degraded: true }`.
    - On `poll(op_id)`: routes by op_id prefix. If starts with `'mock-'` → mock.poll. Else → worldlabs.poll. If worldlabs.poll throws → falls back to mock.poll(op_id) which returns the fallback splat with `degraded: true` flag.
  - When provider is `'mock'`: returns the bare `MockProvider`.
  - Also export `createWorldGenerator(provider?: 'worldlabs' | 'mock', overrides?: { worldlabs?: WorldGenerator; mock?: WorldGenerator }): WorldGenerator` — testable factory used by the tests; the singleton call site uses it with no args.

### Tests (3 files, 11 cases)

- `test/sleuth/world-generator/worldlabs.test.ts` — **8 cases**
  - generate paths (4):
    1. 200 OK → returns `{ operation_id: 'op_xxx' }`. Verifies `WLT-Api-Key` header sent and URL is `/worlds:generate`.
    2. 401 → `MarbleAuthError` (no retry on 4xx).
    3. 429 → `MarbleRateLimitError` (no retry).
    4. 5xx then 200 OK on retry → success. (Verifies one retry happens with ~1s delay; use `vi.useFakeTimers()`.)
  - poll paths (4):
    5. `done: false` → returns `{ done: false }`.
    6. `done: true` with assets.splats.spz_urls → returns `{ done: true, splat_url }`.
    7. response with `error` field → throws `MarbleOperationError`.
    8. 404 → throws `MarbleOperationError` with `kind: 'expired'`.
  - Use `vi.stubGlobal('fetch', vi.fn(...))` to mock network. Set `WLT_API_KEY` via `vi.stubEnv` per test.

- `test/sleuth/world-generator/factory.test.ts` — **3 cases**
  1. `createWorldGenerator('mock')` → `generate` returns `{ operation_id }` (no degraded flag).
  2. `createWorldGenerator('worldlabs', { worldlabs: stubSucceed, mock: stubMock })` → uses worldlabs, no degraded flag.
  3. **Demo-day safety net regression**: `createWorldGenerator('worldlabs', { worldlabs: stubThrow, mock: stubMock })` → returns `{ operation_id, degraded: true }`, mock was called with the same `script_id`. Comment this test as `// Demo-day safety-net regression — when Marble flickers on stage, the demo still plays.`

- `test/sleuth/world-generator/mock.test.ts` — **2 cases**
  1. `script_id` present in map → poll returns the mapped splat url.
  2. `script_id` not in map → poll returns the `DEFAULT_FALLBACK_SPLAT_URL`.

## Verification gate (run before opening PR)
```bash
pnpm lint
pnpm typecheck
pnpm test  # all 11 new vitest cases pass; no "skipped"
```

## Out of scope
- API routes (Phase 3).
- Drizzle/SQLite (Phase 3).
- Saving the cached splat binary (already addressed in Phase 1's scope).
- Modifying any PageWorld code.
- Generating new openapi types — `marble.gen.ts` is already in place.

# Phase 4 Check — LLM And Images

## Inputs Checked
- Binding overlay read: `.autopilot/CONTEXT.md`
- Source plan read: `sleuth-autopilot-prompt.md` Phase 4
- Existing Sleuth phases present:
  - Phase 2 world generator under `lib/sleuth/world-generator/*`
  - Phase 3 SQLite + API tests under `test/sleuth/api/*`
- Phase docs directory created: `docs/build/llm-and-images/`
- Branch created from Phase 3 tip: `autopilot/llm-and-images`

## Conflicts Resolved
- The generic resume prompt says branch from `main`.
- The binding overlay says Phase 4 must continue from `autopilot/db-and-api` because phases 2 and 3 are approved but intentionally unmerged.
- Resolution: branch `autopilot/llm-and-images` from the current Phase 3 tip.

## Phase 4 Reality
- Sleuth Backboard chat must use the real Backboard HTTP API shape from `lib/backboard.ts`.
- No `BACKBOARD_BASE_URL`; use `BACKBOARD_API_KEY`, `SLEUTH_MODEL_FAST`, and `SLEUTH_MODEL_PROSE`.
- Sleuth portraits use a new direct OpenAI client under `lib/sleuth/images/client.ts`.
- PageWorld code remains read-only.

## Deliverables
- `lib/sleuth/llm/client.ts`
- `lib/sleuth/images/client.ts`
- `test/sleuth/llm/client.test.ts`
- `test/sleuth/images/client.test.ts`

## Verification Target
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

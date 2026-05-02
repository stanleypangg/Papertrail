# Phase 4 Brief — LLM And Images

## Goal
Add two isolated Sleuth clients:

1. A Backboard chat client for host narration and NPC replies under `lib/sleuth/llm/client.ts`
2. A direct OpenAI portrait generator under `lib/sleuth/images/client.ts`

Both clients need explicit retry/fallback behavior and their own test files. The result must stay fully namespaced under Sleuth so PageWorld keeps working unchanged.

## Scope
- Build the Sleuth LLM client against the real Backboard API contract.
- Build the Sleuth image client against direct OpenAI image generation.
- Keep env loading strict via `requireEnv()`.
- Cover exactly six new unit-test paths:
  - LLM: success, retry-then-success, retry-then-fallback
  - Images: cache hit, cache miss/write, SDK failure propagates

## Non-Goals
- No new UI routes in this phase
- No portrait placeholder route yet
- No changes to existing PageWorld Backboard or image helpers
- No dev server run

## Acceptance Criteria
- `lib/sleuth/llm/client.ts` exposes host and NPC helpers with model separation and one retry on retryable failure.
- `lib/sleuth/images/client.ts` skips API calls when the output file already exists and writes a PNG on success.
- All six new tests pass, along with the existing Sleuth tests and repo-wide lint/type/build checks.

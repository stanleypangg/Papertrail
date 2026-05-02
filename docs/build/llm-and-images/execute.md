# Phase 4 Execute — LLM And Images

## Work Completed
- Added `lib/sleuth/llm/client.ts`
  - Backboard HTTP client against `https://app.backboard.io/api/threads/messages`
  - `streamHost()` on `SLEUTH_MODEL_PROSE`
  - `npcReply()` on `SLEUTH_MODEL_FAST`
  - one retry on network / 5xx failure
  - fallback line after repeated failure
  - resilient nested response parsing plus SSE stream parsing
- Added `lib/sleuth/images/client.ts`
  - direct OpenAI portrait generation
  - cache guard on existing output file
  - base64 decode to PNG bytes
  - gated fallback from `gpt-image-1` to `dall-e-3` on model-access errors
- Added tests
  - `test/sleuth/llm/client.test.ts`
  - `test/sleuth/images/client.test.ts`

## TDD Record
- Wrote the two new test files before the production clients existed.
- Ran targeted tests and confirmed red via missing-module failures.
- Implemented the clients.
- Re-ran targeted tests to green.

## Adjustment During Execution
- `pnpm typecheck` surfaced one issue in the image client because `openai.images.generate()` is typed as a union that can include streaming responses.
- Fixed by narrowing the response before reading `response.data`.

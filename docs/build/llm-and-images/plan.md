# Phase 4 Plan — LLM And Images

## Implementation Order
1. Add failing tests for the Sleuth LLM client.
2. Add failing tests for the Sleuth image client.
3. Implement `lib/sleuth/llm/client.ts` with:
   - Backboard request builder
   - `streamHost()` using `SLEUTH_MODEL_PROSE`
   - `npcReply()` using `SLEUTH_MODEL_FAST`
   - single retry on retryable network/5xx failure
   - host-style fallback line after repeated failure
4. Implement `lib/sleuth/images/client.ts` with:
   - direct OpenAI client
   - portrait prompt suffix
   - file existence short-circuit
   - base64 decode and write to disk
   - model fallback from `gpt-image-1` to `dall-e-3` only when access is denied
5. Run targeted tests, then full repo verification.
6. Record results in execute/verify docs, commit, push, PR, and update autopilot state.

## Design Notes
- Keep the LLM client independent from PageWorld's `lib/backboard.ts`, but mirror the proven request shape and parsing strategy.
- Prefer small internal helpers for request execution, retry classification, response text extraction, and prompt assembly.
- Keep the image client synchronous on disk writes for simplicity and predictable tests.

## Risks
- Backboard response payloads are nested and inconsistent.
- OpenAI image responses may be base64 or URL based depending on model behavior.
- `next build` may surface server/runtime typing constraints not exercised by targeted tests.

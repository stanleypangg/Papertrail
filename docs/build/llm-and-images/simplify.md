# Phase 4 Simplify — LLM And Images

## Simplification Pass
- Kept the Sleuth clients isolated from PageWorld instead of sharing abstractions across namespaces.
- Limited the LLM surface to two exported helpers: `streamHost()` and `npcReply()`.
- Kept retry behavior fixed at one retry because that is the explicit phase requirement.
- Centralized nested response extraction and SSE parsing into private helpers inside the LLM client.
- Kept portrait generation to a single exported helper with a file-path cache guard and minimal model fallback logic.

## Outcome
- The code paths are small, phase-local, and directly testable.
- No extra provider framework or shared cross-app helper was introduced.

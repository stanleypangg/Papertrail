# Phase 5 Brief — Demo Script

## Goal
Ship one complete Sleuth script, `the-empress-last-tea`, with enough typed structure for later phases to render the cast page, run NPC prompts, place sprites in 3D space, and score the ending.

## Scope
- Define the script schema and exported TypeScript types.
- Add a loader that validates JSON at runtime and returns typed data.
- Create one full script JSON with:
  - world prompt
  - 5-character cast
  - at least 3 clues
  - 3 endings
- Commit placeholder portrait PNGs for every cast member.
- Add tests that pin the loader behavior and the core demo invariants.

## Non-Goals
- No cast-page UI in this phase
- No portrait generation route yet
- No play-page or scoring route yet
- No PageWorld file changes

## Acceptance Criteria
- `loadScript("the-empress-last-tea")` returns a typed object with no runtime errors.
- The script has at least 5 cast members and exactly 1 murderer.
- Every cast member references a portrait path that exists under `public/portraits/sleuth/`.
- Verification passes across lint, typecheck, tests, and build.

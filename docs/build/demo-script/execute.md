# Phase 5 Execute — Demo Script

## Work Completed
- Added `lib/sleuth/scripts.types.ts`
  - zod schema for world prompt, cast, clues, and endings
  - exported TypeScript types for later UI and LLM phases
- Added `lib/sleuth/scripts.ts`
  - synchronous file-based `loadScript(id)`
  - runtime validation through zod
  - clear unknown-script error path
- Added `data/scripts/the-empress-last-tea.json`
  - 5 playable characters
  - 4 clues
  - 3 endings
  - one murderer
- Generated five committed placeholder portrait PNGs in `public/portraits/sleuth/`
- Added `test/sleuth/scripts.test.ts`

## TDD Record
- Wrote the script-loader test file before the module existed.
- Ran the targeted test and confirmed red via missing-module failures.
- Implemented the loader, schema, script JSON, and placeholder portraits.
- Re-ran the targeted test to green.

## Asset Generation Note
- Placeholder portraits were generated locally via a temporary SVG template converted to PNG with `sips`.
- No new runtime dependency or image-generation build step was introduced.

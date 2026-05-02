# Phase 5 Plan — Demo Script

## Implementation Order
1. Add failing tests for script loading and demo-script invariants.
2. Add `lib/sleuth/scripts.types.ts` with the script schema and exported types.
3. Add `lib/sleuth/scripts.ts` with runtime validation and `loadScript(id)`.
4. Add `data/scripts/the-empress-last-tea.json`.
5. Generate placeholder portrait PNGs under `public/portraits/sleuth/`.
6. Run targeted tests, then full repo verification.

## Testing Plan
- One test for successful typed load of the demo script.
- One test for script invariants:
  - cast length `>= 5`
  - exactly one murderer
  - every portrait file exists on disk
- One test for unknown script id throwing a clear error.

## Design Notes
- Keep the loader synchronous and file-based for simplicity in server components.
- Use zod to validate the entire JSON payload at load time.
- Keep script data explicit and readable rather than compressing it into helper-generated structures.

## Risks
- JSON structure drift between the data file and the later LLM/UI consumers.
- Placeholder portrait filenames drifting from the JSON paths.

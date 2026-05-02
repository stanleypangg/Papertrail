# Phase 6 Check — Cast Page

## Inputs Checked
- Binding overlay read: `.autopilot/CONTEXT.md`
- Source plan read: `sleuth-autopilot-prompt.md` Phase 6
- Current stack tip: `autopilot/cast-page` branched from `autopilot/demo-script`
- Existing Sleuth assets present:
  - typed script loader and demo script
  - world generation API routes
  - portrait placeholders and image client

## Constraint Reconciliation
- World generation route is secret-gated, so the cast page cannot safely trigger it from a raw browser POST with the secret exposed.
- Placeholder portraits currently exist at the final portrait paths, so real portrait generation needs an explicit overwrite path.

## Phase 6 Decisions
- Keep the cast page itself server-rendered and kick off background jobs from the server side.
- Add `portraits_generated_at` to the existing `sleuth_worlds` row as the one-shot gate for portrait generation.
- Extend the Sleuth image client with an explicit overwrite option so generated portraits can replace placeholders.

## Deliverables
- `app/scripts/[id]/page.tsx`
- `components/sleuth/CharacterSelect.tsx`
- `app/api/sleuth/portraits/generate/route.ts`
- DB/schema support for portrait-generation gating
- tests for the portrait route and image overwrite behavior

## Verification Target
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

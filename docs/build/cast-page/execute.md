# Phase 6 Execute — Cast Page

## Work Completed
- Added `app/scripts/[id]/page.tsx`
  - loads a Sleuth script by id
  - renders the cast page with dedicated fonts and art direction
  - kicks off background world + portrait warmup jobs from the server side
- Added `components/sleuth/CharacterSelect.tsx`
  - asymmetrical poster-style desktop composition
  - cleaner stacked mobile layout
  - hover dimming and cinnabar rim-light treatment
  - character click routing to `/scripts/[id]/play?character=<id>`
- Added `app/api/sleuth/portraits/generate/route.ts`
  - secret-gated internal portrait generation route
  - one-shot gate via `portraits_generated_at`
  - force-overwrite behavior so generated portraits can replace placeholders
- Extended the existing Sleuth DB schema/client and image client to support portrait warmup safely.
- Added tests for the portrait route and overwrite behavior.

## TDD Record
- Wrote tests for portrait-route behavior and image overwrite behavior first.
- Confirmed red:
  - missing portrait route
  - existing cache guard blocked overwrite
- Implemented the DB column, overwrite flag, route, and page/component.
- Re-ran targeted tests, then full verification to green.

## Design Note
- The page keeps the strong poster composition on large screens while switching to a tighter stacked treatment on mobile rather than collapsing into a generic card grid.

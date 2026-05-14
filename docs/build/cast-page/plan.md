# Phase 6 Plan — Cast Page

## Implementation Order
1. Add failing tests for:
   - portrait generation route behavior
   - image-client overwrite behavior for placeholder replacement
2. Extend the DB schema/client with `portraits_generated_at`.
3. Extend `generatePortrait()` with an explicit overwrite option.
4. Add `app/api/sleuth/portraits/generate/route.ts`.
5. Add `components/sleuth/CharacterSelect.tsx`.
6. Add `app/scripts/[id]/page.tsx` and kick off background world/portrait generation from the server side.
7. Run targeted tests, then full verification.

## Design Notes
- Use a deliberately asymmetrical poster composition on desktop and a cleaner stacked layout on mobile.
- Use Cormorant / Garamond for display and serif copy, with a non-default sans for UI labels.
- Prefer server-side job kickoff to avoid exposing `SLEUTH_SECRET` in the browser.

## Risks
- Background job kickoff from a server component must not block page render.
- DB schema drift could break earlier phases if the nullable portrait column is not added compatibly.

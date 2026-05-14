# Phase 6 Brief — Cast Page

## Goal
Build the first playable Sleuth surface: a high-intent cast-selection page at `/scripts/[id]` that loads the demo script, presents the cast as a poster-style composition, and kicks off background world/portrait generation for later phases.

## Scope
- Add the cast page route and poster-style client component.
- Trigger world generation and portrait generation in the background without blocking initial render.
- Add a portrait-generation route and one-shot gate.
- Preserve the established Sleuth namespace and avoid touching PageWorld UI files.

## Non-Goals
- No play page yet
- No accusation flow yet
- No requirement to expose the secret-gated world route directly to the browser
- No PageWorld home-page integration

## Acceptance Criteria
- `/scripts/the-empress-last-tea` renders with the intended 1924 Shanghai visual direction and five selectable characters.
- Each selection navigates to `/scripts/the-empress-last-tea/play?character=<id>`.
- Portrait generation is gated so placeholders can be replaced once without repeated regeneration on every request.
- Repo verification stays green.

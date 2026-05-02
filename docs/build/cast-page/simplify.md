# Phase 6 Simplify — Cast Page

## Simplification Pass
- Kept the page warmup flow on the server side to preserve the secret-gated route design.
- Reused the existing `sleuth_worlds` row for portrait-generation gating instead of introducing a separate table.
- Limited the UI surface to one route and one client component.

## Outcome
- The phase introduces the cast page without pulling later play-page concerns into the same code path.
- Placeholder replacement, background job kickoff, and poster layout each have one clear home.

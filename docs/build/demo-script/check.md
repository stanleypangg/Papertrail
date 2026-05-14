# Phase 5 Check — Demo Script

## Inputs Checked
- Binding overlay read: `.autopilot/CONTEXT.md`
- Source plan read: `sleuth-autopilot-prompt.md` Phase 5
- Current stack tip: `autopilot/demo-script` branched from `autopilot/llm-and-images`
- Existing Sleuth foundations present:
  - world generator and API routes
  - LLM and image clients
  - `public/portraits/sleuth/` and `data/scripts/` directories available or creatable

## Phase 5 Reality
- This phase is data- and loader-focused. No UI routes yet.
- Script loading must stay namespaced under `lib/sleuth/*`.
- Placeholder portraits need to be committed as PNGs so later pages never show broken images before real portrait generation runs.

## Asset Path Decision
- Local tool available: `/usr/bin/sips`
- Confirmed path: temporary SVG → PNG conversion works
- Plan: generate five committed placeholder PNGs for the cast using a temporary SVG template and `sips`

## Deliverables
- `data/scripts/the-empress-last-tea.json`
- `lib/sleuth/scripts.types.ts`
- `lib/sleuth/scripts.ts`
- placeholder portrait PNGs under `public/portraits/sleuth/`
- tests for script loading and demo-script invariants

## Verification Target
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

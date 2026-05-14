# Accusation Ending Check

- Phase 7 play-page code is present locally in the worktree and used as the base.
- Sleuth namespace constraint remains intact: accusation work is limited to `app/api/sleuth`, `components/sleuth`, `lib/sleuth`, and tests/docs.
- Existing script endings already provide the static scoring constants and fallback narration.
- Required verification remains `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

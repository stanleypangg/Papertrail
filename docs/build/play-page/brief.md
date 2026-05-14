# Play Page Brief

## Goal

Ship `/scripts/[id]/play?character=<id>` with:

- redirect on missing or invalid `character`
- SQLite-backed initial world state
- polling UI while a world is pending
- degraded badge for mock fallback worlds
- Spark-based splat viewer with NPC positions
- host opening rendered through `streamHost`
- NPC conversations powered by `npcReply`
- 12-turn cap per NPC with host intervention

## Constraints

- No PageWorld edits outside Sleuth namespaces
- No local dev server
- `pnpm` only

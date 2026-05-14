# Play Page Execute

## Implemented

- Added `app/scripts/[id]/play/page.tsx` as the server entrypoint.
- Extended `lib/sleuth/scripts.ts` with play-page helpers for character resolution and host/NPC prompt composition.
- Added `components/sleuth/world-status.tsx` for pending/error polling UI against `/api/sleuth/worlds/[operationId]`.
- Added `components/sleuth/world-viewer.tsx` for Canvas, Spark splat loading, entry camera motion, WASD movement, and NPC placement.
- Added `components/sleuth/npc-sprite.tsx` for clickable portrait sprites and keyboard-focusable world anchors.
- Added `components/sleuth/script-reader.tsx` for the paper transcript panel and overall play layout.
- Added `components/sleuth/npc-chat.tsx` for NPC-scoped chat with 12-turn enforcement.
- Added phase-specific tests for play logic, world status, and NPC chat caps.

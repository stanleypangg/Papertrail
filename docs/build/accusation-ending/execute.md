# Accusation Ending Execute

## Implemented

- Added `lib/sleuth/score.ts` for score computation, fallback narration assembly, ending prompt composition, and secret-reveal detection.
- Added `app/api/sleuth/score/route.ts` for verdict scoring and narration generation through `streamHost`.
- Added `components/sleuth/accusation-modal.tsx` for the suspect selection UI.
- Added `components/sleuth/ending-card.tsx` for the full-screen verdict takeover.
- Extended `components/sleuth/script-reader.tsx` to:
  - open the accusation modal
  - call the score route
  - track the simple `player_secret_uncovered` flag from NPC replies
  - display the final ending card
- Added score-specific API and helper tests.

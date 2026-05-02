# Accusation Ending Brief

## Goal

Add the final accusation flow to the Sleuth play page:

- open an accusation modal from the reader panel
- score the accusation against the script data
- apply the secret-defended bonus only when the player's secret stayed hidden
- render a full-screen ending card with generated narration and score

## Constraints

- stay inside Sleuth namespaces
- stack on the current play-page branch tip without rebasing earlier phase branches
- keep the demo playable even if narration generation falls back

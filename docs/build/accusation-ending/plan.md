# Accusation Ending Plan

1. Add failing tests for score computation, secret-exposure detection, and the score API contract.
2. Implement pure score helpers in `lib/sleuth/score.ts`.
3. Implement `POST /api/sleuth/score` with script loading, scoring, and generated ending narration.
4. Add accusation modal and ending card components.
5. Integrate accusation and ending state into the existing play-page reader.
6. Run the full verification gate.

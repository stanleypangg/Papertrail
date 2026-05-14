# Accusation Ending Simplify

- Kept scoring as pure data logic in `lib/sleuth/score.ts` instead of embedding it in the route or UI.
- Used the script JSON as the fallback source of truth for ending narration so the demo does not block on LLM output.
- Reused the existing reader shell as the single state owner for accusation, verdict, transcript, and secret exposure.

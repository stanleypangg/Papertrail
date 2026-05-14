# Play Page Simplify

- Kept world polling isolated inside `world-status.tsx`.
- Kept prompt-building logic inside `lib/sleuth/scripts.ts` instead of scattering strings across components.
- Used one top-level client shell (`script-reader.tsx`) to coordinate viewer state, transcript state, and NPC conversations.
- Avoided new Sleuth API routes by using a server action for NPC chat.

# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js App Router TypeScript MVP for PageWorld.

- `app/` contains pages, global styles, metadata, and API routes.
- `app/api/parse-pdf`, `app/api/generate-scenes`, `app/api/generate-scene-image`, and `app/api/generate-scene-narration` contain backend route handlers.
- `components/` contains UI components such as upload, scene cards, loading/error states, and panels.
- `components/three/` contains React Three Fiber world code, first-person controls, layout archetypes, and primitive interactable objects.
- `lib/` contains shared schema, demo data, PDF parsing, provider adapters, prompts, and scene mapping.
- Static app assets live under `app/`, such as `app/icon.svg`.

## Build, Test, and Development Commands

Use `pnpm` for dependency management.

- Do not run local dev servers.
- `pnpm install` installs dependencies.
- `pnpm dev` starts the local Next.js dev server at `http://localhost:3000`.
- `pnpm lint` runs ESLint across the repo.
- `pnpm typecheck` runs TypeScript without emitting files.
- `pnpm build` creates a production build and validates routes.

## Coding Style & Naming Conventions

Use TypeScript, React function components, and strict typing. Prefer named exports for reusable components and helpers. Component files use `PascalCase.tsx`; library files use `camelCase.ts`. Keep provider-specific code isolated in `lib/backboard.ts` and `lib/imageGeneration.ts`.

Use 2-space indentation and concise comments only where implementation intent is not obvious. Run `pnpm lint` and `pnpm typecheck` before handing off changes.

## Testing Guidelines

There is no committed automated test suite yet. For now, verify changes with:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm build`
4. Manual browser QA on `pnpm dev`

For UI changes, check the upload screen, demo data path, scene cards, 3D canvas, object clicks, and portal transitions.

## Commit & Pull Request Guidelines

This repository has no existing commit history, so use clear imperative commit messages, for example: `Add PDF parsing route` or `Fix world viewer controls`.

Pull requests should include a short summary, verification commands run, relevant screenshots or screen recordings for UI/3D changes, and any API-key or provider limitations discovered during testing.

## Security & Configuration Tips

Do not commit `.env` files or API keys. Expected variables are `BACKBOARD_API_KEY`, optional `OPENAI_API_KEY`, and optional ElevenLabs narration variables `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, and `ELEVENLABS_MODEL_ID`. Provider failures must keep falling back to demo data so the hackathon demo remains playable.

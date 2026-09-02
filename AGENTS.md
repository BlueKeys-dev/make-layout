# Repository Guidelines

## Project Structure & Module Organization

This is a React 19 and TypeScript application built with Vite. `index.tsx` mounts the app, while `App.tsx` and `components/DesignEditor.tsx` provide the main editor shell and state flow. Keep reusable UI in `components/`, interaction logic in `hooks/`, external or domain operations in `services/`, shared helpers in `utils/`, and defaults in `config/`. Shared models live in `types.ts` and `types/`. Static assets belong in `public/`; design notes and implementation plans belong in `docs/` and `plans/`. Tests currently sit beside the code they cover, for example `services/layoutTemplates.test.ts`.

## Build, Test, and Development Commands

- `npm install` installs the dependencies recorded in `package-lock.json`.
- `npm run dev` starts Vite on port 3000 for local development.
- `npm run build` creates the production bundle and reports bundling errors.
- `npm run preview` serves the built bundle for a final browser check.
- `node --test services/layoutTemplates.test.ts` runs the existing focused Node test.

Set `GEMINI_API_KEY` in `.env.local` before using AI features. Some integrations may also require `UNSPLASH_ACCESS_KEY`.

## Coding Style & Naming Conventions

Follow the existing TypeScript style: semicolons, single quotes, trailing commas in multiline structures, and four-space indentation in component logic. Use `PascalCase` for React components and exported types, `camelCase` for functions and variables, and the `useName` pattern for hooks. Prefer the `@/` alias for stable root imports. No formatter or linter is configured, so keep edits narrowly formatted and consistent with surrounding code.

## Testing Guidelines

Tests use `node:test` with `node:assert/strict`. Name files `*.test.ts` beside the module under test. Add focused coverage only for changed behavior: one main path and, when important, one failure path. There is no repository-wide coverage threshold.

## Commit & Pull Request Guidelines

Recent history generally uses short prefixes such as `feat:`, `fix:`, `refactor:`, and `chore:`. Write an imperative summary describing one focused change. Pull requests should explain the user-visible result, list verification steps, link a relevant issue when one exists, and include screenshots or a short recording for editor UI changes. Never commit `.env.local`, API keys, generated bundles, or local scratch files.

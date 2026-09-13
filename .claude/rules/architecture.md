# Architecture Rules

## Responsibilities

Keep responsibilities separated:

- UI components → rendering and user interaction
- Hooks → reusable client-side behavior
- Services → API/external communication
- Utilities → pure transformations and validation
- Types → domain contracts
- AI modules → generation, orchestration, parsing, validation

## Feature Structure

For substantial features prefer:

features/<feature>/
components/
hooks/
utils/
types.ts

Code that talks to external systems (AI providers, browser storage, other APIs)
lives in the top-level `services/` folder, grouped by system rather than by feature:

services/
ai/ → agents/, tools/, api/
localStorage/ → one file per stored data set (decks.ts, chat.ts)

Use shared `design-system/`, `hooks/`, `lib/`, and `types/` only when code is
genuinely reusable.

Shared UI primitives live in `design-system/components/<name>/index.tsx`. Split a component's
variables, types or utils into separate files in that folder only when the file is large.

App-wide theming (light/dark mode) lives in the top-level `theme/` folder, next to
`services/`, e.g. `theme/color-mode-menu/index.tsx`. Slide themes stay in `features/themes/`.

## Rules

- Keep pages and layouts thin.
- Avoid API calls scattered across UI components.
- Keep business logic out of presentation-only components.
- Avoid circular dependencies.
- Prefer one clear source of truth for domain state.
- Keep persisted presentation data separate from temporary editor state when useful.
- Avoid global state unless there is a real cross-feature requirement.
- Do not create architectural layers without a concrete reason.
- Prefer composition over inheritance.

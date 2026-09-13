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
services/
utils/
types.ts

Use shared `components/`, `hooks/`, `lib/`, and `types/` only when code is
genuinely reusable.

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

# Coding Standards

## TypeScript

- Use strict TypeScript.
- Avoid `any`.
- Avoid non-null assertions.
- Prefer discriminated unions for meaningful state variants.
- Type public function inputs and outputs.
- Prefer domain-specific types over generic objects.
- Do not suppress TypeScript errors without understanding the cause.

## Code Quality

- Use descriptive names.
- Keep functions focused.
- Prefer early returns for invalid/error cases.
- Avoid deeply nested conditionals.
- Avoid duplicated business logic.
- Prefer native JavaScript methods when readable.
- Do not add dependencies for trivial functionality.
- Remove dead code and debug statements.

## Error Handling

- Handle expected failures explicitly.
- Do not silently swallow errors.
- Provide useful UI error states.
- Preserve useful error information for debugging.

## Changes

- Make the smallest change that solves the requirement.
- Follow existing project conventions.
- Do not refactor unrelated code.
- Do not create abstractions until reuse is real or clearly justified.
- Do not modify configuration unless required.

# Testing Rules

## Stack

Use:

- Vitest
- React Testing Library
- MSW for network mocking where appropriate

Use `test()` instead of `it()`.

## Priorities

Prioritize tests for:

- Important user flows
- Business logic
- API behavior
- AI output validation
- Editor interactions
- Loading states
- Error states
- Empty states
- Regression bugs

## Principles

- Test observable behavior.
- Avoid implementation-detail assertions.
- Prefer realistic component usage.
- Avoid unnecessary mocks.
- Do not mock components simply to make tests easier.
- Keep tests deterministic.
- Reuse MSW handlers for API scenarios.
- Do not write tests only to increase coverage.

## Regression

When fixing a meaningful bug, add a focused regression test where practical.

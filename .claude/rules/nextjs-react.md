# Next.js and React Rules

## Next.js

- Use the App Router.
- Prefer Server Components by default.
- Add `"use client"` only when client-side behavior requires it.
- Keep server-only code away from client modules.
- Use route handlers/services for backend communication where appropriate.
- Keep secrets in server-side environment variables.
- Use `loading`, `error`, and `not-kefound` boundaries where useful.
- Follow Next.js metadata conventions.

## Client/Server Boundary

Before adding `"use client"`, determine whether the functionality can remain
server-side.

Do not convert an entire page to a Client Component because one child requires
interactivity.

Keep interactive functionality isolated in Client Components.

## React

- Use functional components.
- Keep components focused.
- Prefer composition.
- Avoid unnecessary `useEffect`.
- Avoid derived state.
- Keep state close to where it is used.
- Use stable React keys.
- Avoid premature memoization.
- Extract complex interaction logic into hooks.

## Performance

- Avoid unnecessary client-side rendering.
- Avoid unnecessary state updates.
- Avoid expensive calculations during render.
- Lazy-load genuinely large client-side features when appropriate.

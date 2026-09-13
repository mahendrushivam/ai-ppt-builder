# UI and UX Rules

## Components

- Reuse existing UI primitives before creating new ones.
- Keep reusable components focused.
- Do not create generic components without a real reuse case.
- Keep presentation/editor-specific logic inside the relevant feature.

## UX States

Consider:

- Loading
- Empty
- Error
- Disabled
- Success/confirmation
- Saving
- Generating
- Cancelled/interrupted

## Accessibility

- Use semantic HTML where possible.
- Provide accessible labels for controls.
- Support keyboard interaction.
- Ensure focus behavior is sensible.
- Do not rely only on color to communicate state.

## Presentation Editor

- Keep editing responsive.
- Avoid unnecessary rerenders for large slide content.
- Separate temporary editor state from persisted data where appropriate.
- Preserve user edits during asynchronous AI operations.
- Make destructive actions explicit.
- Give users clear feedback during generation.

## Styling

- Follow the existing styling system.
- Reuse design tokens and primitives.
- Avoid duplicated magic values.
- Keep spacing and typography consistent.
- Avoid unnecessary inline styles.

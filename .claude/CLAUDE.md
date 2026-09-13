## Project Rules

Detailed project-specific rules are stored in `.claude/rules/`.

Before implementing or modifying code:

- Read the relevant rule files from `.claude/rules/`.
- Apply all rules relevant to the current task.
- Do not load unrelated rules unnecessarily.
- Follow these rules together with the existing project conventions and explicit task requirements.
- Prefer existing project patterns when they are more specific than generic rules.

Rule files:

- `architecture.md` → project structure and separation of responsibilities
- `coding-standards.md` → TypeScript and general coding standards
- `nextjs-react.md` → Next.js and React conventions
- `testing.md` → testing standards
- `ui.md` → UI/UX and accessibility
- `ai-presentation.md` → AI generation, streaming, validation, and presentation logic

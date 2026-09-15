# AI Presentation Builder

Describe a presentation, review the outline the AI proposes, and watch the slides appear one by one. Then refine the deck by chatting with the AI or by editing it directly — both work on the same slide data, so neither undoes the other.

**Live app:** _add the Vercel URL here after deploying_

## Features

- **Generate from a prompt:** the AI drafts an outline you can edit, then generates the slides one at a time, streamed into the editor as each is ready.
- **Refine through chat:** "make slide 3 more concise", "add a pricing slide before the conclusion". The AI changes only the slides it needs to, through tool calls.
- **Edit manually:** edit text, notes, tables, charts and images in the slide settings panel (clicking text on the slide jumps to its field); add, delete, reorder and change the layout of slides; add, replace, move and resize content blocks on the slide.
- **Rich content:** bullet lists, paragraphs, tables, 12 chart types and images (stock photo search or your own uploads).
- **Direct manipulation:** drag blocks within and between columns, drag slides in the slide list, drag the gap between columns or blocks to resize them. Everything also works with the keyboard.
- **Undo/redo** across manual and AI changes.
- **Themes:** four slide themes, plus light and dark mode for the app.
- **Multiple presentations**, saved in the browser.
- **Export:** print to PDF, or download a slide as PNG.

## Setup

Requirements: Node.js 20.9 or later, npm, and a [Sarvam](https://www.sarvam.ai/) API key.

```bash
npm install
```

Create `.env.local` in the project root:

```bash
SARVAM_API_KEY=your-key-here
```

The key is only read on the server (`lib/env.ts`) and is never sent to the browser. `.env*` files are ignored by git. If the key is missing, the app still starts and AI requests report the problem.

```bash
npm run dev        # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit and component tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

### Deploying to Vercel

Import the repository in Vercel, add `SARVAM_API_KEY` under Settings → Environment Variables, and deploy. No other configuration is needed; the AI routes set their own `maxDuration` (up to 300 seconds for deck generation).

## Architecture

### The core idea

Every change to a deck — typing in the editor, dragging a block, an AI tool call — is a **`DeckOperation`** applied by one pure function, `applyOperation(deck, operation)` in `features/deck/utils/operations.ts`. Operations are validated against the same zod schema as saved decks, and operations that edit a slide carry the slide's `revision`: if the slide changed since the operation was prepared (for example you edited it while the AI was working), the operation is rejected instead of overwriting your edit.

This is what makes AI edits targeted: the model never returns a whole deck, only operations for the slides it changes.

### Data flow

```mermaid
flowchart LR
  subgraph Browser
    Editor[Editor<br/>slide list · canvas · slide settings]
    Chat[AI chat · generation]
    Store[(Zustand deck store<br/>+ undo history)]
    Storage[(localStorage · IndexedDB)]
    Client[AI API client<br/>NDJSON reader]
  end

  subgraph Server["Next.js route handlers"]
    Routes[/api/ai/outline<br/>/api/ai/generate<br/>/api/ai/chat/]
    Agents[Agents<br/>tool loop · validation]
    Sarvam[Sarvam client]
    Images[/api/images/search<br/>Openverse/]
  end

  Editor -- manual operations --> Store
  Chat --> Client -- deck snapshot + request --> Routes --> Agents --> Sarvam
  Agents --> Images
  Agents -- validated operations, streamed --> Client -- AI operations --> Store
  Store <--> Storage
```

The browser owns the deck. Each AI request sends a snapshot of the deck; the server keeps no state. During a chat request the server applies the model's operations to a working copy, so the model sees the result of its own earlier tool calls, and streams each operation back as it is accepted.

### AI pipeline

| Step | Where |
|---|---|
| Input | `features/ai/components` (chat panel, prompt and outline review), validated with zod before sending |
| Orchestration | `services/ai/agents`: `chat-agent.ts` (tool loop, up to 4 rounds), `outline-agent.ts`, `slide-generator.ts` |
| Tools | `services/ai/tools`: chat tools `add_slide`, `update_slide`, `delete_slide`, `move_slide`, `change_layout`; generation tools `create_outline`, `create_slide`. Tool parameters are JSON Schemas generated from zod. |
| Model | `services/ai/api/sarvam-client.ts`: `sarvam-105b`, streamed, retried on network and provider errors |
| Streaming | Upstream: Sarvam's SSE stream. Downstream: NDJSON events (`features/ai/utils/stream-protocol.ts`), read by `services/ai/api/api.ts` |
| Validation | Model input schemas (`features/ai/utils/slide-input.ts`) → domain objects with ids → `applyOperation` checks |
| Context | `features/ai/utils/deck-context.ts` describes the deck in compact text: numbered slides with ids, layouts, sizes and block content |
| State update | Deck store, with the same revision checks as manual edits |
| Rendering | `SlideRenderer`, which knows nothing about AI |

**Two-phase generation:** `/api/ai/outline` returns an outline (titles, key points and a planned visual per slide) that you can edit. `/api/ai/generate` then creates the slides one at a time, each with a forced `create_slide` tool call, and streams each slide into the deck as soon as it is valid. A failed slide can be retried on its own; stopping keeps the slides already generated.

### Folders

| Folder | Contents |
|---|---|
| `app/` | Routes: `/` (presentations), `/decks/[deckId]` (editor), `/decks/[deckId]/print`, and the API route handlers |
| `features/deck/` | Slide schema (zod), types, `DeckOperation` and `applyOperation` |
| `features/decks/` | Presentation list, Zustand store, saving |
| `features/editor/` | Editor: slide list, canvas with toolbar, drag and resize handles, slide settings, undo history |
| `features/renderer/` | Pure, read-only `SlideRenderer`, shared by the canvas, thumbnails, print view and PNG export |
| `features/ai/` | Chat and generation UI, stream protocol, model input schemas, deck context |
| `features/export/` | Print view and PNG export |
| `features/themes/` | Slide themes (design tokens) and theme picker |
| `services/` | External systems: Sarvam and agents (`ai/`), Openverse image search (`images/`), browser storage (`localStorage/`, `indexedDb/`) |
| `design-system/` | Shared UI components and charts (Recharts) |
| `lib/` | Server environment, request parsing |
| `testing/` | Test setup, fixtures, MSW handlers |

### The slide schema

A deck has slides; a slide has a layout (`title`, `section`, `content`, `two-column`, `comparison`), a title and subtitle, 0–2 columns of content blocks, speaker notes and layout hints (alignment, column split). Blocks are bullets, paragraph, table, chart or image, and each may have a height share. Limits (slides per deck, blocks per column, text lengths, chart shapes) live in `features/deck/utils/schema.ts` and apply equally to saved data, manual edits and AI output.

## Key decisions

- **Sarvam `sarvam-105b`** with OpenAI-style tool calling. Generation forces its tool with reasoning off, which was faster and more reliable than letting the model decide.
- **Export is print-to-PDF and PNG, not PPTX.** The print view renders every slide at 1280×720, one per page, and the browser's "Save as PDF" makes the file. This covers the brief's export requirement without a PPTX library.
- **Client-owned data, stateless server.** Decks and chat history are saved in `localStorage`, uploaded images in IndexedDB. There is no backend database or authentication, as allowed by the brief.
- **One renderer for everything.** Editing controls (toolbar, drop targets, resize handles) are layers over the renderer, so the canvas, thumbnails, print view and PNG export always match.
- **Layout-based editing, not free-form positioning.** Blocks live in columns; moving and resizing change their order, the column split and height shares. This keeps AI edits and manual edits on the same simple structure.
- **Drag and drop and resizing** use `@dnd-kit/core` / `@dnd-kit/sortable` and `react-resizable-panels`, chosen for keyboard support and screen reader announcements.
- **Generation is sequential**, one slide per model call, so each slide can be streamed and retried individually and a deck of up to 12 slides fits in Vercel's 300-second limit.

A longer write-up of the design is in [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).

## Known issues and limitations

- **Everything is saved in one browser.** Presentations live in `localStorage` and uploaded images in IndexedDB; they don't sync between browsers or devices. Clearing site data removes them.
- **No PPTX export** (see Key decisions).
- **Long chats:** only the last 20 messages are sent to the model, with the current deck. Older messages aren't summarized, so the AI can lose track of requests made much earlier in a long conversation.
- **Print page size** is set to 1280×720 with CSS `@page`. It was tested in Chrome; browsers that ignore it print on their own paper size, with slides scaled to the page width.
- **Undo history** is kept only while the presentation is open and is cleared on reload.
- **AI speed:** each model call takes several seconds, so a 12-slide deck takes a while to generate. Charts use illustrative numbers unless your prompt includes data; the speaker notes say so.
- **Canvas toolbar:** when a block has no free space around it, the floating toolbar covers the part of the slide with the least content.
- **Test coverage:** logic, API routes and editor flows are covered by Vitest tests. Drag and drop and resizing depend on real layout, which jsdom doesn't have, so they were verified in a browser rather than in unit tests.

## Tests

```bash
npm test
```

Vitest with React Testing Library. MSW mocks the app's AI routes and Sarvam (including a recorded Sarvam stream), and any unmocked network request fails the test run, so tests never call the real Sarvam or Openverse APIs.

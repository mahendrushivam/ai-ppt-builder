# AI Presentation Builder Rules

## AI Output

Treat all AI responses as untrusted external data.

- Validate generated presentation data before rendering.
- Define predictable schemas for structured slide data.
- Handle malformed responses.
- Handle incomplete responses.
- Handle empty responses.
- Never assume the model always follows the requested schema.

## Generation Pipeline

Keep these responsibilities separate:

1. User input
2. AI request/orchestration
3. Streaming/response handling
4. Parsing
5. Validation
6. Presentation state update
7. Rendering

Do not tightly couple AI responses directly to UI components.

## Streaming

When streaming is used:

- Show meaningful generation progress.
- Handle cancellation.
- Handle interrupted connections.
- Handle errors.
- Avoid corrupting existing presentation state with partial responses.
- Make retry behavior explicit.
- Preserve already generated valid content when possible.

## Presentation State

AI-generated content must remain editable.

Do not make normal editing dependent on the raw AI response structure.

Separate:

- Generated content
- Persisted presentation state
- Temporary generation state
- Editor/UI state

## Validation

Validate AI-generated:

- Slide structure
- Text content
- Layout values
- Component types
- Required fields
- IDs/references
- Data used by charts or visualizations

Invalid AI output should fail gracefully rather than crash rendering.

## Security

- Never expose provider API keys to the browser.
- Keep provider-specific logic behind a service boundary.
- Validate user-controlled input.
- Sanitize HTML/rich content where applicable.
- Do not execute AI-generated code.

## UX

During generation clearly communicate:

- What is being generated
- Current progress/state
- Whether generation can be cancelled
- Whether generation failed
- What can be regenerated
- What the user can edit

Prefer deterministic application behavior over relying only on prompt instructions.

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { fieldClassName } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ChatState, useChat } from "../hooks/use-chat";
import { AiPhase, type ChatEntry } from "../types";
import { CHAT_LIMITS } from "../utils/stream-protocol";

const EXAMPLE_PROMPTS = [
  "Make slide 1 more concise",
  "Add a slide about pricing before the last slide",
  "Change the tone to be more formal",
];

const PHASE_LABELS: Record<AiPhase, string> = {
  [AiPhase.Thinking]: "Thinking…",
  [AiPhase.UpdatingSlides]: "Updating slides…",
  [AiPhase.ApplyingChanges]: "Applying changes…",
  [AiPhase.WritingReply]: "Writing reply…",
};

type ChatPanelProps = {
  deckId: string;
  selectedSlideId: string | null;
};

/** Chat with the AI about the open deck. Changes appear on the slides as they are applied. */
export function ChatPanel({ deckId, selectedSlideId }: ChatPanelProps) {
  const { entries, replyDraft, historySaveFailed, status, send, retry, stop } = useChat(deckId, selectedSlideId);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const isRunning = status.state === ChatState.Running;

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [entries, replyDraft, status]);

  function submit() {
    if (isRunning || draft.trim() === "") return;
    void send(draft);
    setDraft("");
  }

  return (
    <section aria-label="AI chat" className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {entries.length === 0 && replyDraft === null ? (
          <div>
            <p className="text-sm text-muted-foreground">
              Ask the AI to change this presentation. It edits the slides directly, and you can keep editing by hand.
            </p>
            <ul className="mt-3 space-y-1.5" aria-label="Example requests">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <li key={prompt}>
                  <Button
                    size="sm"
                    onClick={() => setDraft(prompt)}
                    className="h-auto w-full justify-start py-1.5 text-left whitespace-normal"
                  >
                    {prompt}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="space-y-3">
            {entries.map((entry) => (
              <ChatEntryItem key={entry.id} entry={entry} />
            ))}
            {replyDraft !== null && (
              <ChatEntryItem entry={{ id: "reply-draft", kind: "assistant", text: replyDraft }} isStreaming />
            )}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      <div aria-live="polite" className="px-4">
        {status.state === ChatState.Running && (
          <div className="flex items-center justify-between gap-2 pb-3">
            <p className="text-sm text-muted-foreground">
              {status.phase === null ? "Sending…" : PHASE_LABELS[status.phase]}
            </p>
            <Button size="sm" onClick={stop}>
              Stop
            </Button>
          </div>
        )}
        {status.state === ChatState.Stopped && (
          <p className="pb-3 text-sm text-muted-foreground">Stopped. Changes made before stopping were kept.</p>
        )}
        {status.state === ChatState.Failed && (
          <div className="space-y-2 pb-3">
            <Notice tone="error">{status.message}</Notice>
            {status.retryable && (
              <Button size="sm" onClick={() => void retry()}>
                Retry
              </Button>
            )}
          </div>
        )}
      </div>

      {historySaveFailed && (
        <p className="px-4 pb-2 text-xs text-muted-foreground">This conversation couldn&apos;t be saved in this browser.</p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="border-t border-border p-3"
      >
        <label htmlFor="chat-message" className="sr-only">
          Message to the AI
        </label>
        <textarea
          id="chat-message"
          rows={3}
          value={draft}
          maxLength={CHAT_LIMITS.messageLength}
          placeholder="Ask for a change…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          className={`${fieldClassName} resize-none`}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Enter to send, Shift+Enter for a new line</p>
          <Button type="submit" variant="primary" size="sm" disabled={isRunning || draft.trim() === ""}>
            Send
          </Button>
        </div>
      </form>
    </section>
  );
}

function ChatEntryItem({ entry, isStreaming = false }: { entry: ChatEntry; isStreaming?: boolean }) {
  if (entry.kind === "notice") {
    return (
      <li className="rounded-md border border-warning-foreground/25 bg-warning px-3 py-2 text-sm text-warning-foreground">
        {entry.text}
      </li>
    );
  }

  const isUser = entry.kind === "user";
  return (
    <li aria-busy={isStreaming || undefined} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
      >
        <span className="sr-only">{isUser ? "You: " : "AI: "}</span>
        {entry.text}
      </p>
    </li>
  );
}

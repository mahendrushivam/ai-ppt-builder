import { useRef, useState } from "react";
import { fieldClassName } from "@/design-system/components/field";
import { LIMITS } from "@/features/deck/utils/schema";

type DeckTitleFieldProps = {
  title: string;
  label: string;
  /** Called with a trimmed, non-empty title that differs from the current one. */
  onRename: (title: string) => void;
  onDone?: () => void;
  autoFocus?: boolean;
  className?: string;
};

/**
 * Renames a deck on Enter or blur. Escape, or clearing the field, keeps the current title.
 * Give it `key={title}` so an outside rename resets the draft.
 */
export function DeckTitleField({
  title,
  label,
  onRename,
  onDone,
  autoFocus = false,
  className = "",
}: DeckTitleFieldProps) {
  const [draft, setDraft] = useState(title);
  const cancelledRef = useRef(false);

  function commit() {
    const next = draft.trim();
    if (cancelledRef.current || next === "") {
      cancelledRef.current = false;
      setDraft(title);
    } else if (next !== title) {
      onRename(next);
    }
    onDone?.();
  }

  return (
    <input
      type="text"
      aria-label={label}
      value={draft}
      maxLength={LIMITS.deckTitle}
      autoFocus={autoFocus}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          cancelledRef.current = true;
          event.currentTarget.blur();
        }
      }}
      className={`${fieldClassName} ${className}`}
    />
  );
}

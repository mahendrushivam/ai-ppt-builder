import React from "react";

type NoticeProps = {
  tone: "warning" | "error";
  children: React.ReactNode;
  onDismiss?: () => void;
};

const TONE_CLASSES = {
  warning: "border-warning-foreground/25 bg-warning text-warning-foreground",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
};

export const Notice: React.FC<NoticeProps> = ({
  tone,
  children,
  onDismiss,
}) => {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${TONE_CLASSES[tone]}`}
    >
      <p>{children}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-my-1 cursor-pointer rounded px-1.5 text-lg leading-none opacity-70 hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  );
};

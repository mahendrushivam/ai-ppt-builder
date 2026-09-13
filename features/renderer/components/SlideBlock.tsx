import { type Block, BlockType } from "@/features/deck/types";

const CHART_LABELS = { bar: "Bar", line: "Line", pie: "Pie" } as const;

/** Read-only rendering of one content block. Empty content shows a faint placeholder. */
export function SlideBlock({ block }: { block: Block }) {
  const editTarget = `block-${block.id}`;

  switch (block.type) {
    case BlockType.Bullets: {
      const items = block.items.filter((item) => item.text.trim() !== "");
      if (items.length === 0) return <Placeholder editTarget={editTarget} text="Empty list" />;
      return (
        <ul
          data-edit-target={editTarget}
          className="flex list-disc flex-col pl-[2.4cqw] [font-size:var(--slide-body-size)] gap-[calc(var(--slide-gap)*0.6)] marker:text-(--slide-accent)"
        >
          {items.map((item) => (
            <li key={item.id} className={item.level === 1 ? "ml-[2.4cqw] list-[circle]" : undefined}>
              {item.text}
            </li>
          ))}
        </ul>
      );
    }

    case BlockType.Paragraph:
      if (block.text.trim() === "") return <Placeholder editTarget={editTarget} text="Empty paragraph" />;
      return (
        <p
          data-edit-target={editTarget}
          className="whitespace-pre-line leading-relaxed [font-size:var(--slide-body-size)]"
        >
          {block.text}
        </p>
      );

    case BlockType.Table:
      return (
        <div
          data-edit-target={editTarget}
          className="min-h-0 overflow-hidden border border-(--slide-border) rounded-(--slide-radius)"
        >
          <table className="w-full border-collapse text-left text-[calc(var(--slide-body-size)*0.8)]">
            <thead className="[background:var(--slide-accent)] text-(--slide-on-accent)">
              <tr>
                {block.header.map((cell, columnIndex) => (
                  <th key={columnIndex} scope="col" className="px-[1cqw] py-[0.6cqw] font-semibold">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-t border-(--slide-border) even:[background:var(--slide-surface)]"
                >
                  {row.map((cell, columnIndex) => (
                    <td key={columnIndex} className="px-[1cqw] py-[0.6cqw]">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case BlockType.Chart:
      // Placeholder until chart rendering is implemented in the rich-content phase.
      return (
        <div
          data-edit-target={editTarget}
          role="img"
          aria-label={`${CHART_LABELS[block.chartType]} chart: ${block.title ?? "untitled"}`}
          className="flex min-h-[10cqw] flex-1 flex-col items-center justify-center [background:var(--slide-surface)] rounded-(--slide-radius) text-(--slide-muted) [font-size:var(--slide-body-size)]"
        >
          <span className="font-semibold text-(--slide-text)">{block.title ?? "Chart"}</span>
          <span>
            {CHART_LABELS[block.chartType]} chart · {block.categories.length} categories
          </span>
        </div>
      );

    case BlockType.Image:
      if (!block.image) {
        return (
          <div
            data-edit-target={editTarget}
            role="img"
            aria-label={block.alt}
            className="flex min-h-[10cqw] flex-1 items-center justify-center border-2 border-dashed px-[1cqw] text-center border-(--slide-border) rounded-(--slide-radius) text-(--slide-muted) [font-size:var(--slide-body-size)]"
          >
            Image: {block.alt}
          </div>
        );
      }
      return (
        <figure data-edit-target={editTarget} className="flex min-h-0 flex-1 flex-col gap-[0.4cqw]">
          {/* eslint-disable-next-line @next/next/no-img-element -- images come from arbitrary hosts that next/image remotePatterns cannot enumerate */}
          <img
            src={block.image.src}
            alt={block.alt}
            loading="lazy"
            className="min-h-0 w-full flex-1 object-cover rounded-(--slide-radius)"
          />
          <figcaption className="truncate text-(--slide-muted) text-[calc(var(--slide-body-size)*0.5)]">
            {block.image.attribution}
          </figcaption>
        </figure>
      );
  }
}

function Placeholder({ editTarget, text }: { editTarget: string; text: string }) {
  return (
    <p
      data-edit-target={editTarget}
      data-placeholder
      className="opacity-40 [font-size:var(--slide-body-size)]"
    >
      {text}
    </p>
  );
}

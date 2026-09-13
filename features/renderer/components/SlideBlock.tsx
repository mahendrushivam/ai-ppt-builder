import { type Block, BlockType, type ResolvedImage } from "@/features/deck/types";
import { CHART_TYPE_LABELS } from "@/features/deck/utils/labels";
import { ImageUrlStatus, useImageUrl } from "../hooks/use-image-url";
import { SlideChart } from "./SlideChart";

/** How images load: `lazy` on screen, `eager` for print and export, where every image must be ready. */
export type ImageLoading = "lazy" | "eager";

type SlideBlockProps = {
  block: Block;
  /** Series colors from the deck theme. */
  chartColors: readonly string[];
  imageLoading: ImageLoading;
};

/** Read-only rendering of one content block. Empty content shows a faint placeholder. */
export function SlideBlock({ block, chartColors, imageLoading }: SlideBlockProps) {
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
      return (
        <figure data-edit-target={editTarget} className="flex min-h-[14cqw] flex-1 flex-col gap-[0.4cqw]">
          {block.title && (
            <figcaption className="font-semibold text-(--slide-text) text-[calc(var(--slide-body-size)*0.8)]">
              {block.title}
            </figcaption>
          )}
          <div
            role="img"
            aria-label={`${CHART_TYPE_LABELS[block.chartType]} chart: ${block.title ?? "untitled"}`}
            className="min-h-0 flex-1"
          >
            <SlideChart chart={block} colors={chartColors} />
          </div>
        </figure>
      );

    case BlockType.Image:
      if (!block.image) return <ImagePlaceholder editTarget={editTarget} alt={block.alt} text={`Image: ${block.alt}`} />;
      return <SlideImage editTarget={editTarget} image={block.image} alt={block.alt} loading={imageLoading} />;
  }
}

type SlideImageProps = { editTarget: string; image: ResolvedImage; alt: string; loading: ImageLoading };

function SlideImage({ editTarget, image, alt, loading }: SlideImageProps) {
  const url = useImageUrl(image.src);

  if (url.status === ImageUrlStatus.Loading) {
    return <ImagePlaceholder editTarget={editTarget} alt={alt} text={`Image: ${alt}`} isLoading />;
  }
  if (url.status === ImageUrlStatus.Missing) {
    return (
      <ImagePlaceholder editTarget={editTarget} alt={alt} text="This uploaded image isn't available in this browser." />
    );
  }
  return (
    <figure data-edit-target={editTarget} className="flex min-h-0 flex-1 flex-col gap-[0.4cqw]">
      {/* eslint-disable-next-line @next/next/no-img-element -- images come from arbitrary hosts or browser storage, which next/image cannot load */}
      <img
        src={url.url}
        alt={alt}
        loading={loading}
        className="min-h-0 w-full flex-1 object-cover rounded-(--slide-radius)"
      />
      {image.attribution && (
        <figcaption className="truncate text-(--slide-muted) text-[calc(var(--slide-body-size)*0.5)]">
          {image.attribution}
        </figcaption>
      )}
    </figure>
  );
}

type ImagePlaceholderProps = {
  editTarget: string;
  alt: string;
  text: string;
  /** Marks an upload still being read from storage, so exports can wait for it. */
  isLoading?: boolean;
};

function ImagePlaceholder({ editTarget, alt, text, isLoading = false }: ImagePlaceholderProps) {
  return (
    <div
      data-edit-target={editTarget}
      data-image-loading={isLoading || undefined}
      role="img"
      aria-label={alt}
      className="flex min-h-[10cqw] flex-1 items-center justify-center border-2 border-dashed px-[1cqw] text-center border-(--slide-border) rounded-(--slide-radius) text-(--slide-muted) [font-size:var(--slide-body-size)]"
    >
      {text}
    </div>
  );
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

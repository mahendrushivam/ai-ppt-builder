import type { Slide } from "@/features/deck/types";
import { blockSizesOf } from "@/features/deck/utils/block-sizes";
import type { Theme } from "@/features/themes/types";
import { themeStyle } from "@/features/themes/utils/theme-style";
import { type ImageLoading, SlideBlock } from "./SlideBlock";

type SlideRendererProps = {
  slide: Slide;
  theme: Theme;
  /** `eager` for print and export, where every image must load even when it is off screen. */
  imageLoading?: ImageLoading;
};

/**
 * Pure, read-only slide rendering shared by the editor canvas, thumbnails and print.
 *
 * Elements that can be edited carry `data-edit-target` so a surrounding editor can
 * react to clicks; the renderer itself has no editing behavior. Sizes come from theme
 * tokens in container query units, so a slide scales with the width it is given.
 */
export function SlideRenderer({ slide, theme, imageLoading = "lazy" }: SlideRendererProps) {
  const isTitleLayout = slide.layout === "title" || slide.layout === "section";

  return (
    <div
      style={themeStyle(theme)}
      className="@container aspect-video w-full overflow-hidden [background:var(--slide-background)] text-(--slide-text) [font-family:var(--slide-body-font)]"
    >
      {isTitleLayout ? <TitleLayout slide={slide} /> : <ContentLayout slide={slide} chartColors={theme.chartColors} imageLoading={imageLoading} />}
    </div>
  );
}

function TitleLayout({ slide }: { slide: Slide }) {
  const centered = slide.hints.align === "center";

  return (
    <div
      className={`flex h-full flex-col justify-center gap-(--slide-gap) p-(--slide-padding) ${centered ? "items-center text-center" : ""}`}
    >
      {slide.layout === "section" && (
        <div aria-hidden className="h-[0.6cqw] w-[10cqw] rounded-full [background:var(--slide-accent)]" />
      )}
      <SlideTitle title={slide.title} className="[font-size:var(--slide-title-size)]" />
      {slide.subtitle && (
        <p
          data-edit-target="subtitle"
          className="text-(--slide-muted) text-[calc(var(--slide-body-size)*1.3)]"
        >
          {slide.subtitle}
        </p>
      )}
    </div>
  );
}

type ContentLayoutProps = { slide: Slide; chartColors: readonly string[]; imageLoading: ImageLoading };

function ContentLayout({ slide, chartColors, imageLoading }: ContentLayoutProps) {
  const centered = slide.hints.align === "center";
  // `minmax(0, …)` keeps long content from widening a column past its share.
  const columnTemplate =
    slide.columns.length === 2
      ? `minmax(0, ${slide.hints.columnSplit}fr) minmax(0, ${100 - slide.hints.columnSplit}fr)`
      : "minmax(0, 1fr)";

  return (
    <div className="flex h-full flex-col gap-[calc(var(--slide-gap)*1.5)] p-(--slide-padding)">
      <header className={centered ? "text-center" : undefined}>
        <SlideTitle title={slide.title} className="[font-size:var(--slide-heading-size)]" />
        {slide.subtitle && (
          <p
            data-edit-target="subtitle"
            className="mt-[0.5cqw] text-(--slide-muted) [font-size:var(--slide-body-size)]"
          >
            {slide.subtitle}
          </p>
        )}
      </header>

      <div className="grid min-h-0 flex-1 gap-[calc(var(--slide-gap)*2)]" style={{ gridTemplateColumns: columnTemplate }}>
        {slide.columns.map((column) => {
          const blockSizes = blockSizesOf(column);
          return (
          <section key={column.id} data-column-id={column.id} className="flex min-h-0 flex-col gap-(--slide-gap)">
            {column.heading && (
              <h3
                data-edit-target={`heading-${column.id}`}
                className="self-start px-[1.2cqw] py-[0.4cqw] [background:var(--slide-accent)] rounded-(--slide-radius) text-(--slide-on-accent) [font-size:var(--slide-body-size)] [font-weight:var(--slide-heading-weight)]"
              >
                {column.heading}
              </h3>
            )}
            {column.blocks.map((block, index) =>
              blockSizes ? (
                // A resized column shares its height between blocks; content that doesn't fit is cut off.
                <div
                  key={block.id}
                  data-block-slot={block.id}
                  className="flex min-h-0 flex-col overflow-hidden"
                  style={{ flex: `${blockSizes[index]} 1 0px` }}
                >
                  <SlideBlock block={block} chartColors={chartColors} imageLoading={imageLoading} />
                </div>
              ) : (
                <SlideBlock key={block.id} block={block} chartColors={chartColors} imageLoading={imageLoading} />
              ),
            )}
          </section>
          );
        })}
      </div>
    </div>
  );
}

function SlideTitle({ title, className }: { title: string; className: string }) {
  return (
    <h2
      data-edit-target="title"
      className={`leading-tight [font-family:var(--slide-heading-font)] [font-weight:var(--slide-heading-weight)] ${className}`}
    >
      {title || (
        <span data-placeholder className="opacity-40">
          Untitled slide
        </span>
      )}
    </h2>
  );
}

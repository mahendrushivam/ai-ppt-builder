import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonClassName } from "@/design-system/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/design-system/components/dropdown-menu";
import type { Deck, Slide } from "@/features/deck/types";
import { SlideRenderer } from "@/features/renderer/components/SlideRenderer";
import { THEMES } from "@/features/themes/utils/themes";
import { EXPORT_SLIDE_SIZE, exportSlidePng, slideFileName } from "../utils/slide-export";

type ExportMenuProps = {
  deck: Deck;
  /** The slide that "Download as PNG" saves. */
  slide: Slide | undefined;
  slideNumber: number;
  onError: (message: string) => void;
};

/** Export options for the editor: the print view for PDFs, and the current slide as a PNG. */
export function ExportMenu({ deck, slide, slideNumber, onError }: ExportMenuProps) {
  // A slide is drawn off screen at export size while it's saved, so the PNG never depends on the editor's width.
  const [capture, setCapture] = useState<{ slide: Slide; fileName: string } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!capture || !stage) return;
    exportSlidePng(stage, capture.fileName)
      .catch((error: unknown) => {
        console.error("Slide PNG export failed:", error);
        onError("The slide couldn't be saved as a PNG. Try again.");
      })
      .finally(() => setCapture(null));
  }, [capture, onError]);

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className={buttonClassName({ size: "sm" })} disabled={capture !== null}>
          {capture ? "Exporting…" : "Export"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" collisionPadding={8} className="w-56">
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href={`/decks/${deck.id}/print`}>Print or save as PDF</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!slide}
            onSelect={() => slide && setCapture({ slide, fileName: slideFileName(deck.title, slideNumber) })}
            className="cursor-pointer"
          >
            Download slide {slideNumber} as PNG
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {capture && (
        // Only the outer element is moved off screen: the captured element's own styles are copied
        // into the image, so a captured element positioned off screen would come out blank.
        <div aria-hidden className="pointer-events-none fixed top-0 -left-[10000px]">
          <div ref={stageRef} style={{ width: EXPORT_SLIDE_SIZE.width }}>
            <SlideRenderer slide={capture.slide} theme={THEMES[deck.themeId]} imageLoading="eager" />
          </div>
        </div>
      )}
    </>
  );
}

import { render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { BlockType, type Slide } from "@/features/deck/types";
import { createBlankSlide } from "@/features/deck/utils/create";
import { CHART_TYPE_LABELS } from "@/features/deck/utils/labels";
import { CHART_RULES, CHART_TYPES } from "@/features/deck/utils/schema";
import { THEMES } from "@/features/themes/utils/themes";
import { saveImage } from "@/services/indexedDb/images";
import { resolvedImage } from "@/testing/fixtures";
import { SlideRenderer } from "../SlideRenderer";

const theme = THEMES.midnight;

test("renders a title slide with its subtitle", () => {
  const slide: Slide = { ...createBlankSlide("title"), title: "Q3 Roadmap", subtitle: "Product team" };

  render(<SlideRenderer slide={slide} theme={theme} />);

  expect(screen.getByRole("heading", { name: "Q3 Roadmap" })).toBeInTheDocument();
  expect(screen.getByText("Product team")).toBeInTheDocument();
});

test("renders every block type on a comparison slide", () => {
  const slide: Slide = {
    ...createBlankSlide("comparison"),
    title: "Plans",
    columns: [
      {
        id: "left",
        heading: "Basic",
        blocks: [
          {
            id: "b1",
            type: BlockType.Bullets,
            items: [
              { id: "i1", text: "Cheap", level: 0 },
              { id: "i2", text: "", level: 0 },
            ],
          },
          { id: "b2", type: BlockType.Table, header: ["Seats", "Price"], rows: [["5", "$10"]] },
        ],
      },
      {
        id: "right",
        heading: "Pro",
        blocks: [
          {
            id: "b3",
            type: BlockType.Chart,
            chartType: "bar",
            title: "Revenue",
            categories: ["Q1", "Q2"],
            series: [{ name: "2026", values: [1, 2] }],
          },
          { id: "b4", type: BlockType.Image, query: "team", alt: "Team photo", image: resolvedImage },
          { id: "b5", type: BlockType.Image, query: "office", alt: "Office", image: null },
        ],
      },
    ],
  };

  render(<SlideRenderer slide={slide} theme={theme} />);

  expect(screen.getByRole("heading", { name: "Basic" })).toBeInTheDocument();
  expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Cheap"]);
  expect(screen.getByRole("columnheader", { name: "Price" })).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "$10" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Bar chart: Revenue" })).toBeInTheDocument();
  expect(screen.getByText("Revenue", { selector: "figcaption" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Team photo" })).toHaveAttribute("src", resolvedImage.src);
  expect(screen.getByRole("img", { name: "Office" })).toHaveTextContent("Image: Office");
});

test("renders every chart type", () => {
  // jsdom has no layout, so Recharts warns that the charts have no size.
  vi.spyOn(console, "warn").mockImplementation(() => {});

  for (const chartType of CHART_TYPES) {
    const seriesCount = CHART_RULES[chartType].seriesCount ?? 2;
    const label = CHART_TYPE_LABELS[chartType];
    const slide: Slide = {
      ...createBlankSlide("content"),
      title: label,
      columns: [
        {
          id: "column",
          heading: null,
          blocks: [
            {
              id: "chart",
              type: BlockType.Chart,
              chartType,
              title: label,
              categories: ["Q1", "Q2", "Q3"],
              series: Array.from({ length: seriesCount }, (_, index) => ({
                name: `Series ${index + 1}`,
                values: [1 + index, 2 + index, 3 + index],
              })),
            },
          ],
        },
      ],
    };

    const { unmount } = render(<SlideRenderer slide={slide} theme={theme} />);

    expect(screen.getByRole("img", { name: `${label} chart: ${label}` })).toBeInTheDocument();
    unmount();
  }
});

test("shows uploaded images from browser storage and explains when one is missing", async () => {
  await saveImage("upload_0123456789ab", new Blob(["pixels"], { type: "image/webp" }));
  const uploaded = (uploadId: string) => ({
    src: `upload:${uploadId}`,
    width: 800,
    height: 600,
    attribution: "",
    sourceUrl: null,
  });
  const slide: Slide = {
    ...createBlankSlide("two-column"),
    columns: [
      {
        id: "left",
        heading: null,
        blocks: [{ id: "b1", type: BlockType.Image, query: "team", alt: "Our team", image: uploaded("upload_0123456789ab") }],
      },
      {
        id: "right",
        heading: null,
        blocks: [{ id: "b2", type: BlockType.Image, query: "office", alt: "Office", image: uploaded("upload_ffffffffffff") }],
      },
    ],
  };

  render(<SlideRenderer slide={slide} theme={theme} />);

  // While an upload loads, its placeholder has the same accessible name, so wait for the real image.
  await waitFor(() =>
    expect(screen.getByRole("img", { name: "Our team" })).toHaveAttribute("src", expect.stringMatching(/^blob:/)),
  );
  expect(await screen.findByText("This uploaded image isn't available in this browser.")).toBeInTheDocument();
});

test("shows a placeholder for an untitled slide", () => {
  render(<SlideRenderer slide={createBlankSlide("content")} theme={theme} />);

  expect(screen.getByRole("heading", { name: "Untitled slide" })).toBeInTheDocument();
});

test("exposes the theme tokens as CSS variables", () => {
  const { container } = render(<SlideRenderer slide={createBlankSlide("content")} theme={theme} />);
  const slideElement = container.firstElementChild;

  expect(slideElement).toBeInstanceOf(HTMLElement);
  expect((slideElement as HTMLElement).style.getPropertyValue("--slide-accent")).toBe(theme.colors.accent);
});

import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { BlockType, type Slide } from "@/features/deck/types";
import { createBlankSlide } from "@/features/deck/utils/create";
import { THEMES } from "@/features/themes/utils/themes";
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
  expect(screen.getByRole("img", { name: "Team photo" })).toHaveAttribute("src", resolvedImage.src);
  expect(screen.getByRole("img", { name: "Office" })).toHaveTextContent("Image: Office");
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

import { describe, expect, test } from "vitest";
import { type Outline, SlideVisual } from "../../types";
import {
  addOutlineItem,
  moveOutlineItem,
  outlineForGeneration,
  removeOutlineItem,
  textToKeyPoints,
  toEditableOutline,
  updateOutlineItem,
} from "../outline-editing";
import { GENERATION_LIMITS } from "../slide-input";

const outline: Outline = {
  deckTitle: "Q3 Roadmap",
  slides: [
    { title: "Intro", layout: "title", keyPoints: [], visual: SlideVisual.None },
    { title: "Themes", layout: "content", keyPoints: ["Speed"], visual: SlideVisual.None },
  ],
};

describe("outline editing", () => {
  test("moves, updates and removes items by id", () => {
    const editable = toEditableOutline(outline);
    const [intro, themes] = editable.slides;

    const moved = moveOutlineItem(editable, themes.id, "up");
    expect(moved.slides.map((item) => item.title)).toEqual(["Themes", "Intro"]);
    expect(moveOutlineItem(moved, themes.id, "up")).toBe(moved);

    const renamed = updateOutlineItem(moved, intro.id, { title: "Welcome" });
    expect(renamed.slides.map((item) => item.title)).toEqual(["Themes", "Welcome"]);
    expect(removeOutlineItem(renamed, themes.id).slides.map((item) => item.title)).toEqual(["Welcome"]);
  });

  test("stops adding items at the slide limit", () => {
    let editable = toEditableOutline(outline);
    while (editable.slides.length < GENERATION_LIMITS.maxSlides) editable = addOutlineItem(editable);

    expect(addOutlineItem(editable)).toBe(editable);
  });

  test("cleans key points typed as text and rejects an outline with a blank title", () => {
    const editable = toEditableOutline(outline);
    const withKeyPoints = updateOutlineItem(editable, editable.slides[1].id, {
      keyPoints: textToKeyPoints(" Speed \n\nQuality"),
    });

    expect(outlineForGeneration(withKeyPoints)?.slides[1].keyPoints).toEqual(["Speed", "Quality"]);
    expect(outlineForGeneration(updateOutlineItem(editable, editable.slides[0].id, { title: "  " }))).toBeNull();
  });
});

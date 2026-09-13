import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { type BlockOfType, BlockType } from "@/features/deck/types";
import { type ImageSearchResult, ImageSearchStatus } from "@/services/images/types";
import { resolvedImage } from "@/testing/fixtures";
import { server } from "@/testing/msw/server";
import { ImageEditor } from "../ImageEditor";

vi.mock("../../utils/image-upload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/image-upload")>()),
  // jsdom can't decode or draw images, so the stored copy is the chosen file itself.
  compressImage: async (file: Blob) => ({ blob: file, width: 800, height: 600 }),
}));

type ImageBlock = BlockOfType<BlockType.Image>;

const teamImage: ImageBlock = { id: "image", type: BlockType.Image, query: "team", alt: "The team", image: null };

function mockImageSearch(result: ImageSearchResult) {
  const queries: unknown[] = [];
  server.use(
    http.post("*/api/images/search", async ({ request }) => {
      queries.push(await request.json());
      return HttpResponse.json(result);
    }),
  );
  return { queries };
}

function renderEditor(userOptions?: Parameters<typeof userEvent.setup>[0]) {
  function EditableImage() {
    const [block, setBlock] = useState(teamImage);
    return (
      <ImageEditor
        image={block}
        fieldId="image-field"
        onChange={setBlock}
        onImageFound={(image) => setBlock((current) => ({ ...current, image }))}
      />
    );
  }

  render(<EditableImage />);
  return userEvent.setup(userOptions);
}

describe("ImageEditor", () => {
  test("finds an image for the search and shows it with its attribution", async () => {
    const { queries } = mockImageSearch({ status: ImageSearchStatus.Found, image: resolvedImage });
    const user = renderEditor();

    await user.type(screen.getByLabelText("Image search"), " planning");
    await user.click(screen.getByRole("button", { name: "Find image" }));

    expect(await screen.findByRole("img", { name: "The team" })).toHaveAttribute("src", resolvedImage.src);
    expect(screen.getByText(resolvedImage.attribution)).toBeInTheDocument();
    expect(queries).toEqual([{ query: "team planning" }]);
  });

  test("uploads an image file and shows it from browser storage", async () => {
    const user = renderEditor();

    await user.upload(screen.getByLabelText("Image file"), new File(["pixels"], "team.png", { type: "image/png" }));

    expect(await screen.findByRole("img", { name: "The team" })).toHaveAttribute("src", expect.stringMatching(/^blob:/));
    expect(screen.queryByRole("figure")?.querySelector("figcaption")).toBeFalsy();
  });

  test("explains when the chosen file is not a supported image", async () => {
    const user = renderEditor({ applyAccept: false });

    await user.upload(screen.getByLabelText("Image file"), new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }));

    expect(await screen.findByText("Choose a JPEG, PNG, WebP or GIF image.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("explains when no image matches the search", async () => {
    mockImageSearch({ status: ImageSearchStatus.NotFound });
    const user = renderEditor();

    await user.click(screen.getByRole("button", { name: "Find image" }));

    expect(await screen.findByText("No image found for that search. Try other words.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

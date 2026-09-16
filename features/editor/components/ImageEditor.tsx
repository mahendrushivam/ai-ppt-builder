import { useEffect, useRef, useState } from "react";
import { Button } from "@/design-system/components/button";
import { Field, fieldClassName } from "@/design-system/components/field";
import type {
  BlockOfType,
  BlockType,
  ResolvedImage,
} from "@/features/deck/types";
import { createId } from "@/features/deck/utils/create";
import { LIMITS } from "@/features/deck/utils/schema";
import { uploadedImageSrc } from "@/features/deck/utils/uploaded-image";
import {
  ImageUrlStatus,
  useImageUrl,
} from "@/features/renderer/hooks/use-image-url";
import { searchImage } from "@/services/images/api";
import { ImageSearchStatus } from "@/services/images/types";
import { saveImage } from "@/services/indexedDb/images";
import {
  ACCEPTED_IMAGE_TYPES,
  compressImage,
  uploadProblem,
} from "../utils/image-upload";

type ImageBlock = BlockOfType<BlockType.Image>;

type ImageEditorProps = {
  image: ImageBlock;
  fieldId: string;
  onChange: (image: ImageBlock) => void;
  onImageFound: (image: ResolvedImage) => void;
};

const SEARCH_MESSAGES = {
  [ImageSearchStatus.NotFound]:
    "No image found for that search. Try other words.",
  [ImageSearchStatus.Unavailable]:
    "Image search isn't available right now. Try again later.",
};

/** Edits an image block: a stock-photo search or an uploaded file, the alt text, and the image itself. */
const ImageEditor: React.FC<ImageEditorProps> = ({
  image,
  fieldId,
  onChange,
  onImageFound,
}) => {
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBusy = isSearching || isUploading;

  // Leaving the editor cancels a running search.
  useEffect(() => () => controllerRef.current?.abort(), []);

  async function findImage() {
    const query = image.query.trim();
    if (query === "") return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsSearching(true);
    setMessage(null);

    try {
      const result = await searchImage(query, controller.signal);
      if (result.status === ImageSearchStatus.Found) onImageFound(result.image);
      else setMessage(SEARCH_MESSAGES[result.status]);
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("Image search failed:", error);
        setMessage(
          "Couldn't reach the server. Check your connection and try again.",
        );
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setIsSearching(false);
      }
    }
  }

  async function uploadFile(file: File) {
    const problem = uploadProblem(file);
    if (problem) {
      setMessage(problem);
      return;
    }

    setIsUploading(true);
    setMessage(null);
    try {
      const { blob, width, height } = await compressImage(file);
      const uploadId = createId("upload");
      await saveImage(uploadId, blob);
      onImageFound({
        src: uploadedImageSrc(uploadId),
        width,
        height,
        attribution: "",
        sourceUrl: null,
      });
    } catch (error) {
      console.error("Image upload failed:", error);
      setMessage("This image couldn't be added. Try a different file.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {image.image ? (
        <ImagePreview image={image.image} alt={image.alt} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No image yet. The slide shows a placeholder.
        </p>
      )}

      <Field
        label="Image search"
        htmlFor={fieldId}
        hint="Describe the photo, for example “team planning at a whiteboard”."
      >
        <input
          id={fieldId}
          value={image.query}
          maxLength={LIMITS.imageQuery}
          onChange={(event) =>
            onChange({ ...image, query: event.target.value })
          }
          className={fieldClassName}
        />
      </Field>
      <Field
        label="Alt text"
        htmlFor={`${fieldId}-alt`}
        hint="What the image shows, for people who can't see it."
      >
        <input
          id={`${fieldId}-alt`}
          value={image.alt}
          maxLength={LIMITS.imageAlt}
          onChange={(event) => onChange({ ...image, alt: event.target.value })}
          className={fieldClassName}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={isBusy || image.query.trim() === ""}
          onClick={() => void findImage()}
        >
          {isSearching
            ? "Searching…"
            : image.image
              ? "Find another image"
              : "Find image"}
        </Button>
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? "Uploading…" : "Upload image"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          aria-label="Image file"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so that choosing the same file again still uploads it.
            event.target.value = "";
            if (file) void uploadFile(file);
          }}
        />
        {image.image && (
          <Button
            size="sm"
            variant="ghost"
            disabled={isBusy}
            onClick={() => onChange({ ...image, image: null })}
          >
            Clear image
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Uploaded images are saved in this browser only.
      </p>
      <p role="status" className="text-sm text-muted-foreground empty:hidden">
        {message}
      </p>
    </div>
  );
};

const ImagePreview: React.FC<{ image: ResolvedImage; alt: string }> = ({
  image,
  alt,
}: {
  image: ResolvedImage;
  alt: string;
}) => {
  const url = useImageUrl(image.src);

  if (url.status === ImageUrlStatus.Loading) {
    return <p className="text-sm text-muted-foreground">Loading image…</p>;
  }
  if (url.status === ImageUrlStatus.Missing) {
    return (
      <p className="text-sm text-muted-foreground">
        This uploaded image isn&apos;t available in this browser. Upload it
        again or find another image.
      </p>
    );
  }
  return (
    <figure className="space-y-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- images come from arbitrary hosts or browser storage, which next/image cannot load */}
      <img
        src={url.url}
        alt={alt}
        className="max-h-32 w-full rounded-md object-cover"
      />
      {image.attribution && (
        <figcaption className="text-xs text-muted-foreground">
          {image.attribution}
        </figcaption>
      )}
    </figure>
  );
};

export { ImageEditor };

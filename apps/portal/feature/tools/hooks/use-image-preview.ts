import { useEffect, useState } from "react";

export interface ImagePreview {
  url: string;
  width: number;
  height: number;
}

/** Object URL and natural size of an image file, released on change. */
export function useImagePreview(blob: Blob | null | undefined): ImagePreview | null {
  const [loaded, setLoaded] = useState<{ blob: Blob; preview: ImagePreview } | null>(null);

  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    let active = true;
    const image = new Image();
    const done = (width: number, height: number) => {
      if (active) setLoaded({ blob, preview: { url, width, height } });
    };
    image.onload = () => done(image.naturalWidth, image.naturalHeight);
    image.onerror = () => done(0, 0);
    image.src = url;

    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  // A preview of an earlier file is never shown for the current one.
  return blob && loaded?.blob === blob ? loaded.preview : null;
}

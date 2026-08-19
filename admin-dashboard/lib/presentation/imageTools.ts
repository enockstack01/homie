// Browser-only image utilities (canvas/Image APIs) - only ever called from
// components/presentation/DeckEditor.tsx, a client component.

/** One-click background removal via color-distance keying against the image's own
 * corner pixels (averaged, on the assumption a photo's background touches at least one
 * corner) - not real ML-based subject segmentation (Canva's Background Remover uses a
 * trained model this app has no access to), but a genuine, working removal for the
 * common case of a product/logo shot on a plain or near-solid background. Pixels within
 * `threshold` of that color become fully transparent, with a soft falloff band just
 * outside it so edges don't look hard-cut. */
export async function removeBackground(dataUrl: string, threshold = 32): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser.");
  ctx.drawImage(img, 0, 0);

  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const { data } = image;

  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [x, y] of corners) {
    const i = (y * width + x) * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  r /= corners.length;
  g /= corners.length;
  b /= corners.length;

  const falloff = threshold * 0.6;
  for (let i = 0; i < data.length; i += 4) {
    const dist = Math.sqrt((data[i] - r) ** 2 + (data[i + 1] - g) ** 2 + (data[i + 2] - b) ** 2);
    if (dist < threshold) {
      data[i + 3] = 0;
    } else if (dist < threshold + falloff) {
      data[i + 3] = Math.round((data[i + 3] * (dist - threshold)) / falloff);
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the image."));
    img.src = src;
  });
}

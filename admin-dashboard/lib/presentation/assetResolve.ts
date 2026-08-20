import { readFile } from "node:fs/promises";
import path from "node:path";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

/** Server-only (node:fs) - turns an ImageElement's `dataUrl` into what PptxGenJS's
 * addImage actually needs. Two cases: a user-uploaded image is already a "data:...;
 * base64,..." URI (from DeckEditor.tsx's FileReader), passed through unchanged; a
 * built-in template's sample photo (lib/presentation/assets.ts) is a plain
 * "/presentation-assets/..." public path - the same string the browser already uses
 * directly as an <img src - here it's read off disk and base64-encoded instead, so
 * templates.ts/designedTemplates.ts never need to inline a giant base64 string in
 * source. */
export async function resolveImageData(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("/")) return dataUrl;

  const ext = path.extname(dataUrl).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "image/jpeg";
  const filePath = path.join(process.cwd(), "public", dataUrl);
  const bytes = await readFile(filePath);
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

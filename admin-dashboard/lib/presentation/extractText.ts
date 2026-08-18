import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

// Real Stage-1 ingestion (see homie-presentation/README.md's "deliberate stand-in" table
// for what this replaces) - still text-only, no per-block provenance, but a genuinely
// parsed upload rather than a paste-only box. Deliberately narrow: the four formats
// covering nearly every "report" or "notes" a user would actually upload, each with a
// real, well-maintained pure-JS/WASM parser (no native binary, no OCR) - anything else
// (scanned PDFs, images, .pptx, .xlsx) is rejected with a clear message instead of
// silently producing empty or garbled text.

export class UnsupportedFileError extends Error {}

const MAX_FILE_BYTES = 15 * 1024 * 1024;

async function extractPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/** Extracts plain text from an uploaded source document. Dispatches on file extension
 * rather than the browser-reported MIME type, which is inconsistent across
 * browsers/OSes for .md and .docx in particular. */
export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new UnsupportedFileError(
      `"${file.name}" is too large (${Math.round(file.size / 1024 / 1024)}MB) - the limit is ${MAX_FILE_BYTES / 1024 / 1024}MB.`,
    );
  }

  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;
  switch (ext) {
    case "txt":
    case "md":
      text = buffer.toString("utf-8");
      break;
    case "pdf":
      text = await extractPdf(buffer);
      break;
    case "docx":
      text = await extractDocx(buffer);
      break;
    default:
      throw new UnsupportedFileError(
        `"${file.name}" isn't a supported format - upload a .txt, .md, .pdf, or .docx file (or just paste text below instead).`,
      );
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new UnsupportedFileError(`"${file.name}" doesn't contain any extractable text.`);
  }
  return trimmed;
}

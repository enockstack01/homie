import { BackendError, callBackend } from "@/lib/backend";
import {
  buildOutlineSystemPrompt,
  buildOutlineUserPrompt,
  parseOutline,
  OutlineParseError,
} from "@/lib/presentation/outline";
import { buildFlyerSystemPrompt, parseFlyerContent, FlyerParseError } from "@/lib/presentation/flyerOutline";
import { extractTextFromFile, UnsupportedFileError } from "@/lib/presentation/extractText";

interface ChatResponse {
  message: { content: { type: string; text?: string }[] };
}

function errorResponse(status: number, detail: string): Response {
  return Response.json({ detail }, { status });
}

// This is the one billed step in the editing flow (see app/api/presentation/export/route.ts
// for the free counterpart) - it makes exactly one /v1/chat call, metered against the
// signed-in user's own credit balance the same way every other Homie surface is. It
// returns a structured outline, not a rendered file: the result lands in the online
// editor (PresentationStudio) for free further editing, rather than downloading
// immediately, so AI generation is a starting point, not a one-shot dead end.
export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "Request must be multipart/form-data.");
  }

  const kind = form.get("kind") === "flyer" ? "flyer" : "deck";
  const designIntent = String(form.get("designIntent") ?? "").trim();
  const title = String(form.get("title") ?? "").trim() || "Untitled";
  const pastedText = String(form.get("sourceText") ?? "").trim();
  const file = form.get("sourceFile");

  let fileText = "";
  if (file instanceof File && file.size > 0) {
    try {
      fileText = await extractTextFromFile(file);
    } catch (err) {
      if (err instanceof UnsupportedFileError) return errorResponse(400, err.message);
      throw err;
    }
  }

  const sourceText = [pastedText, fileText].filter(Boolean).join("\n\n");
  if (!sourceText) return errorResponse(400, "Source material is required - paste text and/or upload a document.");

  let chatResponse: ChatResponse;
  try {
    chatResponse = await callBackend<ChatResponse>("/v1/chat", {
      method: "POST",
      body: JSON.stringify({
        system: kind === "flyer" ? buildFlyerSystemPrompt() : buildOutlineSystemPrompt(),
        messages: [{ role: "user", content: buildOutlineUserPrompt(sourceText, designIntent) }],
        max_tokens: 4096,
      }),
    });
  } catch (err) {
    if (err instanceof BackendError) return errorResponse(err.status, err.message);
    throw err;
  }

  const raw = chatResponse.message.content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n");

  try {
    if (kind === "flyer") {
      const content = parseFlyerContent(raw);
      return Response.json({ kind, title, content, sourceText });
    }
    const slides = parseOutline(raw);
    return Response.json({ kind, title, slides, sourceText });
  } catch (err) {
    if (err instanceof OutlineParseError || err instanceof FlyerParseError) {
      return errorResponse(502, `The model's response couldn't be parsed: ${err.message}`);
    }
    throw err;
  }
}

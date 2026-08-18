import { homieChat, extractText, HomieApiError } from "@/lib/homieClient";
import { buildOutlineSystemPrompt, buildOutlineUserPrompt, parseOutline, OutlineParseError } from "@/lib/outline";
import { renderDeck } from "@/lib/renderDeck";

interface GenerateRequest {
  apiKey?: string;
  sourceText?: string;
  designIntent?: string;
  deckTitle?: string;
}

function errorResponse(status: number, detail: string): Response {
  return Response.json({ detail }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let body: GenerateRequest;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Request body must be JSON.");
  }

  const apiKey = body.apiKey?.trim();
  const sourceText = body.sourceText?.trim();
  const designIntent = body.designIntent?.trim() ?? "";
  const deckTitle = body.deckTitle?.trim() || "Untitled deck";

  if (!apiKey) return errorResponse(401, "A Homie API key is required.");
  if (!sourceText) return errorResponse(400, "Source material is required.");

  let outlineText: string;
  try {
    const chatResponse = await homieChat(apiKey, buildOutlineSystemPrompt(), buildOutlineUserPrompt(sourceText, designIntent));
    outlineText = extractText(chatResponse);
  } catch (err) {
    if (err instanceof HomieApiError) return errorResponse(err.status, err.message);
    throw err;
  }

  let slides;
  try {
    slides = parseOutline(outlineText);
  } catch (err) {
    if (err instanceof OutlineParseError) {
      return errorResponse(502, `The model's outline couldn't be parsed: ${err.message}`);
    }
    throw err;
  }

  const pptxBuffer = await renderDeck(slides, deckTitle);
  const fileName = `${deckTitle.replace(/[^a-z0-9 _-]/gi, "").trim() || "deck"}.pptx`;

  return new Response(new Uint8Array(pptxBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

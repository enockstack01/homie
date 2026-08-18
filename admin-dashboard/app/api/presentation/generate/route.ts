import { BackendError, callBackend } from "@/lib/backend";
import {
  buildOutlineSystemPrompt,
  buildOutlineUserPrompt,
  parseOutline,
  OutlineParseError,
} from "@/lib/presentation/outline";
import { renderDeck } from "@/lib/presentation/renderDeck";

interface GenerateRequest {
  sourceText?: string;
  designIntent?: string;
  deckTitle?: string;
}

interface ChatResponse {
  message: { content: { type: string; text?: string }[] };
}

function errorResponse(status: number, detail: string): Response {
  return Response.json({ detail }, { status });
}

// Same /v1/chat gateway homie-presentation's standalone app used, but authenticated with
// the signed-in dashboard user's own Clerk session (via callBackend) instead of a pasted
// Homie API key - this route lives behind proxy.ts's auth-required matcher, so there's
// never an unauthenticated caller to forward a key for in the first place.
export async function POST(request: Request): Promise<Response> {
  let body: GenerateRequest;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Request body must be JSON.");
  }

  const sourceText = body.sourceText?.trim();
  const designIntent = body.designIntent?.trim() ?? "";
  const deckTitle = body.deckTitle?.trim() || "Untitled deck";

  if (!sourceText) return errorResponse(400, "Source material is required.");

  let chatResponse: ChatResponse;
  try {
    chatResponse = await callBackend<ChatResponse>("/v1/chat", {
      method: "POST",
      body: JSON.stringify({
        system: buildOutlineSystemPrompt(),
        messages: [{ role: "user", content: buildOutlineUserPrompt(sourceText, designIntent) }],
        max_tokens: 4096,
      }),
    });
  } catch (err) {
    if (err instanceof BackendError) return errorResponse(err.status, err.message);
    throw err;
  }

  const outlineText = chatResponse.message.content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n");

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

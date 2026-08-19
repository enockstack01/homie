import type { Slide } from "@/lib/presentation/elements";
import type { FlyerContent } from "@/lib/presentation/templates";
import { renderDeck } from "@/lib/presentation/renderDeck";
import { renderFlyer } from "@/lib/presentation/renderFlyer";

interface ExportRequest {
  kind?: "deck" | "flyer";
  title?: string;
  slides?: Slide[];
  content?: FlyerContent;
}

function errorResponse(status: number, detail: string): Response {
  return Response.json({ detail }, { status });
}

// Renders whatever is currently in the online editor to a real .pptx - pure deterministic
// code, no AI call, so this is the "editing is free" path: it can be hit as many times as
// a user wants (every drag, every edit, every download) without ever touching the billed
// /v1/chat gateway (see app/api/presentation/generate/route.ts and .../ai-edit/route.ts
// for the two routes that do).
export async function POST(request: Request): Promise<Response> {
  let body: ExportRequest;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Request body must be JSON.");
  }

  const title = body.title?.trim() || "Untitled";
  let buffer: Buffer;

  if (body.kind === "flyer") {
    if (!body.content || !body.content.headline || !Array.isArray(body.content.body) || body.content.body.length === 0) {
      return errorResponse(400, "A flyer needs a headline and at least one body line.");
    }
    buffer = await renderFlyer(body.content, title);
  } else {
    if (!Array.isArray(body.slides) || body.slides.length === 0) {
      return errorResponse(400, "A deck needs at least one slide.");
    }
    for (const slide of body.slides) {
      if (!Array.isArray(slide.elements) || slide.elements.length === 0) {
        return errorResponse(400, "Every slide needs at least one element.");
      }
    }
    buffer = await renderDeck(body.slides, title);
  }

  const fileName = `${title.replace(/[^a-z0-9 _-]/gi, "").trim() || "deck"}.pptx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

import { BackendError, callBackend } from "@/lib/backend";
import { parseSingleSlide, OutlineParseError, type SlidePlan } from "@/lib/presentation/outline";
import { parseFlyerContent, FlyerParseError } from "@/lib/presentation/flyerOutline";
import type { FlyerContent } from "@/lib/presentation/templates";

interface AiEditRequest {
  kind?: "deck" | "flyer";
  instruction?: string;
  sourceText?: string;
  slide?: SlidePlan;
  content?: FlyerContent;
}

interface ChatResponse {
  message: { content: { type: string; text?: string }[] };
}

function errorResponse(status: number, detail: string): Response {
  return Response.json({ detail }, { status });
}

function buildSlideEditPrompt(slide: SlidePlan, instruction: string, sourceText: string): string {
  return [
    "You are the editing stage of an AI presentation generator, revising exactly one slide of a larger deck.",
    "Output ONLY a raw JSON object, no markdown code fences, no commentary before or after it.",
    'Schema: {"title": string, "bullets": string[]}, 2-5 bullets.',
    sourceText
      ? "Stay grounded in the original source material below - do not invent facts, numbers, or claims that aren't in it."
      : "No original source material was provided for this deck - use your judgement, but stay consistent with the slide's existing content.",
    "Titles under 8 words. Bullets under 20 words each, plain language, no markdown formatting inside the strings.",
  ].join(" ") +
    "\n\nCurrent slide:\n" +
    JSON.stringify(slide) +
    "\n\nInstruction: " +
    instruction +
    (sourceText ? "\n\nOriginal source material:\n" + sourceText : "");
}

function buildFlyerEditPrompt(content: FlyerContent, instruction: string, sourceText: string): string {
  return [
    "You are the editing stage of an AI flyer generator, revising the copy of a single-page flyer.",
    "Output ONLY a raw JSON object, no markdown code fences, no commentary before or after it.",
    'Schema: {"headline": string, "subheadline"?: string, "body": string[], "cta"?: string, "footer"?: string}.',
    sourceText
      ? "Stay grounded in the original source material below - do not invent facts, numbers, or claims that aren't in it."
      : "No original source material was provided - use your judgement, but stay consistent with the flyer's existing content.",
  ].join(" ") +
    "\n\nCurrent flyer:\n" +
    JSON.stringify(content) +
    "\n\nInstruction: " +
    instruction +
    (sourceText ? "\n\nOriginal source material:\n" + sourceText : "");
}

// The one other billed step besides app/api/presentation/generate/route.ts (see
// app/api/presentation/export/route.ts for the free, non-AI download path) - one
// /v1/chat call per edit, metered the same way as every other Homie request. This is
// what "AI-powered editing costs credits" means in practice: revising a slide/flyer with
// a plain-language instruction, as opposed to typing directly into the editor's fields,
// which never reaches this route at all.
export async function POST(request: Request): Promise<Response> {
  let body: AiEditRequest;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Request body must be JSON.");
  }

  const instruction = body.instruction?.trim();
  const sourceText = body.sourceText?.trim() ?? "";
  if (!instruction) return errorResponse(400, "An instruction is required.");

  const isFlyer = body.kind === "flyer";
  if (isFlyer && !body.content) return errorResponse(400, "The current flyer content is required.");
  if (!isFlyer && !body.slide) return errorResponse(400, "The current slide is required.");

  const userPrompt = isFlyer
    ? buildFlyerEditPrompt(body.content!, instruction, sourceText)
    : buildSlideEditPrompt(body.slide!, instruction, sourceText);

  let chatResponse: ChatResponse;
  try {
    chatResponse = await callBackend<ChatResponse>("/v1/chat", {
      method: "POST",
      body: JSON.stringify({
        system: isFlyer
          ? "You revise flyer copy on request. Follow the schema and instruction exactly."
          : "You revise one presentation slide on request. Follow the schema and instruction exactly.",
        messages: [{ role: "user", content: userPrompt }],
        max_tokens: 1024,
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
    if (isFlyer) {
      return Response.json({ kind: "flyer", content: parseFlyerContent(raw) });
    }
    return Response.json({ kind: "deck", slide: parseSingleSlide(raw) });
  } catch (err) {
    if (err instanceof OutlineParseError || err instanceof FlyerParseError) {
      return errorResponse(502, `The model's response couldn't be parsed: ${err.message}`);
    }
    throw err;
  }
}

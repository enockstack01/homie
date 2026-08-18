import type { FlyerContent } from "./templates";

// Flyer counterpart to outline.ts's deck generation - same one-call, structured-JSON-only
// contract, different (single-page) schema. buildOutlineUserPrompt from outline.ts is
// reused as-is for the user turn (design intent + source material) since that framing
// isn't deck-specific.

export function buildFlyerSystemPrompt(): string {
  return [
    "You are the content-planning stage of an AI flyer generator.",
    "Produce the copy for a single-page flyer from the source material and design intent the user gives you.",
    "Output ONLY a raw JSON object, no markdown code fences, no commentary before or after it.",
    'Schema: {"headline": string, "subheadline"?: string, "body": string[], "cta"?: string, "footer"?: string}.',
    "headline under 8 words. body is 2-5 short lines, each grounded in the provided source material - do not invent facts, numbers, or claims that aren't in it.",
    "cta is a short call to action if one is implied by the source material, omit it otherwise. footer is a short attribution/contact line if one is implied, omit it otherwise.",
    "The design intent describes tone/audience, not visual styling - you are not choosing colors or fonts, only copy.",
  ].join(" ");
}

export class FlyerParseError extends Error {}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

export function parseFlyerContent(raw: string): FlyerContent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new FlyerParseError("The model's response wasn't valid JSON.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new FlyerParseError("Expected a JSON object.");
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.headline !== "string" || !obj.headline.trim()) {
    throw new FlyerParseError("Missing a headline.");
  }
  if (!Array.isArray(obj.body)) {
    throw new FlyerParseError("Missing a body array.");
  }
  const body = obj.body.filter((b): b is string => typeof b === "string" && b.trim().length > 0);
  if (body.length === 0) {
    throw new FlyerParseError("Body has no usable lines.");
  }

  return {
    headline: obj.headline.trim(),
    subheadline: typeof obj.subheadline === "string" && obj.subheadline.trim() ? obj.subheadline.trim() : undefined,
    body,
    cta: typeof obj.cta === "string" && obj.cta.trim() ? obj.cta.trim() : undefined,
    footer: typeof obj.footer === "string" && obj.footer.trim() ? obj.footer.trim() : undefined,
  };
}

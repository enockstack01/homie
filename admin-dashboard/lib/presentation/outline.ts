// Stage 3 (outline) and Stage 4 (slide drafting) from the product spec, collapsed into one
// model call for this first vertical slice - the full spec runs them separately (outline
// shown for approval, then each slide drafted independently and in parallel), which needs
// a job queue and an approval UI neither of which exist yet. This keeps the same contract
// (structured JSON in, never raw layout) so splitting it back into two stages later is an
// internal refactor, not a rewrite of what the model is asked to produce.

export interface SlidePlan {
  title: string;
  bullets: string[];
}

const MIN_SLIDES = 3;
const MAX_SLIDES = 6;

export function buildOutlineSystemPrompt(): string {
  return [
    "You are the content-planning stage of an AI presentation generator.",
    `Produce a slide-by-slide outline of ${MIN_SLIDES} to ${MAX_SLIDES} slides from the source material and design intent the user gives you.`,
    "Output ONLY a raw JSON array, no markdown code fences, no commentary before or after it.",
    'Schema: [{"title": string, "bullets": string[]}], 3 to 5 bullets per slide.',
    "Every bullet must be grounded in the provided source material - do not invent facts, numbers, or claims that aren't in it.",
    "Titles under 8 words. Bullets under 20 words each, plain language, no markdown formatting inside the strings.",
    "The design intent describes tone/audience, not visual styling - you are not choosing colors or fonts, only content and structure.",
  ].join(" ");
}

export function buildOutlineUserPrompt(sourceText: string, designIntent: string): string {
  return [
    "Design intent:",
    designIntent.trim() || "(none given - use a neutral, professional tone)",
    "",
    "Source material:",
    sourceText.trim(),
  ].join("\n");
}

/** Strips a markdown code fence if the model wrapped its JSON in one despite being told
 * not to - models do this often enough with "output raw JSON" instructions that handling
 * it is cheaper than a retry round-trip. */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

export class OutlineParseError extends Error {}

function parseSlideObject(slide: unknown, label: string): SlidePlan {
  if (
    typeof slide !== "object" ||
    slide === null ||
    typeof (slide as Record<string, unknown>).title !== "string" ||
    !Array.isArray((slide as Record<string, unknown>).bullets)
  ) {
    throw new OutlineParseError(`${label} is missing a title or bullets array.`);
  }
  const bullets = (slide as { bullets: unknown[] }).bullets.filter(
    (b): b is string => typeof b === "string" && b.trim().length > 0,
  );
  if (bullets.length === 0) {
    throw new OutlineParseError(`${label} has no usable bullets.`);
  }
  return { title: (slide as { title: string }).title.trim(), bullets };
}

export function parseOutline(raw: string): SlidePlan[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new OutlineParseError("The model's response wasn't valid JSON.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new OutlineParseError("Expected a non-empty array of slides.");
  }

  return parsed.map((slide, i) => parseSlideObject(slide, `Slide ${i + 1}`));
}

/** Same shape as one entry of parseOutline's array, for the AI-edit path
 * (app/api/presentation/ai-edit/route.ts) where the model revises a single slide rather
 * than drafting a whole deck. */
export function parseSingleSlide(raw: string): SlidePlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new OutlineParseError("The model's response wasn't valid JSON.");
  }
  return parseSlideObject(parsed, "The revised slide");
}

import { findTemplate } from "@/lib/presentation/templates";
import { deckFromPlans } from "@/lib/presentation/elements";
import { renderDeck } from "@/lib/presentation/renderDeck";
import { renderFlyer } from "@/lib/presentation/renderFlyer";

// GET, not POST - a template needs no request body, so a plain
// <a href="/api/presentation/template?id=..."> download link works and the browser
// handles the save dialog itself. Sits behind the same auth-required matcher as every
// other route here (proxy.ts), but never calls the AI gateway or spends credits.
export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get("id");
  const template = id ? findTemplate(id) : undefined;

  if (!template) {
    return Response.json({ detail: "Unknown template id." }, { status: 404 });
  }

  const buffer =
    template.kind === "deck"
      ? await renderDeck(deckFromPlans(template.name, template.slides), template.name)
      : await renderFlyer(template.content, template.name);

  const fileName = `${template.name.replace(/[^a-z0-9 _-]/gi, "").trim()}.pptx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

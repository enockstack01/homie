import { findTemplate } from "@/lib/templates";
import { renderDeck } from "@/lib/renderDeck";
import { renderFlyer } from "@/lib/renderFlyer";

// GET, not POST - a template needs no API key and no request body, so a plain
// <a href="/api/template?id=..."> download link works and the browser handles the save
// dialog itself, unlike /api/generate's fetch+blob dance (which exists there only because
// that route needs to send an API key and long-running-request UI state).
export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get("id");
  const template = id ? findTemplate(id) : undefined;

  if (!template) {
    return Response.json({ detail: "Unknown template id." }, { status: 404 });
  }

  const buffer =
    template.kind === "deck" ? await renderDeck(template.slides, template.name) : await renderFlyer(template.content, template.name);

  const fileName = `${template.name.replace(/[^a-z0-9 _-]/gi, "").trim()}.pptx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

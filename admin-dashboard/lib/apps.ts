/**
 * The single "what applications does Homie have" registry - lib/addinRelease.ts (Homie
 * GIS's real GitHub-Releases lookup, still under its internal "xGIS" project/artifact
 * naming - see that file) is the only thing that has to stay a special case, since
 * it's a live network call, not static copy. Everywhere that needs to list Homie's
 * applications (the dashboard's /apps page and the landing page's Applications section, at
 * minimum - see app/apps/page.tsx and app/LandingPage.tsx) reads from here instead of
 * duplicating this copy, so a new app or a status change (coming_soon -> available) is a
 * one-file edit.
 */
export type AppStatus = "available" | "coming_soon";

export interface HomieApp {
  id: string;
  name: string;
  tagline: string;
  description: string;
  status: AppStatus;
  /** Brand hex for this app's icon tile and accents - each app keeps its own identity
   * rather than inheriting Homie's primary green, the same way Homie GIS's existing orange
   * (see AddinDownloadCard.tsx) reads as "a specific product" rather than "a Homie
   * feature". */
  color: string;
  /** Single uppercase glyph for the icon tile, mirroring AddinDownloadCard's "x". */
  glyph: string;
  surface: "desktop" | "web";
}

export const HOMIE_APPS: HomieApp[] = [
  {
    id: "homie-gis",
    name: "Homie GIS",
    tagline: "Agentic GIS inside ArcGIS Pro",
    description:
      "Turns plain-English requests into real geoprocessing work - buffering, clipping, dissolving, joining, symbolizing - carried out live on your own map and project.",
    status: "available",
    color: "#e87722",
    glyph: "G",
    surface: "desktop",
  },
  {
    id: "presentation",
    name: "Homie Presentation",
    tagline: "The AI presentation operating system",
    description:
      "Give it a design intent, your source documents, and instructions - it returns a finished, on-brand, fact-grounded deck, editable afterward through plain-language edits or a full design canvas.",
    status: "coming_soon",
    color: "#6d28d9",
    glyph: "P",
    surface: "web",
  },
];

import type { StyleSpecification } from "maplibre-gl";

// All free, no-API-key raster tile sources - picking these (over MapTiler/Mapbox styles)
// avoids requiring an account just to see a basemap. Each uses exactly one bare host, no
// subdomain wildcards (e.g. "a/b/c.tile.opentopomap.org") - a CSP entry for
// "https://*.tile.openstreetmap.org" silently fails to match "https://tile.openstreetmap.org"
// (or vice versa) and the whole basemap renders blank with no console error, so
// index.html's CSP must list exactly these hostnames, no wildcards. See
// desktop/.claude/skills/run-desktop/SKILL.md's Gotchas for how that surfaced before.
export interface Basemap {
  id: string;
  name: string;
  style: StyleSpecification;
}

function singleRasterStyle(id: string, tiles: string[], attribution: string, maxzoom = 19): StyleSpecification {
  return {
    version: 8,
    sources: {
      [id]: { type: "raster", tiles, tileSize: 256, attribution, maxzoom },
    },
    layers: [{ id, type: "raster", source: id }],
  };
}

export const BASEMAPS: Basemap[] = [
  {
    id: "osm",
    name: "Street",
    style: singleRasterStyle(
      "osm",
      ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      "© OpenStreetMap contributors"
    ),
  },
  {
    id: "satellite",
    name: "Satellite",
    style: singleRasterStyle(
      "satellite",
      ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      "© Esri, Maxar, Earthstar Geographics",
      18
    ),
  },
  {
    id: "topo",
    name: "Terrain",
    style: singleRasterStyle(
      "topo",
      ["https://tile.opentopomap.org/{z}/{x}/{y}.png"],
      "© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)",
      17
    ),
  },
  {
    id: "light",
    name: "Light",
    style: singleRasterStyle(
      "light",
      ["https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"],
      "© OpenStreetMap contributors © CARTO"
    ),
  },
  {
    id: "dark",
    name: "Dark",
    style: singleRasterStyle(
      "dark",
      ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
      "© OpenStreetMap contributors © CARTO"
    ),
  },
];

export const DEFAULT_BASEMAP_ID = "osm";

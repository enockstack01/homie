import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { PointResult } from "../lib/api";
import { classColor } from "../lib/suitabilityColors";
import { BASEMAPS, DEFAULT_BASEMAP_ID } from "./basemaps";
import { BasemapSwitcher } from "./BasemapSwitcher";
import { Legend } from "./Legend";

// Rwanda-centered default view - the doc's whole vision is scoped to Rwanda first
// (Section 2.1), so there's no reason to open on a world view every launch.
const DEFAULT_CENTER: [number, number] = [29.9, -1.94];
const DEFAULT_ZOOM = 8;

const AOI_SOURCE_ID = "aoi-draft";
const AOI_FILL_LAYER = "aoi-draft-fill";
const AOI_LINE_LAYER = "aoi-draft-line";
const AOI_POINTS_LAYER = "aoi-draft-points";
const RESULTS_SOURCE_ID = "suitability-results";
const RESULTS_FILL_LAYER = "suitability-results-fill";
const RESULTS_OUTLINE_LAYER = "suitability-results-outline";

function boundsOfPolygon(polygon: GeoJSON.Polygon): maplibregl.LngLatBounds {
  const bounds = new maplibregl.LngLatBounds();
  for (const ring of polygon.coordinates) {
    for (const [lng, lat] of ring) {
      bounds.extend([lng, lat]);
    }
  }
  return bounds;
}

function draftFeatureCollection(points: [number, number][]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = points.map((p) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: p },
    properties: {},
  }));
  if (points.length >= 2) {
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: points },
      properties: {},
    });
  }
  if (points.length >= 3) {
    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[...points, points[0]]] },
      properties: {},
    });
  }
  return { type: "FeatureCollection", features };
}

// Each result point carries its grid cell's own bounds (see orchestrator/app/grid.py's
// cell_bounds) - rendering those as edge-to-edge filled rectangles, rather than a sparse
// dot per point, is what makes the suitability classes read as a painted surface over the
// terrain instead of a scatter plot. Points from a run predating this (bounds missing)
// are just skipped rather than crashing.
function resultsFeatureCollection(points: PointResult[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points
      .filter((p): p is PointResult & { bounds: [number, number, number, number] } => !!p.bounds)
      .map((p) => {
        const [minLon, minLat, maxLon, maxLat] = p.bounds;
        return {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [minLon, minLat],
                [maxLon, minLat],
                [maxLon, maxLat],
                [minLon, maxLat],
                [minLon, minLat],
              ],
            ],
          },
          properties: {
            color: classColor(p.suitability_class),
            score: p.suitability_score,
            cls: p.suitability_class,
            limitingFactor: p.limiting_factor ?? "none",
          },
        };
      }),
  };
}

interface Props {
  drawing: boolean;
  onPolygonComplete: (geojson: GeoJSON.Polygon) => void;
  activeAoi: GeoJSON.Polygon | null;
  results: PointResult[];
}

export function MapView({ drawing, onPolygonComplete, activeAoi, results }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const draftPointsRef = useRef<[number, number][]>([]);
  const [basemapId, setBasemapId] = useState(DEFAULT_BASEMAP_ID);

  // A style switch (setStyle) wipes every source/layer this component owns, then
  // re-fires "style.load" once the new style is ready - the handler re-adds them from
  // these refs rather than from activeAoi/results props directly, since it's registered
  // once at mount and would otherwise close over stale values.
  const activeAoiRef = useRef(activeAoi);
  const resultsRef = useRef(results);
  useEffect(() => {
    activeAoiRef.current = activeAoi;
  }, [activeAoi]);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    if (!containerRef.current) return;
    const initialBasemap = BASEMAPS.find((b) => b.id === DEFAULT_BASEMAP_ID) ?? BASEMAPS[0];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initialBasemap.style,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    mapRef.current = map;
    if (import.meta.env.DEV) (window as any).__xcropMap = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    const addOverlayLayers = () => {
      if (!map.getSource(AOI_SOURCE_ID)) {
        map.addSource(AOI_SOURCE_ID, { type: "geojson", data: draftFeatureCollection([]) });
        map.addLayer({
          id: AOI_FILL_LAYER,
          type: "fill",
          source: AOI_SOURCE_ID,
          filter: ["==", "$type", "Polygon"],
          paint: { "fill-color": "#2b6cb0", "fill-opacity": 0.15 },
        });
        map.addLayer({
          id: AOI_LINE_LAYER,
          type: "line",
          source: AOI_SOURCE_ID,
          filter: ["!=", "$type", "Point"],
          paint: { "line-color": "#2b6cb0", "line-width": 2 },
        });
        map.addLayer({
          id: AOI_POINTS_LAYER,
          type: "circle",
          source: AOI_SOURCE_ID,
          filter: ["==", "$type", "Point"],
          paint: { "circle-radius": 4, "circle-color": "#2b6cb0" },
        });
      }

      if (!map.getSource(RESULTS_SOURCE_ID)) {
        map.addSource(RESULTS_SOURCE_ID, { type: "geojson", data: resultsFeatureCollection([]) });
        map.addLayer({
          id: RESULTS_FILL_LAYER,
          type: "fill",
          source: RESULTS_SOURCE_ID,
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.75 },
        });
        map.addLayer({
          id: RESULTS_OUTLINE_LAYER,
          type: "line",
          source: RESULTS_SOURCE_ID,
          paint: { "line-color": "#14181f", "line-width": 0.5, "line-opacity": 0.35 },
        });

        map.on("mouseenter", RESULTS_FILL_LAYER, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", RESULTS_FILL_LAYER, () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", RESULTS_FILL_LAYER, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const props = f.properties as { score: number; cls: string; limitingFactor: string };
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(
              `<strong>Class ${props.cls}</strong><br/>Score: ${props.score}<br/>Limiting factor: ${props.limitingFactor}`
            )
            .addTo(map);
        });
      }

      // Re-apply current data - needed after a style switch, harmless (same data) right
      // after the very first "style.load" at mount too.
      (map.getSource(AOI_SOURCE_ID) as maplibregl.GeoJSONSource | undefined)?.setData(
        activeAoiRef.current
          ? {
              type: "FeatureCollection",
              features: [{ type: "Feature", geometry: activeAoiRef.current, properties: {} }],
            }
          : draftFeatureCollection([])
      );
      (map.getSource(RESULTS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined)?.setData(
        resultsFeatureCollection(resultsRef.current)
      );
    };

    map.on("style.load", addOverlayLayers);

    return () => map.remove();
  }, []);

  function handleBasemapChange(id: string): void {
    const map = mapRef.current;
    const basemap = BASEMAPS.find((b) => b.id === id);
    if (!map || !basemap) return;
    setBasemapId(id);
    map.setStyle(basemap.style);
  }

  // Click-to-draw: each click appends a vertex; double-click closes the polygon. Deliberately
  // hand-rolled instead of pulling in mapbox-gl-draw - this MVP only needs one simple polygon
  // per project, not a full editing toolkit (move/split/multi-geometry). Map-level event
  // listeners like these survive a setStyle() basemap switch (only sources/layers get
  // wiped), so this effect doesn't need to know about basemaps at all.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!drawing) {
      draftPointsRef.current = [];
      const source = map.getSource(AOI_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      source?.setData(draftFeatureCollection([]));
      return;
    }

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      draftPointsRef.current = [...draftPointsRef.current, [e.lngLat.lng, e.lngLat.lat]];
      const source = map.getSource(AOI_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      source?.setData(draftFeatureCollection(draftPointsRef.current));
    };

    const handleDblClick = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      if (draftPointsRef.current.length >= 3) {
        const ring = [...draftPointsRef.current, draftPointsRef.current[0]];
        onPolygonComplete({ type: "Polygon", coordinates: [ring] });
      }
    };

    map.on("click", handleClick);
    map.on("dblclick", handleDblClick);
    return () => {
      map.off("click", handleClick);
      map.off("dblclick", handleDblClick);
    };
  }, [drawing, onPolygonComplete]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // map.isStyleLoaded() used to gate this (and the results effect below), but it can
    // transiently report false for a tick right after another effect's own setData() call
    // in the same commit (e.g. effect above clearing the draft source) - GeoJSONSource
    // reprocesses async internally, and isStyleLoaded() reflects that in-flight state. That
    // silently dropped the just-completed AOI polygon with nothing to retry it, since this
    // effect only re-runs when activeAoi/drawing change again. getSource() existing is the
    // guard that actually matters (only false before the map's own "load" handler has run,
    // or mid-basemap-switch until "style.load"'s addOverlayLayers re-adds it - that same
    // handler re-applies from the refs, so this effect not firing during that window is
    // fine) - setData() itself is safe to call on an existing source at any point after that.
    const source = map.getSource(AOI_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    if (activeAoi) {
      source.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: activeAoi, properties: {} }],
      });
      // Move the camera to the AOI itself, not just draw it - matters most for selecting
      // a project from the sidebar or the Dashboard's "View on map" handoff, where the
      // map is very likely still sitting wherever it was left, nowhere near this AOI.
      map.fitBounds(boundsOfPolygon(activeAoi), { padding: 64, duration: 800, maxZoom: 15 });
    } else if (!drawing) {
      source.setData(draftFeatureCollection([]));
    }
  }, [activeAoi, drawing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // See the activeAoi effect above for why this doesn't gate on isStyleLoaded().
    const source = map.getSource(RESULTS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(resultsFeatureCollection(results));
  }, [results]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      <BasemapSwitcher value={basemapId} onChange={handleBasemapChange} />
      <Legend visible={results.length > 0} />
    </div>
  );
}

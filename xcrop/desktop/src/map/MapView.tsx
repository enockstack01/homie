import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { PointResult } from "../lib/api";
import { classColor } from "../lib/suitabilityColors";
import { BASEMAPS, DEFAULT_BASEMAP_ID } from "./basemaps";
import { BasemapSwitcher } from "./BasemapSwitcher";
import { Legend } from "./Legend";
import { MapToolbar } from "./MapToolbar";
import { CoordinateReadout } from "./CoordinateReadout";
import { formatArea, formatDistance, lineLength, nearestPointOnSegment, polygonArea } from "./geo";

// Rwanda-centered default view - the doc's whole vision is scoped to Rwanda first
// (Section 2.1), so there's no reason to open on a world view every launch.
const DEFAULT_CENTER: [number, number] = [29.9, -1.94];
const DEFAULT_ZOOM = 8;

const AOI_SOURCE_ID = "aoi-draft";
const AOI_FILL_LAYER = "aoi-draft-fill";
const AOI_LINE_LAYER = "aoi-draft-line";
const AOI_POINTS_LAYER = "aoi-draft-points";
const MEASURE_SOURCE_ID = "measure-draft";
const MEASURE_FILL_LAYER = "measure-draft-fill";
const MEASURE_LINE_LAYER = "measure-draft-line";
const MEASURE_POINTS_LAYER = "measure-draft-points";
const RESULTS_SOURCE_ID = "suitability-results";
const RESULTS_FILL_LAYER = "suitability-results-fill";
const RESULTS_OUTLINE_LAYER = "suitability-results-outline";

// Vertex handles are hit-tested in screen pixels (not map units) so the grab/insert
// radius stays a constant, comfortable click target regardless of zoom level.
const VERTEX_HIT_RADIUS_PX = 10;
const EDGE_INSERT_MAX_PX = 20;

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

// A completed AOI is rendered as a single Polygon feature; when it's still editable
// (reviewed but not yet saved as a project), one Point feature per vertex is added
// alongside it so AOI_POINTS_LAYER picks them up as drag/delete handles. The ring's last
// coordinate duplicates its first (GeoJSON's closed-ring convention) - skipped here so
// each real vertex gets exactly one handle instead of two overlapping ones.
function aoiFeatureCollection(polygon: GeoJSON.Polygon | null, includeVertexHandles: boolean): GeoJSON.FeatureCollection {
  if (!polygon) return draftFeatureCollection([]);
  const features: GeoJSON.Feature[] = [{ type: "Feature", geometry: polygon, properties: {} }];
  if (includeVertexHandles) {
    const ring = polygon.coordinates[0] ?? [];
    ring.slice(0, -1).forEach((coord, i) => {
      features.push({ type: "Feature", geometry: { type: "Point", coordinates: coord }, properties: { vertexIndex: i } });
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
  onCancelDrawing: () => void;
  // True while a just-drawn AOI is being reviewed (named + not yet saved as a project, see
  // App.tsx's pendingAoi) - the only phase where dragging/adding/deleting vertices is safe,
  // since there's no API to push an edit back onto an already-saved project's AOI.
  editable: boolean;
  onPolygonEdited: (geojson: GeoJSON.Polygon) => void;
  activeAoi: GeoJSON.Polygon | null;
  results: PointResult[];
}

export function MapView({ drawing, onPolygonComplete, onCancelDrawing, editable, onPolygonEdited, activeAoi, results }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const draftPointsRef = useRef<[number, number][]>([]);
  const measurePointsRef = useRef<[number, number][]>([]);
  const draggingVertexRef = useRef<number | null>(null);
  // Set right before a vertex drag/insert/delete calls onPolygonEdited, so the activeAoi
  // effect below can skip its usual fitBounds re-center for that one update - a self-
  // originated edit shouldn't yank the camera around the way switching to a different
  // project's AOI should.
  const skipNextFitRef = useRef(false);
  const onPolygonEditedRef = useRef(onPolygonEdited);
  const [basemapId, setBasemapId] = useState(DEFAULT_BASEMAP_ID);
  const [measuring, setMeasuring] = useState(false);
  const [measureReadout, setMeasureReadout] = useState<string | null>(null);
  const [drawPointCount, setDrawPointCount] = useState(0);
  const [cursorLngLat, setCursorLngLat] = useState<{ lng: number; lat: number } | null>(null);

  useEffect(() => {
    onPolygonEditedRef.current = onPolygonEdited;
  }, [onPolygonEdited]);

  // A style switch (setStyle) wipes every source/layer this component owns, then
  // re-fires "style.load" once the new style is ready - the handler re-adds them from
  // these refs rather than from activeAoi/results props directly, since it's registered
  // once at mount and would otherwise close over stale values.
  const activeAoiRef = useRef(activeAoi);
  const resultsRef = useRef(results);
  const editableRef = useRef(editable);
  useEffect(() => {
    activeAoiRef.current = activeAoi;
  }, [activeAoi]);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);
  useEffect(() => {
    editableRef.current = editable;
  }, [editable]);

  // Measure and AOI-drawing/editing share the map's click for entirely different
  // purposes - starting a fresh AOI while a measurement is mid-flight would otherwise fire
  // both tools off the same click.
  useEffect(() => {
    if (drawing) setMeasuring(false);
  }, [drawing]);

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
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "top-right"
    );
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("mousemove", (e) => setCursorLngLat({ lng: e.lngLat.lng, lat: e.lngLat.lat }));
    map.on("mouseout", () => setCursorLngLat(null));

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
          paint: {
            "circle-radius": 5,
            "circle-color": "#2b6cb0",
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
          },
        });
      }

      if (!map.getSource(MEASURE_SOURCE_ID)) {
        map.addSource(MEASURE_SOURCE_ID, { type: "geojson", data: draftFeatureCollection([]) });
        map.addLayer({
          id: MEASURE_FILL_LAYER,
          type: "fill",
          source: MEASURE_SOURCE_ID,
          filter: ["==", "$type", "Polygon"],
          paint: { "fill-color": "#dd6b20", "fill-opacity": 0.12 },
        });
        map.addLayer({
          id: MEASURE_LINE_LAYER,
          type: "line",
          source: MEASURE_SOURCE_ID,
          filter: ["!=", "$type", "Point"],
          paint: { "line-color": "#dd6b20", "line-width": 2, "line-dasharray": [2, 1] },
        });
        map.addLayer({
          id: MEASURE_POINTS_LAYER,
          type: "circle",
          source: MEASURE_SOURCE_ID,
          filter: ["==", "$type", "Point"],
          paint: { "circle-radius": 4, "circle-color": "#dd6b20" },
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
        aoiFeatureCollection(activeAoiRef.current, editableRef.current)
      );
      (map.getSource(MEASURE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined)?.setData(
        draftFeatureCollection(measurePointsRef.current)
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

  function handleUndoPoint(): void {
    const map = mapRef.current;
    if (!map || draftPointsRef.current.length === 0) return;
    draftPointsRef.current = draftPointsRef.current.slice(0, -1);
    setDrawPointCount(draftPointsRef.current.length);
    const source = map.getSource(AOI_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(draftFeatureCollection(draftPointsRef.current));
  }

  // Whole-map cursor hint for the two "click the map to do something" modes - vertex
  // grab/grabbing cursors are handled separately, scoped to AOI_POINTS_LAYER, below.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvasContainer().style.cursor = drawing || measuring ? "crosshair" : "";
  }, [drawing, measuring]);

  // Click-to-draw: each click appends a vertex; double-click closes the polygon; Backspace
  // undoes the last vertex; Escape cancels the whole draw. Deliberately hand-rolled instead
  // of pulling in mapbox-gl-draw - this only needs one simple polygon per project, not a
  // full editing toolkit for multiple/complex geometries. Map-level event listeners like
  // these survive a setStyle() basemap switch (only sources/layers get wiped), so this
  // effect doesn't need to know about basemaps at all.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!drawing) {
      draftPointsRef.current = [];
      setDrawPointCount(0);
      const source = map.getSource(AOI_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      source?.setData(draftFeatureCollection([]));
      return;
    }

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      draftPointsRef.current = [...draftPointsRef.current, [e.lngLat.lng, e.lngLat.lat]];
      setDrawPointCount(draftPointsRef.current.length);
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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        handleUndoPoint();
      } else if (e.key === "Escape") {
        onCancelDrawing();
      }
    };

    map.on("click", handleClick);
    map.on("dblclick", handleDblClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      map.off("click", handleClick);
      map.off("dblclick", handleDblClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [drawing, onPolygonComplete, onCancelDrawing]);

  // Measure tool: click to add points to a line/polygon, live distance (and, once closed
  // enough to have an area, area) shown in the toolbar's readout. Escape clears the current
  // trace without leaving measuring mode, so a new measurement can start right away.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!measuring) {
      measurePointsRef.current = [];
      setMeasureReadout(null);
      const source = map.getSource(MEASURE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      source?.setData(draftFeatureCollection([]));
      return;
    }

    const updateReadout = () => {
      const points = measurePointsRef.current;
      if (points.length < 2) {
        setMeasureReadout(points.length === 1 ? "Click to add another point" : "Click to start measuring");
        return;
      }
      const distanceLabel = `Distance: ${formatDistance(lineLength(points))}`;
      const areaLabel = points.length >= 3 ? ` · Area: ${formatArea(polygonArea(points))}` : "";
      setMeasureReadout(distanceLabel + areaLabel);
    };

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      measurePointsRef.current = [...measurePointsRef.current, [e.lngLat.lng, e.lngLat.lat]];
      const source = map.getSource(MEASURE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      source?.setData(draftFeatureCollection(measurePointsRef.current));
      updateReadout();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      measurePointsRef.current = [];
      const source = map.getSource(MEASURE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      source?.setData(draftFeatureCollection([]));
      updateReadout();
    };

    updateReadout();
    map.on("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      map.off("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [measuring]);

  // Post-draw AOI editing: drag a vertex to move it, double-click a vertex to delete it
  // (kept to a minimum of 3), click a line segment to insert a new vertex there. Deleting
  // is double-click rather than the more GIS-conventional right-click because MapLibre's
  // default dragRotate handler already owns the right mouse button (bound to
  // click-and-drag-to-rotate) - it swallows a right-click before this component's own
  // "contextmenu" layer listener reliably sees it, confirmed by live-testing this against
  // the actual rendered map rather than assuming the docs' event list was the whole story.
  // Only wired up while editable && !drawing (see the Props comment on editable) - there
  // is no API to push an edit back onto an already-saved project's AOI, so this never runs
  // against one.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !editable || drawing) return;

    const handleVertexMouseDown = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const f = e.features?.[0];
      const idx = f?.properties?.vertexIndex;
      if (typeof idx !== "number") return;
      e.preventDefault();
      draggingVertexRef.current = idx;
      map.dragPan.disable();
      map.getCanvas().style.cursor = "grabbing";
    };

    const handleMapMouseMove = (e: maplibregl.MapMouseEvent) => {
      const idx = draggingVertexRef.current;
      if (idx === null) return;
      const polygon = activeAoiRef.current;
      if (!polygon) return;
      const ring = [...polygon.coordinates[0]];
      ring[idx] = [e.lngLat.lng, e.lngLat.lat];
      if (idx === 0) ring[ring.length - 1] = ring[0]; // keep the ring closed
      const updated: GeoJSON.Polygon = { type: "Polygon", coordinates: [ring] };
      activeAoiRef.current = updated;
      const source = map.getSource(AOI_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      source?.setData(aoiFeatureCollection(updated, true));
    };

    const handleMapMouseUp = () => {
      if (draggingVertexRef.current === null) return;
      draggingVertexRef.current = null;
      map.dragPan.enable();
      map.getCanvas().style.cursor = "";
      const polygon = activeAoiRef.current;
      if (polygon) {
        skipNextFitRef.current = true;
        onPolygonEditedRef.current(polygon);
      }
    };

    const handleVertexMouseEnter = () => {
      if (draggingVertexRef.current === null) map.getCanvas().style.cursor = "grab";
    };
    const handleVertexMouseLeave = () => {
      if (draggingVertexRef.current === null) map.getCanvas().style.cursor = "";
    };

    const handleVertexDblClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      e.preventDefault(); // suppress the map's default zoom-in-on-dblclick
      const f = e.features?.[0];
      const idx = f?.properties?.vertexIndex;
      if (typeof idx !== "number") return;
      const polygon = activeAoiRef.current;
      if (!polygon) return;
      const ring = polygon.coordinates[0];
      if (ring.length - 1 <= 3) return; // keep at least a triangle
      const nextRing = ring.filter((_, i) => i !== idx && i !== ring.length - 1);
      nextRing.push(nextRing[0]);
      const updated: GeoJSON.Polygon = { type: "Polygon", coordinates: [nextRing] };
      activeAoiRef.current = updated;
      skipNextFitRef.current = true;
      onPolygonEditedRef.current(updated);
    };

    const handleLineClick = (e: maplibregl.MapMouseEvent) => {
      if (draggingVertexRef.current !== null) return;
      const polygon = activeAoiRef.current;
      if (!polygon) return;
      const ring = polygon.coordinates[0];
      const clickPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const clickScreen = e.point;

      // A plain click on a vertex sits exactly on that vertex's two adjacent edges too
      // (distance ~0), so without this guard it would also fire this handler and insert a
      // near-duplicate vertex right next to the one just clicked/dragged.
      const nearVertex = ring
        .slice(0, -1)
        .some((coord) => map.project(coord as [number, number]).dist(clickScreen) < VERTEX_HIT_RADIUS_PX);
      if (nearVertex) return;

      let bestPoint: [number, number] | null = null;
      let bestIndex = -1;
      let bestDistPx = Infinity;
      for (let i = 0; i < ring.length - 1; i++) {
        const point = nearestPointOnSegment(clickPoint, ring[i] as [number, number], ring[i + 1] as [number, number]);
        const distPx = map.project(point).dist(clickScreen);
        if (distPx < bestDistPx) {
          bestDistPx = distPx;
          bestIndex = i;
          bestPoint = point;
        }
      }
      if (bestIndex === -1 || !bestPoint || bestDistPx > EDGE_INSERT_MAX_PX) return;

      const nextRing = [...ring];
      nextRing.splice(bestIndex + 1, 0, bestPoint);
      const updated: GeoJSON.Polygon = { type: "Polygon", coordinates: [nextRing] };
      activeAoiRef.current = updated;
      skipNextFitRef.current = true;
      onPolygonEditedRef.current(updated);
    };

    map.on("mousedown", AOI_POINTS_LAYER, handleVertexMouseDown);
    map.on("mousemove", handleMapMouseMove);
    map.on("mouseup", handleMapMouseUp);
    map.on("mouseenter", AOI_POINTS_LAYER, handleVertexMouseEnter);
    map.on("mouseleave", AOI_POINTS_LAYER, handleVertexMouseLeave);
    map.on("dblclick", AOI_POINTS_LAYER, handleVertexDblClick);
    map.on("click", AOI_LINE_LAYER, handleLineClick);
    return () => {
      map.off("mousedown", AOI_POINTS_LAYER, handleVertexMouseDown);
      map.off("mousemove", handleMapMouseMove);
      map.off("mouseup", handleMapMouseUp);
      map.off("mouseenter", AOI_POINTS_LAYER, handleVertexMouseEnter);
      map.off("mouseleave", AOI_POINTS_LAYER, handleVertexMouseLeave);
      map.off("dblclick", AOI_POINTS_LAYER, handleVertexDblClick);
      map.off("click", AOI_LINE_LAYER, handleLineClick);
      map.dragPan.enable();
    };
  }, [editable, drawing]);

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
      source.setData(aoiFeatureCollection(activeAoi, editable && !drawing));
      if (skipNextFitRef.current) {
        // A self-originated vertex edit just committed - the shape already redrew above,
        // re-centering the camera on top of that would yank the view around mid-edit.
        skipNextFitRef.current = false;
      } else {
        // Move the camera to the AOI itself, not just draw it - matters most for selecting
        // a project from the sidebar or the Dashboard's "View on map" handoff, where the
        // map is very likely still sitting wherever it was left, nowhere near this AOI.
        map.fitBounds(boundsOfPolygon(activeAoi), { padding: 64, duration: 800, maxZoom: 15 });
      }
    } else if (!drawing) {
      source.setData(draftFeatureCollection([]));
    }
  }, [activeAoi, drawing, editable]);

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
      <div className="map-controls-left">
        <BasemapSwitcher value={basemapId} onChange={handleBasemapChange} />
        <MapToolbar
          measuring={measuring}
          onToggleMeasure={() => setMeasuring((m) => !m)}
          measureReadout={measureReadout}
          measureDisabled={drawing || editable}
          drawing={drawing}
          drawPointCount={drawPointCount}
          onUndoPoint={handleUndoPoint}
          onCancelDrawing={onCancelDrawing}
        />
        <CoordinateReadout lngLat={cursorLngLat} />
      </div>
      <Legend visible={results.length > 0} />
    </div>
  );
}

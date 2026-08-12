// Small hand-rolled geo helpers for the measure tool and edge-click vertex insertion -
// consistent with MapView's existing "hand-rolled, not a full GIS library" approach (see
// its click-to-draw comment): these are the only two calculations this app needs, so a
// turf dependency would be a lot of surface area for two formulas.

const EARTH_RADIUS_M = 6371008.8;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two [lng, lat] points, in meters (haversine). */
export function haversineDistance(a: [number, number], b: [number, number]): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total length of a line through the given [lng, lat] points, in meters. */
export function lineLength(points: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(points[i - 1], points[i]);
  }
  return total;
}

/**
 * Approximate polygon area in square meters. Projects to a local equirectangular plane
 * (meters-per-degree scaled at the ring's mean latitude) before applying the shoelace
 * formula - accurate enough for the on-map readouts this app draws at (a single
 * Rwanda-sized AOI, not a country-spanning one).
 */
export function polygonArea(points: [number, number][]): number {
  if (points.length < 3) return 0;
  const meanLat = points.reduce((sum, [, lat]) => sum + lat, 0) / points.length;
  const metersPerDegLng = 111320 * Math.cos(toRad(meanLat));
  const metersPerDegLat = 110540;
  const projected = points.map(([lng, lat]): [number, number] => [lng * metersPerDegLng, lat * metersPerDegLat]);
  let area = 0;
  for (let i = 0; i < projected.length; i++) {
    const [x1, y1] = projected[i];
    const [x2, y2] = projected[(i + 1) % projected.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(0)} m`;
}

export function formatArea(squareMeters: number): string {
  const hectares = squareMeters / 10000;
  return hectares >= 100 ? `${(hectares / 100).toFixed(2)} km²` : `${hectares.toFixed(2)} ha`;
}

/**
 * Nearest point on segment [a,b] to point p, in plain [lng,lat] degrees - an adequate
 * approximation at map-click precision for "is this click close enough to an edge to
 * insert a vertex there", since the actual accept/reject decision is made in screen
 * pixels by the caller, not on this function's degree-space distance.
 */
export function nearestPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): [number, number] {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return [ax + t * dx, ay + t * dy];
}

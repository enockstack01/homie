from dataclasses import dataclass

from shapely.geometry import Point, shape
from shapely.geometry.base import BaseGeometry

# Point sampling stands in for a true raster grid (Layer 4's "snap-to-grid" alignment)
# for this MVP - see xcrop/README.md. GRID_SIZE trades resolution for speed: each point
# costs one elevation lookup and one archive-climate lookup, and both connectors are
# external HTTP calls. 12x12=144 keeps a run to well under a minute while giving the map
# a visibly denser, more "painted surface" look than the original 8x8 (each point is
# rendered as its own filled grid cell - see routes/analyze.py's bounds computation and
# desktop/src/map/MapView.tsx's resultsFeatureCollection).
GRID_SIZE = 12

# Rough constants for converting a lat/lon cell spacing to meters (equirectangular
# approximation - fine at the sub-100km AOI scale this MVP targets, not for a
# national-scale run, which is exactly the kind of thing a real CRS-aware raster
# pipeline, per doc Section 4, would handle properly instead of approximating).
_METERS_PER_DEG_LAT = 111_320.0


@dataclass
class GridCell:
    row: int
    col: int
    lat: float
    lon: float
    inside_aoi: bool


@dataclass
class Grid:
    cells: list[GridCell]  # length GRID_SIZE * GRID_SIZE, row-major, includes outside-AOI cells
    cell_height_m: float
    cell_width_m: float
    lon_step_deg: float
    lat_step_deg: float

    def cell_bounds(self, cell: GridCell) -> list[float]:
        """[min_lon, min_lat, max_lon, max_lat] of this cell, for rendering it as a
        filled polygon (see routes/analyze.py) rather than just a center point."""
        half_lon = self.lon_step_deg / 2
        half_lat = self.lat_step_deg / 2
        return [cell.lon - half_lon, cell.lat - half_lat, cell.lon + half_lon, cell.lat + half_lat]


def build_grid(aoi_geojson: dict) -> Grid:
    """Builds the full GRID_SIZE x GRID_SIZE rectangular grid over the AOI's bounding box
    (every cell, not just ones inside the AOI) so terrain.py can finite-difference
    neighboring elevations for a slope estimate. Cells outside the AOI polygon are kept
    (flagged inside_aoi=False) purely as slope-computation context and dropped before the
    suitability engine sees them - see routes/analyze.py."""
    geometry: BaseGeometry = shape(aoi_geojson)
    min_lon, min_lat, max_lon, max_lat = geometry.bounds
    is_areal = geometry.geom_type in ("Polygon", "MultiPolygon")

    lat_span = max_lat - min_lat
    lon_span = max_lon - min_lon
    mean_lat = (min_lat + max_lat) / 2

    cells: list[GridCell] = []
    for row in range(GRID_SIZE):
        for col in range(GRID_SIZE):
            lon = min_lon + (col + 0.5) * lon_span / GRID_SIZE
            lat = min_lat + (row + 0.5) * lat_span / GRID_SIZE
            inside = geometry.contains(Point(lon, lat)) if is_areal else True
            cells.append(GridCell(row=row, col=col, lat=lat, lon=lon, inside_aoi=inside))

    if not any(c.inside_aoi for c in cells):
        # A sliver/degenerate AOI where no cell center lands inside it - force the single
        # nearest-to-centroid cell "inside" so an analysis can still run on one point.
        centroid = geometry.centroid
        nearest = min(cells, key=lambda c: (c.lat - centroid.y) ** 2 + (c.lon - centroid.x) ** 2)
        nearest.inside_aoi = True

    cell_height_m = (lat_span / GRID_SIZE) * _METERS_PER_DEG_LAT
    cell_width_m = (lon_span / GRID_SIZE) * _METERS_PER_DEG_LAT * _cos_deg(mean_lat)
    return Grid(
        cells=cells,
        cell_height_m=max(cell_height_m, 1.0),
        cell_width_m=max(cell_width_m, 1.0),
        lon_step_deg=lon_span / GRID_SIZE,
        lat_step_deg=lat_span / GRID_SIZE,
    )


def _cos_deg(deg: float) -> float:
    import math

    return math.cos(math.radians(deg))

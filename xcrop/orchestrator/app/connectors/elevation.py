import httpx

# Open-Meteo's elevation endpoint - free, no API key, backed by Copernicus GLO-90 - stands
# in here for the full spec's SRTM/Copernicus GLO-30 DEM connector (Layer 2's terrain
# source). A real DEM download+COG pipeline (Layer 3/4) would give a continuous raster
# instead of point samples; this trades resolution for zero setup cost, see xcrop/README.md.
_ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"

# Open-Meteo caps a single request's location list; batching keeps this connector to one
# HTTP round trip for a whole AOI grid instead of one per point.
_BATCH_SIZE = 100


async def fetch_elevation(points: list[tuple[float, float]]) -> list[float]:
    """points: list of (lat, lon). Returns elevation in meters, same order as input."""
    elevations: list[float] = []
    async with httpx.AsyncClient(timeout=30) as client:
        for i in range(0, len(points), _BATCH_SIZE):
            batch = points[i : i + _BATCH_SIZE]
            lats = ",".join(str(p[0]) for p in batch)
            lons = ",".join(str(p[1]) for p in batch)
            response = await client.get(_ELEVATION_URL, params={"latitude": lats, "longitude": lons})
            response.raise_for_status()
            elevations.extend(response.json()["elevation"])
    return elevations

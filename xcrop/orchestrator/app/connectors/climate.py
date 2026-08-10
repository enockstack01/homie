from datetime import date

import httpx

# Open-Meteo's historical archive - free, no API key. Stands in for the full spec's CHIRPS
# (rainfall) / NASA POWER / WorldClim connectors (Layer 2), which provide true 30-year
# climate normals; this instead averages the single most recent complete calendar year, so
# treat annual_rainfall_mm/mean_temp_c as a one-year snapshot, not a climatology. See
# xcrop/README.md for the gap and how to close it (WorldClim monthly normals connector).
_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

# The archive API is slower per-location than the elevation endpoint (it's summing daily
# series server-side) and undocumented on a hard location cap for the free tier, so this
# batch is kept conservative to avoid a timeout or a 400 on a large AOI grid.
_BATCH_SIZE = 15


def _most_recent_complete_year() -> int:
    return date.today().year - 1


async def fetch_annual_climate(points: list[tuple[float, float]]) -> list[dict]:
    """points: list of (lat, lon). Returns [{"annual_rainfall_mm": float, "mean_temp_c": float}, ...]
    for the most recent complete calendar year, same order as input."""
    year = _most_recent_complete_year()
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"

    results: list[dict] = []
    async with httpx.AsyncClient(timeout=60) as client:
        for i in range(0, len(points), _BATCH_SIZE):
            batch = points[i : i + _BATCH_SIZE]
            lats = ",".join(str(p[0]) for p in batch)
            lons = ",".join(str(p[1]) for p in batch)
            response = await client.get(
                _ARCHIVE_URL,
                params={
                    "latitude": lats,
                    "longitude": lons,
                    "start_date": start_date,
                    "end_date": end_date,
                    "daily": "precipitation_sum,temperature_2m_mean",
                    "timezone": "UTC",
                },
            )
            response.raise_for_status()
            payload = response.json()
            # Open-Meteo returns a single object (not a list) when exactly one location is
            # requested, and a list of per-location objects otherwise - normalize both.
            entries = payload if isinstance(payload, list) else [payload]
            for entry in entries:
                daily = entry["daily"]
                precip = [v for v in daily["precipitation_sum"] if v is not None]
                temp = [v for v in daily["temperature_2m_mean"] if v is not None]
                results.append(
                    {
                        "annual_rainfall_mm": round(sum(precip), 1) if precip else None,
                        "mean_temp_c": round(sum(temp) / len(temp), 1) if temp else None,
                    }
                )
    return results

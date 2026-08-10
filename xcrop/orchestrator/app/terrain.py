from app.grid import GRID_SIZE, Grid


def compute_slope_percent(grid: Grid, elevations: list[float]) -> list[float]:
    """Finite-difference slope (rise/run * 100) per cell, using central differences where
    both neighbors exist and a one-sided difference at grid edges. This is the point-grid
    equivalent of the doc's terrain-derivatives layer (Section 5, Layer 5) computing slope
    from a DEM raster via a 3x3 kernel - same idea, coarser input."""
    elev = {i: elevations[i] for i in range(len(elevations))}

    def index(row: int, col: int) -> int | None:
        if 0 <= row < GRID_SIZE and 0 <= col < GRID_SIZE:
            return row * GRID_SIZE + col
        return None

    slopes: list[float] = []
    for cell in grid.cells:
        i = index(cell.row, cell.col)
        assert i is not None

        left = index(cell.row, cell.col - 1)
        right = index(cell.row, cell.col + 1)
        up = index(cell.row - 1, cell.col)
        down = index(cell.row + 1, cell.col)

        dz_dx = _gradient(elev, i, left, right, grid.cell_width_m)
        dz_dy = _gradient(elev, i, up, down, grid.cell_height_m)

        slope_ratio = (dz_dx**2 + dz_dy**2) ** 0.5
        slopes.append(round(slope_ratio * 100, 2))

    return slopes


def _gradient(elev: dict[int, float], center: int, before: int | None, after: int | None, spacing_m: float) -> float:
    if before is not None and after is not None:
        return (elev[after] - elev[before]) / (2 * spacing_m)
    if after is not None:
        return (elev[after] - elev[center]) / spacing_m
    if before is not None:
        return (elev[center] - elev[before]) / spacing_m
    return 0.0

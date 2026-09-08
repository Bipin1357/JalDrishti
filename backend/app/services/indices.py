"""
Indices Calculation Service for JalDrishti.

Computes NDVI and NDWI from Sentinel-2 L2A satellite data
and calculates before/after changes.
"""

from pathlib import Path
from typing import Dict, Any, Optional, Tuple, Union

import numpy as np
import rasterio


# ---------------------------------------------------------
# Project paths
# ---------------------------------------------------------

SERVICES_DIR = Path(__file__).resolve().parent
APP_DIR = SERVICES_DIR.parent
BACKEND_DIR = APP_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

DEFAULT_DATA_DIR = PROJECT_ROOT / "data"
DEFAULT_BEFORE_DIR = DEFAULT_DATA_DIR / "before"
DEFAULT_AFTER_DIR = DEFAULT_DATA_DIR / "after"


# ---------------------------------------------------------
# Required Sentinel-2 bands
# ---------------------------------------------------------

BAND_SUFFIXES = {
    "B03": "B03_10m",
    "B04": "B04_10m",
    "B08": "B08_10m",
}


# ---------------------------------------------------------
# Find one complete Sentinel-2 scene
# ---------------------------------------------------------

def locate_band_files(
    folder_path: Union[str, Path],
    scene_date: Optional[str] = None,
) -> Dict[str, Path]:
    """
    Locate B03, B04 and B08 from ONE Sentinel-2 acquisition.

    scene_date:
        Optional date in YYYYMMDD format.

        Example:
            "20250212"
            "20250222"
    """

    folder = Path(folder_path).resolve()

    if not folder.exists():
        raise FileNotFoundError(
            f"Data directory not found: {folder}"
        )

    # Find all JP2 files
    all_files = list(folder.rglob("*.jp2"))

    if not all_files:
        raise FileNotFoundError(
            f"No JP2 files found inside: {folder}"
        )

    # If a date is supplied, restrict files to that acquisition
    if scene_date:
        all_files = [
            p for p in all_files
            if scene_date in p.name
            or scene_date in str(p.parent.parent.parent.parent)
        ]

    if not all_files:
        raise FileNotFoundError(
            f"No Sentinel-2 JP2 files found for scene date "
            f"{scene_date} inside '{folder}'"
        )

    band_paths: Dict[str, Path] = {}

    for band_key, band_suffix in BAND_SUFFIXES.items():

        matches = [
            p for p in all_files
            if p.name.endswith(f"{band_suffix}.jp2")
        ]

        if not matches:
            raise FileNotFoundError(
                f"Required band {band_key} ({band_suffix}) "
                f"not found for scene {scene_date or 'selected scene'}"
            )

        # If multiple matches exist, make sure they belong to
        # the same Sentinel-2 acquisition.
        if len(matches) > 1:
            raise ValueError(
                f"Multiple {band_key} files found for scene "
                f"{scene_date or 'selected scene'}:\n"
                + "\n".join(str(p) for p in matches)
            )

        band_paths[band_key] = matches[0]

    # -----------------------------------------------------
    # Final consistency check
    # -----------------------------------------------------

    parent_identifiers = set()

    for path in band_paths.values():
        parts = path.parts

        # Find the .SAFE directory in the path
        safe_dirs = [
            part for part in parts
            if part.endswith(".SAFE")
        ]

        if safe_dirs:
            parent_identifiers.add(safe_dirs[-1])

    if len(parent_identifiers) > 1:
        raise ValueError(
            "B03, B04 and B08 belong to different Sentinel-2 scenes."
        )

    return band_paths


# ---------------------------------------------------------
# Load raster bands
# ---------------------------------------------------------

def load_raster_bands(
    folder_path: Union[str, Path],
    scene_date: Optional[str] = None,
) -> Tuple[Dict[str, np.ndarray], Dict[str, Any]]:
    """
    Load B03, B04 and B08 as float32 NumPy arrays.
    """

    band_files = locate_band_files(
        folder_path,
        scene_date=scene_date,
    )

    bands: Dict[str, np.ndarray] = {}
    profile: Dict[str, Any] = {}

    for band_name, file_path in band_files.items():

        with rasterio.open(file_path) as src:

            data = src.read(1).astype(np.float32)

            bands[band_name] = data

            if not profile:
                profile = src.profile.copy()

    # Make sure all arrays have the same dimensions
    shapes = {
        band_name: array.shape
        for band_name, array in bands.items()
    }

    if len(set(shapes.values())) != 1:
        raise ValueError(
            f"Band dimensions do not match: {shapes}"
        )

    return bands, profile


# ---------------------------------------------------------
# NDVI
# ---------------------------------------------------------

def calculate_ndvi(
    b04: np.ndarray,
    b08: np.ndarray,
) -> np.ndarray:
    """
    NDVI = (NIR - Red) / (NIR + Red)

    Sentinel-2:
        B04 = Red
        B08 = NIR
    """

    numerator = b08 - b04
    denominator = b08 + b04

    ndvi = np.zeros_like(
        denominator,
        dtype=np.float32,
    )

    np.divide(
        numerator,
        denominator,
        out=ndvi,
        where=denominator != 0,
    )

    return ndvi


# ---------------------------------------------------------
# NDWI
# ---------------------------------------------------------

def calculate_ndwi(
    b03: np.ndarray,
    b08: np.ndarray,
) -> np.ndarray:
    """
    NDWI = (Green - NIR) / (Green + NIR)

    Sentinel-2:
        B03 = Green
        B08 = NIR
    """

    numerator = b03 - b08
    denominator = b03 + b08

    ndwi = np.zeros_like(
        denominator,
        dtype=np.float32,
    )

    np.divide(
        numerator,
        denominator,
        out=ndwi,
        where=denominator != 0,
    )

    return ndwi


# ---------------------------------------------------------
# Calculate indices for one period
# ---------------------------------------------------------

def calculate_indices_for_period(
    folder_path: Union[str, Path],
    scene_date: Optional[str] = None,
) -> Tuple[Dict[str, np.ndarray], Dict[str, Any]]:
    """
    Calculate NDVI and NDWI for one Sentinel-2 scene.
    """

    bands, profile = load_raster_bands(
        folder_path,
        scene_date=scene_date,
    )

    b03 = bands["B03"]
    b04 = bands["B04"]
    b08 = bands["B08"]

    ndvi = calculate_ndvi(
        b04=b04,
        b08=b08,
    )

    ndwi = calculate_ndwi(
        b03=b03,
        b08=b08,
    )

    return {
        "ndvi": ndvi,
        "ndwi": ndwi,
    }, profile


import os
from rasterio.windows import Window
from typing import Generator

# Limit GDAL block cache to 32MB to operate safely within Render Free 512MB RAM
os.environ.setdefault("GDAL_CACHEMAX", "32")
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "TRUE")


# ---------------------------------------------------------
# Running Statistics Accumulator
# ---------------------------------------------------------

class RunningStats:
    """
    Numerically stable running statistics accumulator using float64
    and Neumaier compensated summation.
    """

    def __init__(self, shape: Tuple[int, int]):
        self.min_val: float = float("inf")
        self.max_val: float = float("-inf")
        self.sum_val: float = 0.0
        self.compensation: float = 0.0
        self.count: int = 0
        self.shape: list = list(shape)

    def update(self, arr: np.ndarray) -> None:
        """
        Update running statistics with an array chunk.
        Invalid/no-data pixels (non-finite) are filtered identically to np.isfinite(arr).
        """
        finite_mask = np.isfinite(arr)
        if not np.any(finite_mask):
            return
        valid = arr[finite_mask]

        local_min = float(np.min(valid))
        local_max = float(np.max(valid))
        if local_min < self.min_val:
            self.min_val = local_min
        if local_max > self.max_val:
            self.max_val = local_max

        chunk_sum = float(np.sum(valid, dtype=np.float64))
        chunk_count = valid.size

        # Neumaier compensated summation for double-precision accuracy
        t = self.sum_val + chunk_sum
        if abs(self.sum_val) >= abs(chunk_sum):
            self.compensation += (self.sum_val - t) + chunk_sum
        else:
            self.compensation += (chunk_sum - t) + self.sum_val
        self.sum_val = t

        self.count += chunk_count

    @property
    def total_sum(self) -> float:
        return self.sum_val + self.compensation

    def to_dict(self) -> dict:
        if self.count == 0:
            return {
                "min": None,
                "max": None,
                "mean": None,
                "shape": self.shape,
            }
        return {
            "min": float(self.min_val),
            "max": float(self.max_val),
            "mean": float(self.total_sum / self.count),
            "shape": self.shape,
        }


class RasterStatsDict(dict):
    """
    Dict subclass providing both dict access and a .mean() method
    for backwards compatibility with legacy callers.
    """

    def mean(self) -> Optional[float]:
        return self.get("mean")


def _get_safe_windows(
    src: rasterio.DatasetReader,
    max_size: int = 1024,
) -> Generator[Window, None, None]:
    """
    Generate processing windows.
    Prefers native block_windows() when practical and bounded by max_size;
    otherwise yields bounded windows no larger than max_size x max_size.
    """
    block_shapes = src.block_shapes
    if block_shapes:
        block_h, block_w = block_shapes[0]
        if 0 < block_h <= max_size and 0 < block_w <= max_size:
            for _, window in src.block_windows(1):
                yield window
            return

    # Fallback for rasters with very large or missing block structures
    height, width = src.height, src.width
    for row in range(0, height, max_size):
        h = min(max_size, height - row)
        for col in range(0, width, max_size):
            w = min(max_size, width - col)
            yield Window(col, row, w, h)


# ---------------------------------------------------------
# Before / After (Windowed Low-Memory Calculation)
# ---------------------------------------------------------

def calculate_before_after(
    before_dir: Optional[Union[str, Path]] = None,
    after_dir: Optional[Union[str, Path]] = None,
    before_date: Optional[str] = "20250212",
    after_date: Optional[str] = "20250222",
) -> Dict[str, Any]:
    """
    Calculate summary statistics for:
        NDVI Before, NDVI After, NDVI Change
        NDWI Before, NDWI After, NDWI Change

    Uses rasterio windowed/block processing with GDAL cache constraints
    to ensure memory consumption remains under ~150 MB, safely running
    on Render Free (512 MB).

    Never holds full 10,980 x 10,980 arrays in memory.
    """

    target_before = (
        Path(before_dir).resolve()
        if before_dir
        else DEFAULT_BEFORE_DIR
    )

    target_after = (
        Path(after_dir).resolve()
        if after_dir
        else DEFAULT_AFTER_DIR
    )

    before_band_files = locate_band_files(target_before, scene_date=before_date)
    after_band_files = locate_band_files(target_after, scene_date=after_date)

    with rasterio.Env(GDAL_CACHEMAX=32, VSI_CACHE=False, GDAL_DISABLE_READDIR_ON_OPEN="TRUE"):
        with rasterio.open(before_band_files["B03"]) as b_b03, \
             rasterio.open(before_band_files["B04"]) as b_b04, \
             rasterio.open(before_band_files["B08"]) as b_b08, \
             rasterio.open(after_band_files["B03"]) as a_b03, \
             rasterio.open(after_band_files["B04"]) as a_b04, \
             rasterio.open(after_band_files["B08"]) as a_b08:

            if b_b04.shape != a_b04.shape:
                raise ValueError(
                    f"Before raster shape {b_b04.shape} does not match "
                    f"after raster shape {a_b04.shape}"
                )

            raster_shape = b_b04.shape
            before_profile = b_b04.profile.copy()
            after_profile = a_b04.profile.copy()

            stats = {
                "ndvi": {
                    "before": RunningStats(raster_shape),
                    "after": RunningStats(raster_shape),
                    "change": RunningStats(raster_shape),
                },
                "ndwi": {
                    "before": RunningStats(raster_shape),
                    "after": RunningStats(raster_shape),
                    "change": RunningStats(raster_shape),
                },
            }

            # Iterate windows (preferring native 1024x1024 JP2 block windows)
            for window in _get_safe_windows(b_b04, max_size=1024):
                # 1. Read only B03, B04, B08 for this window as float32
                bb03 = b_b03.read(1, window=window).astype(np.float32)
                bb04 = b_b04.read(1, window=window).astype(np.float32)
                bb08 = b_b08.read(1, window=window).astype(np.float32)

                ab03 = a_b03.read(1, window=window).astype(np.float32)
                ab04 = a_b04.read(1, window=window).astype(np.float32)
                ab08 = a_b08.read(1, window=window).astype(np.float32)

                # 2. Calculate window NDVI and NDWI using exact formulas and zero-denominator handling
                b_ndvi = calculate_ndvi(b04=bb04, b08=bb08)
                b_ndwi = calculate_ndwi(b03=bb03, b08=bb08)

                a_ndvi = calculate_ndvi(b04=ab04, b08=ab08)
                a_ndwi = calculate_ndwi(b03=ab03, b08=ab08)

                # 3. Calculate window change
                ch_ndvi = (a_ndvi - b_ndvi).astype(np.float32)
                ch_ndwi = (a_ndwi - b_ndwi).astype(np.float32)

                # 4. Update incremental running statistics
                stats["ndvi"]["before"].update(b_ndvi)
                stats["ndvi"]["after"].update(a_ndvi)
                stats["ndvi"]["change"].update(ch_ndvi)

                stats["ndwi"]["before"].update(b_ndwi)
                stats["ndwi"]["after"].update(a_ndwi)
                stats["ndwi"]["change"].update(ch_ndwi)

                # 5. Immediately delete temporary window arrays
                del bb03, bb04, bb08, ab03, ab04, ab08
                del b_ndvi, b_ndwi, a_ndvi, a_ndwi, ch_ndvi, ch_ndwi

    ndvi_before_stats = stats["ndvi"]["before"].to_dict()
    ndvi_after_stats = stats["ndvi"]["after"].to_dict()
    ndvi_change_stats = stats["ndvi"]["change"].to_dict()

    ndwi_before_stats = stats["ndwi"]["before"].to_dict()
    ndwi_after_stats = stats["ndwi"]["after"].to_dict()
    ndwi_change_stats = stats["ndwi"]["change"].to_dict()

    return {
        "ndvi": {
            "before": ndvi_before_stats,
            "after": ndvi_after_stats,
            "change": ndvi_change_stats,
        },
        "ndwi": {
            "before": ndwi_before_stats,
            "after": ndwi_after_stats,
            "change": ndwi_change_stats,
        },
        # Backwards-compatible aliases supporting both dict lookups and .mean()
        "ndvi_before": RasterStatsDict(ndvi_before_stats),
        "ndvi_after": RasterStatsDict(ndvi_after_stats),
        "ndvi_change": RasterStatsDict(ndvi_change_stats),
        "ndwi_before": RasterStatsDict(ndwi_before_stats),
        "ndwi_after": RasterStatsDict(ndwi_after_stats),
        "ndwi_change": RasterStatsDict(ndwi_change_stats),

        "before_profile": before_profile,
        "after_profile": after_profile,
        "before_date": before_date,
        "after_date": after_date,
    }
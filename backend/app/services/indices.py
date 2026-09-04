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


# ---------------------------------------------------------
# Before / After
# ---------------------------------------------------------

def calculate_before_after(
    before_dir: Optional[Union[str, Path]] = None,
    after_dir: Optional[Union[str, Path]] = None,
    before_date: Optional[str] = "20250212",
    after_date: Optional[str] = "20250222",
) -> Dict[str, Any]:
    """
    Calculate:

        NDVI Before
        NDVI After
        NDVI Change

        NDWI Before
        NDWI After
        NDWI Change

    Current test scenes:

        Before = 12-Feb-2025
        After  = 22-Feb-2025
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

    # -----------------------------------------------------
    # BEFORE
    # -----------------------------------------------------

    before_indices, before_profile = calculate_indices_for_period(
        target_before,
        scene_date=before_date,
    )

    # -----------------------------------------------------
    # AFTER
    # -----------------------------------------------------

    after_indices, after_profile = calculate_indices_for_period(
        target_after,
        scene_date=after_date,
    )

    # -----------------------------------------------------
    # NDVI
    # -----------------------------------------------------

    ndvi_before = before_indices["ndvi"]
    ndvi_after = after_indices["ndvi"]

    ndvi_change = (
        ndvi_after - ndvi_before
    ).astype(np.float32)

    # -----------------------------------------------------
    # NDWI
    # -----------------------------------------------------

    ndwi_before = before_indices["ndwi"]
    ndwi_after = after_indices["ndwi"]

    ndwi_change = (
        ndwi_after - ndwi_before
    ).astype(np.float32)

    # -----------------------------------------------------
    # Return everything
    # -----------------------------------------------------

    return {
        "ndvi_before": ndvi_before,
        "ndvi_after": ndvi_after,
        "ndvi_change": ndvi_change,

        "ndwi_before": ndwi_before,
        "ndwi_after": ndwi_after,
        "ndwi_change": ndwi_change,

        "before_profile": before_profile,
        "after_profile": after_profile,

        "before_date": before_date,
        "after_date": after_date,
    }
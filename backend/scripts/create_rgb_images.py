"""
RGB True-Color Satellite Image Generator for JalDrishti.

Recursively locates Sentinel-2 L2A 10m bands (B04=Red, B03=Green, B02=Blue),
applies memory-efficient downsampled reading via Rasterio, performs
percentile-based contrast stretching, and exports natural color PNGs.
"""

import argparse
from pathlib import Path
from typing import Dict, Optional, Tuple, Sequence
import warnings
import numpy as np
import rasterio
from rasterio.enums import Resampling

# Ignore non-georeferenced warning when saving standard display PNGs
warnings.filterwarnings("ignore", category=rasterio.errors.NotGeoreferencedWarning)

# Base project directory resolution (backend/scripts -> backend -> project root)
SCRIPTS_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPTS_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

DEFAULT_DATA_DIR = PROJECT_ROOT / "data"
DEFAULT_BEFORE_DIR = DEFAULT_DATA_DIR / "before"
DEFAULT_AFTER_DIR = DEFAULT_DATA_DIR / "after"
DEFAULT_RESULTS_DIR = DEFAULT_DATA_DIR / "results"

BAND_SUFFIXES: Dict[str, str] = {
    "B04": "B04_10m",  # Red
    "B03": "B03_10m",  # Green
    "B02": "B02_10m",  # Blue
}


def find_band_files(
    dataset_dir: Path,
    required_bands: Sequence[str] = ("B04", "B03", "B02")
) -> Dict[str, Path]:
    """
    Recursively locate 10m JP2 band files for the requested Sentinel-2 bands.

    :param dataset_dir: Path to directory containing Sentinel-2 SAFE / JP2 data.
    :param required_bands: Band names to search for (e.g., 'B04', 'B03', 'B02').
    :return: Dictionary mapping band name to its resolved Path.
    :raises FileNotFoundError: If dataset_dir does not exist or any required band is missing.
    """
    dataset_path = Path(dataset_dir).resolve()
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset directory does not exist: {dataset_path}")

    band_paths: Dict[str, Path] = {}
    for band_key in required_bands:
        suffix = BAND_SUFFIXES.get(band_key, f"{band_key}_10m")
        matches = [p for p in dataset_path.rglob("*.jp2") if suffix in p.name]
        if not matches:
            raise FileNotFoundError(
                f"Missing required band '{band_key}' (pattern '{suffix}') in '{dataset_path}'"
            )
        band_paths[band_key] = matches[0]

    return band_paths


def read_downsampled_band(
    file_path: Path,
    max_dimension: int = 2000
) -> Tuple[np.ndarray, Tuple[int, int]]:
    """
    Read a single band directly at the downsampled display resolution using Rasterio.
    This avoids loading unnecessary full 10980x10980 arrays into memory.

    :param file_path: Path to the JP2 raster file.
    :param max_dimension: Maximum pixel size along height or width.
    :return: Tuple of (2D numpy array, output dimensions (height, width)).
    """
    with rasterio.open(file_path) as src:
        orig_h, orig_w = src.height, src.width
        scale = min(1.0, max_dimension / max(orig_h, orig_w))
        out_height = round(orig_h * scale)
        out_width = round(orig_w * scale)
        out_shape = (out_height, out_width)

        data = src.read(
            1,
            out_shape=out_shape,
            resampling=Resampling.bilinear
        )
        return data, out_shape


def percentile_contrast_stretch(
    band_data: np.ndarray,
    lower_percentile: float = 2.0,
    upper_percentile: float = 98.0
) -> np.ndarray:
    """
    Apply percentile-based contrast stretching to map raw reflectance values to 0-255 uint8.
    Zero/nodata values are excluded from the percentile computation.

    :param band_data: 2D numpy array of raw pixel values.
    :param lower_percentile: Lower cutoff percentile (default 2.0).
    :param upper_percentile: Upper cutoff percentile (default 98.0).
    :return: 2D numpy array scaled to uint8 (0-255).
    """
    valid = band_data[band_data > 0]
    if valid.size == 0:
        return np.zeros_like(band_data, dtype=np.uint8)

    p_low = float(np.percentile(valid, lower_percentile))
    p_high = float(np.percentile(valid, upper_percentile))

    # Guard against flat or uniform rasters
    if p_high <= p_low:
        p_high = p_low + 1e-5

    stretched = np.clip((band_data.astype(np.float32) - p_low) / (p_high - p_low) * 255.0, 0, 255)
    return stretched.astype(np.uint8)


def generate_rgb_image(
    dataset_dir: Path,
    output_png_path: Path,
    max_dimension: int = 2000,
    lower_percentile: float = 2.0,
    upper_percentile: float = 98.0
) -> Dict[str, object]:
    """
    Generates a true-color RGB PNG (Red=B04, Green=B03, Blue=B02) for a given dataset.

    :param dataset_dir: Directory containing the Sentinel-2 dataset.
    :param output_png_path: Target path for the output PNG file.
    :param max_dimension: Maximum height/width for downsampling.
    :param lower_percentile: Lower percentile for contrast stretching.
    :param upper_percentile: Upper percentile for contrast stretching.
    :return: Metadata dictionary with output dimensions, file path, and size.
    """
    bands = find_band_files(dataset_dir, required_bands=("B04", "B03", "B02"))

    # Read each band at downsampled resolution
    b04_raw, out_shape = read_downsampled_band(bands["B04"], max_dimension=max_dimension)
    b03_raw, _ = read_downsampled_band(bands["B03"], max_dimension=max_dimension)
    b02_raw, _ = read_downsampled_band(bands["B02"], max_dimension=max_dimension)

    # Stretch contrast to uint8 (0-255)
    r = percentile_contrast_stretch(b04_raw, lower_percentile, upper_percentile)
    g = percentile_contrast_stretch(b03_raw, lower_percentile, upper_percentile)
    b = percentile_contrast_stretch(b02_raw, lower_percentile, upper_percentile)

    # Ensure output directory exists
    output_png_path.parent.mkdir(parents=True, exist_ok=True)

    height, width = out_shape
    with rasterio.open(
        output_png_path,
        "w",
        driver="PNG",
        height=height,
        width=width,
        count=3,
        dtype="uint8"
    ) as dst:
        dst.write(r, 1)  # Band 1 = Red
        dst.write(g, 2)  # Band 2 = Green
        dst.write(b, 3)  # Band 3 = Blue

    file_size_bytes = output_png_path.stat().st_size
    file_size_mb = file_size_bytes / (1024 * 1024)

    return {
        "output_path": str(output_png_path),
        "dimensions": [width, height],
        "file_size_bytes": file_size_bytes,
        "file_size_mb": round(file_size_mb, 2),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Generate downsampled, contrast-stretched true-color RGB PNGs from Sentinel-2 data."
    )
    parser.add_argument(
        "--before-dir",
        type=Path,
        default=DEFAULT_BEFORE_DIR,
        help="Path to the 'before' Sentinel-2 dataset directory."
    )
    parser.add_argument(
        "--after-dir",
        type=Path,
        default=DEFAULT_AFTER_DIR,
        help="Path to the 'after' Sentinel-2 dataset directory."
    )
    parser.add_argument(
        "--results-dir",
        type=Path,
        default=DEFAULT_RESULTS_DIR,
        help="Directory to save generated PNG images."
    )
    parser.add_argument(
        "--max-dim",
        type=int,
        default=2000,
        help="Maximum width or height for the output PNG (default: 2000)."
    )

    args = parser.parse_args()

    results_dir = args.results_dir.resolve()
    results_dir.mkdir(parents=True, exist_ok=True)

    before_png = results_dir / "BEFORE_2025-02-12.png"
    after_png = results_dir / "AFTER_2025-02-27.png"

    print("==========================================================")
    print("JalDrishti - Sentinel-2 RGB Image Generator")
    print("==========================================================")
    print(f"Results directory : {results_dir}")
    print(f"Max dimension     : {args.max_dim}px\n")

    # 1. Generate Before Image
    print(f"[1/2] Processing BEFORE dataset: {args.before_dir}")
    before_info = generate_rgb_image(
        dataset_dir=args.before_dir,
        output_png_path=before_png,
        max_dimension=args.max_dim
    )
    print(f"  -> Generated: {before_info['output_path']}")
    print(f"  -> Dimensions: {before_info['dimensions'][0]}x{before_info['dimensions'][1]} px")
    print(f"  -> File Size: {before_info['file_size_mb']} MB ({before_info['file_size_bytes']} bytes)\n")

    # 2. Generate After Image
    print(f"[2/2] Processing AFTER dataset: {args.after_dir}")
    after_info = generate_rgb_image(
        dataset_dir=args.after_dir,
        output_png_path=after_png,
        max_dimension=args.max_dim
    )
    print(f"  -> Generated: {after_info['output_path']}")
    print(f"  -> Dimensions: {after_info['dimensions'][0]}x{after_info['dimensions'][1]} px")
    print(f"  -> File Size: {after_info['file_size_mb']} MB ({after_info['file_size_bytes']} bytes)\n")

    print("==========================================================")
    print("All RGB images successfully generated!")
    print("==========================================================")


if __name__ == "__main__":
    main()

from pathlib import Path

import numpy as np
import rasterio
from PIL import Image


# ---------------------------------------------------------
# Paths
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]

AFTER_DIR = (
    PROJECT_ROOT
    / "data"
    / "after"
    / "S2B_MSIL2A_20250222T052739_N0511_R105_T43RGM_20250222T073727.SAFE"
)

B02 = next(AFTER_DIR.rglob("*_B02_10m.jp2"))
B03 = next(AFTER_DIR.rglob("*_B03_10m.jp2"))
B04 = next(AFTER_DIR.rglob("*_B04_10m.jp2"))

OUTPUT_DIR = PROJECT_ROOT / "data" / "results"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_FILE = OUTPUT_DIR / "after_20250222_rgb.png"


# ---------------------------------------------------------
# Read bands
# ---------------------------------------------------------

print("Reading Sentinel-2 bands...")

with rasterio.open(B02) as src:
    blue = src.read(1).astype(np.float32)

with rasterio.open(B03) as src:
    green = src.read(1).astype(np.float32)

with rasterio.open(B04) as src:
    red = src.read(1).astype(np.float32)


# ---------------------------------------------------------
# Convert reflectance values for visualization
# ---------------------------------------------------------

def stretch_band(band):
    """
    Convert Sentinel-2 reflectance values into
    displayable 8-bit values.
    """

    # Sentinel-2 L2A reflectance is commonly scaled by 10000.
    band = band / 10000.0

    # Clip to a useful natural-color range.
    band = np.clip(band, 0.0, 0.3)

    # Convert to 0-255.
    band = (band / 0.3 * 255).astype(np.uint8)

    return band


print("Preparing RGB image...")

red = stretch_band(red)
green = stretch_band(green)
blue = stretch_band(blue)


# ---------------------------------------------------------
# Stack RGB
# ---------------------------------------------------------

rgb = np.dstack((red, green, blue))


# ---------------------------------------------------------
# Save PNG
# ---------------------------------------------------------

image = Image.fromarray(rgb, mode="RGB")

image.save(OUTPUT_FILE)

print()
print("SUCCESS")
print(f"RGB image created at:")
print(OUTPUT_FILE)
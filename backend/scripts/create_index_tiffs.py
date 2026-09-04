from pathlib import Path

import numpy as np
import rasterio

from app.services.indices import calculate_before_after


# ---------------------------------------------------------
# Paths
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]

OUTPUT_DIR = PROJECT_ROOT / "data" / "results"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------
# Calculate Before / After indices
# ---------------------------------------------------------

print("Calculating NDVI and NDWI...")

results = calculate_before_after(
    before_date="20250212",
    after_date="20250222",
)

print("Calculation complete.")


# ---------------------------------------------------------
# Save GeoTIFF helper
# ---------------------------------------------------------

def save_geotiff(
    output_path: Path,
    array: np.ndarray,
    profile: dict,
):
    profile = profile.copy()

    profile.update(
        driver="GTiff",
        dtype="float32",
        count=1,
        compress="deflate",
        nodata=None,
    )

    with rasterio.open(output_path, "w", **profile) as dst:
        dst.write(
            array.astype(np.float32),
            1,
        )

    print(f"Created: {output_path}")


# ---------------------------------------------------------
# Save files
# ---------------------------------------------------------

save_geotiff(
    OUTPUT_DIR / "ndvi_before.tif",
    results["ndvi_before"],
    results["before_profile"],
)

save_geotiff(
    OUTPUT_DIR / "ndvi_after.tif",
    results["ndvi_after"],
    results["after_profile"],
)

save_geotiff(
    OUTPUT_DIR / "ndvi_change.tif",
    results["ndvi_change"],
    results["after_profile"],
)

save_geotiff(
    OUTPUT_DIR / "ndwi_before.tif",
    results["ndwi_before"],
    results["before_profile"],
)

save_geotiff(
    OUTPUT_DIR / "ndwi_after.tif",
    results["ndwi_after"],
    results["after_profile"],
)

save_geotiff(
    OUTPUT_DIR / "ndwi_change.tif",
    results["ndwi_change"],
    results["after_profile"],
)


# ---------------------------------------------------------
# Final verification
# ---------------------------------------------------------

print()
print("SUCCESS")
print()
print("Generated files:")

for file in sorted(OUTPUT_DIR.glob("*.tif")):
    print(f" - {file.name}")
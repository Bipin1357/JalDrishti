"""
API routes for Sentinel-2 satellite indices (NDVI, NDWI).
"""

from typing import List, Optional
import numpy as np
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.indices import calculate_before_after

router = APIRouter(prefix="/api/indices", tags=["Indices"])


class RasterStats(BaseModel):
    min: Optional[float] = Field(None, description="Minimum finite value across the raster")
    max: Optional[float] = Field(None, description="Maximum finite value across the raster")
    mean: Optional[float] = Field(None, description="Mean finite value across the raster")
    shape: List[int] = Field(..., description="Raster dimensions as [height, width]")


class IndexTemporalStats(BaseModel):
    before: RasterStats
    after: RasterStats
    change: RasterStats


class BeforeAfterIndicesResponse(BaseModel):
    ndvi: IndexTemporalStats
    ndwi: IndexTemporalStats


def _compute_stats(arr: np.ndarray) -> dict:
    """
    Computes min, max, mean, and shape safely by filtering non-finite (NaN/inf) values.
    """
    finite_mask = np.isfinite(arr)
    if not np.any(finite_mask):
        return {
            "min": None,
            "max": None,
            "mean": None,
            "shape": list(arr.shape),
        }

    valid_vals = arr[finite_mask]
    return {
        "min": float(np.min(valid_vals)),
        "max": float(np.max(valid_vals)),
        "mean": float(np.mean(valid_vals)),
        "shape": list(arr.shape),
    }


@router.get(
    "/before-after",
    response_model=BeforeAfterIndicesResponse,
    summary="Get summary statistics for before/after NDVI and NDWI indices",
    description=(
        "Computes Sentinel-2 multi-temporal NDVI and NDWI indices using B03, B04, and B08 10m bands. "
        "Returns summary statistics (min, max, mean, shape) for before, after, and change rasters."
    ),
)
def get_before_after_indices():
    """
    Execute before-and-after NDVI/NDWI calculation on Sentinel-2 data and return summary statistics.
    """
    try:
        results = calculate_before_after()
    except FileNotFoundError as fnf_err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Satellite dataset band files not found: {str(fnf_err)}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error computing satellite indices: {str(exc)}",
        )

    return {
        "ndvi": {
            "before": _compute_stats(results["ndvi_before"]),
            "after": _compute_stats(results["ndvi_after"]),
            "change": _compute_stats(results["ndvi_change"]),
        },
        "ndwi": {
            "before": _compute_stats(results["ndwi_before"]),
            "after": _compute_stats(results["ndwi_after"]),
            "change": _compute_stats(results["ndwi_change"]),
        },
    }

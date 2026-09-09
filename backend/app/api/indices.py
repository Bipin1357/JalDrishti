"""
API routes for Sentinel-2 satellite indices (NDVI, NDWI).
"""

from typing import List, Optional, Union
import numpy as np
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

try:
    from app.services.indices import calculate_before_after
    from app.services.dataset_sync import ensure_dataset_synced
except ImportError:
    from backend.app.services.indices import calculate_before_after
    from backend.app.services.dataset_sync import ensure_dataset_synced

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


def _compute_stats(arr: Union[np.ndarray, dict]) -> dict:
    """
    Computes min, max, mean, and shape safely by filtering non-finite (NaN/inf) values.
    If already a pre-computed dictionary from windowed processing, returns it directly.
    """
    if isinstance(arr, dict):
        return arr

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
        ensure_dataset_synced()
    except Exception as sync_err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Satellite dataset synchronization failed: {str(sync_err)}",
        )

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
            "before": _compute_stats(results["ndvi"]["before"]),
            "after": _compute_stats(results["ndvi"]["after"]),
            "change": _compute_stats(results["ndvi"]["change"]),
        },
        "ndwi": {
            "before": _compute_stats(results["ndwi"]["before"]),
            "after": _compute_stats(results["ndwi"]["after"]),
            "change": _compute_stats(results["ndwi"]["change"]),
        },
    }

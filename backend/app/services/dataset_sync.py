"""
Production Dataset Synchronization Service for JalDrishti.

Ensures the required Sentinel-2 10m JP2 band files (B03, B04, B08)
for both BEFORE (20250212) and AFTER (20250222) scenes exist locally.

In local development:
  If the files already exist on disk, no downloads are performed.

In production (e.g. Render):
  Downloads ~35 MB chunks from the private Supabase Storage bucket
  'satellite-data', verifies chunk sizes, reassembles them, validates
  SHA-256 integrity, and establishes the standard Sentinel-2 .SAFE
  directory structure expected by indices calculation.
"""

import hashlib
import json
import logging
import os
import shutil
import threading
import time
from pathlib import Path
from typing import Optional, Dict, Any, List

from dotenv import load_dotenv
from supabase import create_client, Client

# Configure logger
logger = logging.getLogger("jaldrishti.dataset_sync")

# Thread lock to protect concurrent requests in the same process
_sync_lock = threading.Lock()

# Target scenes and bands required by indices.py
REQUIRED_FILES = [
    {
        "period": "before",
        "scene_date": "20250212",
        "band": "B03",
        "filename": "T43RGM_20250212T052839_B03_10m.jp2",
        "expected_bytes": 124430172,
        "safe_rel_path": (
            "S2B_MSIL2A_20250212T052839_N0511_R105_T43RGM_20250212T073606.SAFE"
            "/GRANULE/L2A_T43RGM_A041458_20250212T053319/IMG_DATA/R10m"
            "/T43RGM_20250212T052839_B03_10m.jp2"
        ),
    },
    {
        "period": "before",
        "scene_date": "20250212",
        "band": "B04",
        "filename": "T43RGM_20250212T052839_B04_10m.jp2",
        "expected_bytes": 128261369,
        "safe_rel_path": (
            "S2B_MSIL2A_20250212T052839_N0511_R105_T43RGM_20250212T073606.SAFE"
            "/GRANULE/L2A_T43RGM_A041458_20250212T053319/IMG_DATA/R10m"
            "/T43RGM_20250212T052839_B04_10m.jp2"
        ),
    },
    {
        "period": "before",
        "scene_date": "20250212",
        "band": "B08",
        "filename": "T43RGM_20250212T052839_B08_10m.jp2",
        "expected_bytes": 135208218,
        "safe_rel_path": (
            "S2B_MSIL2A_20250212T052839_N0511_R105_T43RGM_20250212T073606.SAFE"
            "/GRANULE/L2A_T43RGM_A041458_20250212T053319/IMG_DATA/R10m"
            "/T43RGM_20250212T052839_B08_10m.jp2"
        ),
    },
    {
        "period": "after",
        "scene_date": "20250222",
        "band": "B03",
        "filename": "T43RGM_20250222T052739_B03_10m.jp2",
        "expected_bytes": 85398106,
        "safe_rel_path": (
            "S2B_MSIL2A_20250222T052739_N0511_R105_T43RGM_20250222T073727.SAFE"
            "/GRANULE/L2A_T43RGM_A041601_20250222T054100/IMG_DATA/R10m"
            "/T43RGM_20250222T052739_B03_10m.jp2"
        ),
    },
    {
        "period": "after",
        "scene_date": "20250222",
        "band": "B04",
        "filename": "T43RGM_20250222T052739_B04_10m.jp2",
        "expected_bytes": 87484294,
        "safe_rel_path": (
            "S2B_MSIL2A_20250222T052739_N0511_R105_T43RGM_20250222T073727.SAFE"
            "/GRANULE/L2A_T43RGM_A041601_20250222T054100/IMG_DATA/R10m"
            "/T43RGM_20250222T052739_B04_10m.jp2"
        ),
    },
    {
        "period": "after",
        "scene_date": "20250222",
        "band": "B08",
        "filename": "T43RGM_20250222T052739_B08_10m.jp2",
        "expected_bytes": 100735530,
        "safe_rel_path": (
            "S2B_MSIL2A_20250222T052739_N0511_R105_T43RGM_20250222T073727.SAFE"
            "/GRANULE/L2A_T43RGM_A041601_20250222T054100/IMG_DATA/R10m"
            "/T43RGM_20250222T052739_B08_10m.jp2"
        ),
    },
]

BUCKET_NAME = "satellite-data"


def get_default_data_dir() -> Path:
    """Return the data directory path."""
    custom_dir = os.getenv("DATA_DIR")
    if custom_dir:
        return Path(custom_dir).resolve()

    # Default to PROJECT_ROOT / data
    backend_dir = Path(__file__).resolve().parent.parent.parent
    project_root = backend_dir.parent
    return (project_root / "data").resolve()


def is_dataset_present(data_dir: Optional[Path] = None) -> bool:
    """
    Check whether all 6 required band JP2 files exist with non-zero size.
    """
    if data_dir is None:
        data_dir = get_default_data_dir()

    for item in REQUIRED_FILES:
        target_path = data_dir / item["period"] / item["safe_rel_path"]
        if not target_path.exists():
            # Check if it exists anywhere under data_dir / item['period'] matching the band and date
            matching = list((data_dir / item["period"]).rglob(f"*{item['filename']}"))
            if not matching or matching[0].stat().st_size == 0:
                return False
        elif target_path.stat().st_size == 0:
            return False

    return True


def _compute_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(4 * 1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def _get_supabase_client() -> Client:
    """Initialize Supabase client from environment variables."""
    # Ensure environment variables are loaded
    load_dotenv()
    backend_env = Path(__file__).resolve().parent.parent.parent / ".env"
    if backend_env.exists():
        load_dotenv(backend_env)

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        raise RuntimeError(
            "Supabase credentials (SUPABASE_URL, SUPABASE_KEY) are missing. "
            "Unable to synchronize satellite dataset."
        )

    return create_client(url, key)


def sync_satellite_dataset(data_dir: Optional[Path] = None) -> None:
    """
    Synchronize the Sentinel-2 dataset from Supabase Storage into data_dir.
    Thread-safe and process-safe with atomic replacements and cleanup.
    """
    if data_dir is None:
        data_dir = get_default_data_dir()

    data_dir = Path(data_dir).resolve()
    data_dir.mkdir(parents=True, exist_ok=True)

    # File lock for multi-process coordination (e.g. uvicorn workers)
    lock_file = data_dir / ".dataset_sync.lock"
    tmp_download_dir = data_dir / ".tmp_downloads"

    with _sync_lock:
        if is_dataset_present(data_dir):
            logger.info("Satellite dataset already present locally. Zero downloads required.")
            return

        logger.info(f"Satellite dataset missing or incomplete in {data_dir}. Initiating sync from Supabase Storage...")

        # Simple file lock wait
        lock_fd = None
        try:
            # Create or open lock file
            for _ in range(300):  # wait up to 5 minutes
                try:
                    lock_fd = os.open(str(lock_file), os.O_CREAT | os.O_EXCL | os.O_RDWR)
                    break
                except FileExistsError:
                    # Another process is syncing; wait and check if dataset became present
                    if is_dataset_present(data_dir):
                        logger.info("Dataset synchronization completed by concurrent process.")
                        return
                    time.sleep(1)
            else:
                raise TimeoutError("Timed out waiting for file lock during dataset synchronization.")

            # Double-check after lock acquisition
            if is_dataset_present(data_dir):
                logger.info("Dataset already present after acquiring lock.")
                return

            client = _get_supabase_client()

            # Clean and recreate temporary download directory
            if tmp_download_dir.exists():
                shutil.rmtree(tmp_download_dir, ignore_errors=True)
            tmp_download_dir.mkdir(parents=True, exist_ok=True)

            # 1. Download manifest.json
            logger.info(f"Downloading manifest.json from bucket '{BUCKET_NAME}'...")
            try:
                manifest_data = client.storage.from_(BUCKET_NAME).download("manifest.json")
                manifest = json.loads(manifest_data.decode("utf-8"))
            except Exception as exc:
                raise RuntimeError(
                    f"Failed to download manifest.json from Supabase Storage bucket '{BUCKET_NAME}': {exc}"
                ) from exc

            manifest_files = {f["remote_prefix"]: f for f in manifest.get("files", [])}

            # 2. Process each required file
            for req in REQUIRED_FILES:
                remote_prefix = f"{req['period']}/{req['scene_date']}/{req['band']}_10m.jp2"
                meta = manifest_files.get(remote_prefix)
                if not meta:
                    raise RuntimeError(f"Missing file metadata in manifest for {remote_prefix}")

                final_target = data_dir / req["period"] / req["safe_rel_path"]
                final_target.parent.mkdir(parents=True, exist_ok=True)

                if final_target.exists() and final_target.stat().st_size == meta["total_bytes"]:
                    logger.info(f"File {final_target.name} already fully assembled. Skipping.")
                    continue

                logger.info(f"Downloading {meta['num_chunks']} chunks for {req['filename']}...")
                tmp_reassembled = tmp_download_dir / f"{req['filename']}.tmp"

                with open(tmp_reassembled, "wb") as outfile:
                    for chunk_idx, chunk_name in enumerate(meta["chunks"]):
                        expected_chunk_size = meta["chunk_sizes"][chunk_idx]
                        logger.info(f"  Downloading chunk {chunk_name} ({expected_chunk_size / (1024*1024):.2f} MB)...")
                        
                        chunk_bytes = client.storage.from_(BUCKET_NAME).download(chunk_name)
                        if len(chunk_bytes) != expected_chunk_size:
                            raise ValueError(
                                f"Chunk size mismatch for {chunk_name}: "
                                f"expected {expected_chunk_size}, got {len(chunk_bytes)}"
                            )
                        outfile.write(chunk_bytes)

                # Verify assembled file size
                assembled_size = tmp_reassembled.stat().st_size
                if assembled_size != meta["total_bytes"]:
                    raise ValueError(
                        f"Reassembled file size mismatch for {req['filename']}: "
                        f"expected {meta['total_bytes']}, got {assembled_size}"
                    )

                # Verify SHA-256
                assembled_hash = _compute_sha256(tmp_reassembled)
                if assembled_hash != meta["sha256"]:
                    raise ValueError(
                        f"SHA-256 checksum mismatch for {req['filename']}: "
                        f"expected {meta['sha256']}, got {assembled_hash}"
                    )

                # Atomic move to final target location
                if final_target.exists():
                    final_target.unlink()
                shutil.move(str(tmp_reassembled), str(final_target))
                logger.info(f"Successfully assembled and verified {final_target.name}")

            logger.info("Satellite dataset synchronization completed successfully.")

        except Exception as err:
            logger.error(f"Error during satellite dataset synchronization: {err}")
            raise RuntimeError(f"Satellite dataset synchronization failed: {err}") from err

        finally:
            # Clean up temporary downloads
            if tmp_download_dir.exists():
                shutil.rmtree(tmp_download_dir, ignore_errors=True)
            # Release lock file
            if lock_fd is not None:
                try:
                    os.close(lock_fd)
                except Exception:
                    pass
                if lock_file.exists():
                    try:
                        lock_file.unlink()
                    except Exception:
                        pass


def ensure_dataset_synced(data_dir: Optional[Path] = None) -> None:
    """
    Ensure the satellite dataset is present.
    If not present, synchronizes it.
    """
    if is_dataset_present(data_dir):
        return
    sync_satellite_dataset(data_dir)

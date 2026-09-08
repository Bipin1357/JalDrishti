#!/usr/bin/env python3
"""
Upload the 6 required Sentinel-2 10m JP2 band files to Supabase Storage in ~35 MB chunks.

Bucket: satellite-data
Structure:
  manifest.json
  before/20250212/B03_10m.jp2.part0 ...
  before/20250212/B04_10m.jp2.part0 ...
  before/20250212/B08_10m.jp2.part0 ...
  after/20250222/B03_10m.jp2.part0 ...
  after/20250222/B04_10m.jp2.part0 ...
  after/20250222/B08_10m.jp2.part0 ...
"""

import hashlib
import json
import os
import sys
import time
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

CHUNK_SIZE = 35 * 1024 * 1024  # 35 MB
BUCKET_NAME = "satellite-data"

TARGET_FILES = [
    # BEFORE (20250212)
    {
        "period": "before",
        "date": "20250212",
        "band": "B03",
        "src_path": "data/before/S2B_MSIL2A_20250212T052839_N0511_R105_T43RGM_20250212T073606.SAFE/S2B_MSIL2A_20250212T052839_N0511_R105_T43RGM_20250212T073606.SAFE/GRANULE/L2A_T43RGM_A041458_20250212T053319/IMG_DATA/R10m/T43RGM_20250212T052839_B03_10m.jp2",
        "safe_rel_path": "S2B_MSIL2A_20250212T052839_N0511_R105_T43RGM_20250212T073606.SAFE/GRANULE/L2A_T43RGM_A041458_20250212T053319/IMG_DATA/R10m/T43RGM_20250212T052839_B03_10m.jp2",
        "remote_prefix": "before/20250212/B03_10m.jp2",
    },
    {
        "period": "before",
        "date": "20250212",
        "band": "B04",
        "src_path": "data/before/S2B_MSIL2A_20250212T052839_N0511_R105_T43RGM_20250212T073606.SAFE/S2B_MSIL2A_20250212T052839_N0511_R105_T43RGM_20250212T073606.SAFE/GRANULE/L2A_T43RGM_A041458_20250212T053319/IMG_DATA/R10m/T43RGM_20250212T052839_B04_10m.jp2",
        "safe_rel_path": "S2B_MSIL2A_20250212T052839_N0511_R105_T43RGM_20250212T073606.SAFE/GRANULE/L2A_T43RGM_A041458_20250212T053319/IMG_DATA/R10m/T43RGM_20250212T052839_B04_10m.jp2",
        "remote_prefix": "before/20250212/B04_10m.jp2",
    },
    {
        "period": "before",
        "date": "20250212",
        "band": "B08",
        "src_path": "data/before/S2B_MSIL2A_20250212T052839_N0511_R105_T43RGM_20250212T073606.SAFE/S2B_MSIL2A_20250212T052839_N0511_R105_T43RGM_20250212T073606.SAFE/GRANULE/L2A_T43RGM_A041458_20250212T053319/IMG_DATA/R10m/T43RGM_20250212T052839_B08_10m.jp2",
        "safe_rel_path": "S2B_MSIL2A_20250212T052839_N0511_R105_T43RGM_20250212T073606.SAFE/GRANULE/L2A_T43RGM_A041458_20250212T053319/IMG_DATA/R10m/T43RGM_20250212T052839_B08_10m.jp2",
        "remote_prefix": "before/20250212/B08_10m.jp2",
    },
    # AFTER (20250222)
    {
        "period": "after",
        "date": "20250222",
        "band": "B03",
        "src_path": "data/after/S2B_MSIL2A_20250222T052739_N0511_R105_T43RGM_20250222T073727.SAFE/GRANULE/L2A_T43RGM_A041601_20250222T054100/IMG_DATA/R10m/T43RGM_20250222T052739_B03_10m.jp2",
        "safe_rel_path": "S2B_MSIL2A_20250222T052739_N0511_R105_T43RGM_20250222T073727.SAFE/GRANULE/L2A_T43RGM_A041601_20250222T054100/IMG_DATA/R10m/T43RGM_20250222T052739_B03_10m.jp2",
        "remote_prefix": "after/20250222/B03_10m.jp2",
    },
    {
        "period": "after",
        "date": "20250222",
        "band": "B04",
        "src_path": "data/after/S2B_MSIL2A_20250222T052739_N0511_R105_T43RGM_20250222T073727.SAFE/GRANULE/L2A_T43RGM_A041601_20250222T054100/IMG_DATA/R10m/T43RGM_20250222T052739_B04_10m.jp2",
        "safe_rel_path": "S2B_MSIL2A_20250222T052739_N0511_R105_T43RGM_20250222T073727.SAFE/GRANULE/L2A_T43RGM_A041601_20250222T054100/IMG_DATA/R10m/T43RGM_20250222T052739_B04_10m.jp2",
        "remote_prefix": "after/20250222/B04_10m.jp2",
    },
    {
        "period": "after",
        "date": "20250222",
        "band": "B08",
        "src_path": "data/after/S2B_MSIL2A_20250222T052739_N0511_R105_T43RGM_20250222T073727.SAFE/GRANULE/L2A_T43RGM_A041601_20250222T054100/IMG_DATA/R10m/T43RGM_20250222T052739_B08_10m.jp2",
        "safe_rel_path": "S2B_MSIL2A_20250222T052739_N0511_R105_T43RGM_20250222T073727.SAFE/GRANULE/L2A_T43RGM_A041601_20250222T054100/IMG_DATA/R10m/T43RGM_20250222T052739_B08_10m.jp2",
        "remote_prefix": "after/20250222/B08_10m.jp2",
    },
]


def compute_sha256(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(4 * 1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def upload_chunk_with_retry(client: Client, bucket: str, path: str, data: bytes, max_retries: int = 3):
    for attempt in range(1, max_retries + 1):
        try:
            # Check if file exists in bucket first
            # Attempt upload (or update if already exists)
            # Supabase storage upload with file_options
            file_options = {"content-type": "application/octet-stream", "upsert": "true"}
            res = client.storage.from_(bucket).upload(
                path=path,
                file=data,
                file_options=file_options,
            )
            return res
        except Exception as e:
            if attempt == max_retries:
                raise e
            print(f"      [Retry {attempt}/{max_retries}] Upload failed ({e}). Retrying in 2s...")
            time.sleep(2)


def main():
    # Load backend env
    project_root = Path(__file__).resolve().parent.parent.parent
    backend_env = project_root / "backend" / ".env"
    load_dotenv(backend_env)
    load_dotenv(project_root / ".env")

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in backend/.env")
        sys.exit(1)

    print(f"Connecting to Supabase Storage at {url}...")
    client = create_client(url, key)

    # Ensure bucket exists
    existing_buckets = [b.name for b in client.storage.list_buckets()]
    if BUCKET_NAME not in existing_buckets:
        print(f"Creating bucket '{BUCKET_NAME}'...")
        client.storage.create_bucket(BUCKET_NAME, options={"public": False})

    manifest = {
        "version": "1.0",
        "bucket": BUCKET_NAME,
        "chunk_size_bytes": CHUNK_SIZE,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "files": [],
    }

    total_uploaded_bytes = 0
    total_chunks_uploaded = 0

    print(f"\nProcessing {len(TARGET_FILES)} target Sentinel-2 JP2 files...")

    for idx, item in enumerate(TARGET_FILES, 1):
        src_path = project_root / item["src_path"]
        if not src_path.exists():
            print(f"ERROR: Source file not found: {src_path}")
            sys.exit(1)

        file_size = src_path.stat().st_size
        print(f"\n[{idx}/{len(TARGET_FILES)}] {item['period'].upper()} {item['date']} {item['band']}")
        print(f"  Source: {src_path.name}")
        print(f"  Size: {file_size:,} bytes ({file_size / (1024*1024):.2f} MB)")
        
        print("  Computing SHA-256 checksum...")
        sha256_hash = compute_sha256(src_path)
        print(f"  SHA-256: {sha256_hash}")

        # Split into chunks
        chunks = []
        chunk_sizes = []
        with open(src_path, "rb") as f:
            chunk_idx = 0
            while True:
                chunk_data = f.read(CHUNK_SIZE)
                if not chunk_data:
                    break
                chunk_name = f"{item['remote_prefix']}.part{chunk_idx}"
                chunk_size = len(chunk_data)
                chunk_sizes.append(chunk_size)
                
                print(f"    Uploading chunk {chunk_idx}: {chunk_name} ({chunk_size / (1024*1024):.2f} MB)...", end="", flush=True)
                t0 = time.time()
                upload_chunk_with_retry(client, BUCKET_NAME, chunk_name, chunk_data)
                elapsed = time.time() - t0
                print(f" Done ({elapsed:.1f}s)")
                
                chunks.append(chunk_name)
                total_uploaded_bytes += chunk_size
                total_chunks_uploaded += 1
                chunk_idx += 1

        manifest["files"].append({
            "period": item["period"],
            "scene_date": item["date"],
            "band": item["band"],
            "filename": src_path.name,
            "safe_rel_path": item["safe_rel_path"],
            "total_bytes": file_size,
            "sha256": sha256_hash,
            "remote_prefix": item["remote_prefix"],
            "num_chunks": len(chunks),
            "chunks": chunks,
            "chunk_sizes": chunk_sizes,
        })

    # Upload manifest.json
    print("\nUploading manifest.json...")
    manifest_bytes = json.dumps(manifest, indent=2).encode("utf-8")
    upload_chunk_with_retry(client, BUCKET_NAME, "manifest.json", manifest_bytes)
    print("Manifest uploaded successfully!")

    print("\n==========================================")
    print("UPLOAD SUMMARY")
    print("==========================================")
    print(f"Total files uploaded:    {len(TARGET_FILES)}")
    print(f"Total chunks created:    {total_chunks_uploaded}")
    print(f"Total storage used:      {total_uploaded_bytes:,} bytes ({total_uploaded_bytes / (1024*1024):.2f} MB)")
    print("Bucket:                  " + BUCKET_NAME)
    print("==========================================")


if __name__ == "__main__":
    main()

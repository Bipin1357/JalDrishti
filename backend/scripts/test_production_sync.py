"""
Verification script for simulated production dataset synchronization.
Tests downloading, reassembling, checksum verification, band location,
and before/after calculation in an isolated directory.
"""

import shutil
import sys
import time
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.dataset_sync import sync_satellite_dataset, is_dataset_present
from app.services.indices import locate_band_files, calculate_before_after

def main():
    test_dir = Path(__file__).resolve().parent.parent.parent / "data" / "simulated_render_data"
    
    # Ensure clean slate
    if test_dir.exists():
        shutil.rmtree(test_dir, ignore_errors=True)
    test_dir.mkdir(parents=True, exist_ok=True)

    print(f"1. Testing initial state in {test_dir}...")
    assert not is_dataset_present(test_dir), "Dataset should not be present initially"
    print("   [OK] Verified dataset is absent initially.")

    print("\n2. Initiating production-style dataset synchronization from Supabase Storage...")
    t0 = time.time()
    sync_satellite_dataset(data_dir=test_dir)
    print(f"   [OK] Sync completed in {time.time() - t0:.1f}s.")

    print("\n3. Verifying dataset presence check...")
    assert is_dataset_present(test_dir), "Dataset should now be detected as present"
    print("   [OK] Verified is_dataset_present() returns True.")

    print("\n4. Verifying locate_band_files()...")
    before_bands = locate_band_files(test_dir / "before", "20250212")
    print(f"   [OK] Located BEFORE bands: {[b for b in before_bands]}")
    assert set(before_bands.keys()) == {"B03", "B04", "B08"}

    after_bands = locate_band_files(test_dir / "after", "20250222")
    print(f"   [OK] Located AFTER bands: {[b for b in after_bands]}")
    assert set(after_bands.keys()) == {"B03", "B04", "B08"}

    print("\n5. Testing calculate_before_after() using synced files...")
    t_calc = time.time()
    results = calculate_before_after(
        before_dir=test_dir / "before",
        after_dir=test_dir / "after",
        before_date="20250212",
        after_date="20250222",
    )
    print(f"   [OK] Calculation succeeded in {time.time() - t_calc:.1f}s!")
    print(f"     NDVI Before Mean: {float(results['ndvi_before'].mean()):.4f}")
    print(f"     NDVI After Mean:  {float(results['ndvi_after'].mean()):.4f}")
    print(f"     NDVI Change Mean: {float(results['ndvi_change'].mean()):.4f}")

    print("\n6. Cleaning up simulated directory...")
    shutil.rmtree(test_dir, ignore_errors=True)
    print("   [OK] Cleanup complete.")

    print("\n==========================================")
    print("ALL PRODUCTION SIMULATION TESTS PASSED!")
    print("==========================================")


if __name__ == "__main__":
    main()

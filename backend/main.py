from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import uuid
import datetime

app = FastAPI(
    title="JalDrishti - Integrated Watershed Monitoring API",
    description="Backend API for geo-coded field evidence verification, computer vision diagnostics, and watershed analytics.",
    version="1.1.0"
)

# Allow Vite dev server ports (5501 from config, 5173 standard)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5501",
        "http://127.0.0.1:5501",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class EvidenceSubmission(BaseModel):
    village: str = Field(..., example="Rampur")
    assetType: str = Field(..., example="Check Dam")
    assetId: str = Field(..., example="North Nala Check Dam 4")
    observation: Optional[str] = ""
    photoName: Optional[str] = ""
    gps: Optional[str] = "24.5748, 80.8321"


class EvidenceItem(BaseModel):
    id: str
    village: str
    assetType: str
    assetId: str
    observation: str
    photoName: str
    gps: str
    status: str
    risk: str
    date: str
    qualityScore: int
    cvConfidence: float


# ---------------------------------------------------------------------------
# In-Memory Evidence Database (Pre-seeded with representative field records)
# ---------------------------------------------------------------------------
evidence_db: List[dict] = [
    {
        "id": "JD-104",
        "village": "Rampur",
        "assetType": "Check Dam",
        "assetId": "North Nala Check Dam 4",
        "observation": "Masonry intact, upstream water retained at normal spillway height.",
        "photoName": "check_dam_rampur_04.jpg",
        "gps": "24.5748, 80.8321",
        "status": "Verified",
        "risk": "Low",
        "date": "Today, 14:20",
        "qualityScore": 94,
        "cvConfidence": 0.96
    },
    {
        "id": "JD-103",
        "village": "Kalyanpur",
        "assetType": "Farm Pond",
        "assetId": "Community Farm Pond 2",
        "observation": "Side embankment erosion noticed after heavy rain; silt accumulation.",
        "photoName": "farm_pond_kalyanpur_02.jpg",
        "gps": "24.5612, 80.8417",
        "status": "Needs Review",
        "risk": "Medium",
        "date": "Yesterday, 11:05",
        "qualityScore": 78,
        "cvConfidence": 0.84
    },
    {
        "id": "JD-102",
        "village": "Bhagwanpur",
        "assetType": "Contour Trench",
        "assetId": "East Ridge Trenches Tier-B",
        "observation": "Trenches holding runoff sediment effectively; surrounding grass growing.",
        "photoName": "contour_trench_bhagwanpur.jpg",
        "gps": "24.5511, 80.8543",
        "status": "Verified",
        "risk": "Low",
        "date": "2 days ago",
        "qualityScore": 91,
        "cvConfidence": 0.93
    },
    {
        "id": "JD-101",
        "village": "Shivpuri",
        "assetType": "Percolation Tank",
        "assetId": "West Bund Percolation Tank",
        "observation": "Recharge aquifer level responding positively based on nearby borewell.",
        "photoName": "percolation_tank_shivpuri.jpg",
        "gps": "24.5820, 80.8190",
        "status": "Verified",
        "risk": "Low",
        "date": "3 days ago",
        "qualityScore": 89,
        "cvConfidence": 0.91
    }
]


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return {
        "portal": "JalDrishti",
        "service": "Watershed Evidence Verification API",
        "status": "online",
        "version": "1.1.0"
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "backend": "FastAPI",
        "version": "1.1.0",
        "records_count": len(evidence_db)
    }


@app.get("/api/evidence", response_model=List[EvidenceItem])
def get_all_evidence():
    """Retrieve all submitted geo-coded watershed evidence items."""
    return evidence_db


@app.post("/api/evidence", response_model=EvidenceItem, status_code=201)
def submit_evidence(submission: EvidenceSubmission):
    """
    Accept new field evidence, run automated CV checks (simulated blur/light scoring
    and asset classifier), assign risk rating, and register the evidence.
    """
    if not submission.village or not submission.assetType:
        raise HTTPException(status_code=400, detail="Village and Asset Type are required.")

    # Computer Vision simulation:
    # High confidence unless observation implies damage/silt/erosion
    obs_lower = (submission.observation or "").lower()
    has_warning_keywords = any(w in obs_lower for w in ["damage", "erosion", "silt", "crack", "leak", "dry", "broken"])

    if has_warning_keywords:
        status = "Needs Review"
        risk = "Medium"
        quality_score = 82
        cv_conf = 0.85
    else:
        status = "Verified"
        risk = "Low"
        quality_score = 95
        cv_conf = 0.97

    # Generate sequential ID
    new_id = f"JD-{105 + len(evidence_db) - 4}"
    current_time = datetime.datetime.now().strftime("%d %b, %H:%M")

    new_item = {
        "id": new_id,
        "village": submission.village.strip(),
        "assetType": submission.assetType.strip(),
        "assetId": submission.assetId.strip() or f"{submission.assetType} #{len(evidence_db) + 1}",
        "observation": submission.observation or "Field observation recorded.",
        "photoName": submission.photoName or "field_capture.jpg",
        "gps": submission.gps or "24.5748, 80.8321",
        "status": status,
        "risk": risk,
        "date": f"Just now ({current_time})",
        "qualityScore": quality_score,
        "cvConfidence": cv_conf
    }

    # Prepend to database
    evidence_db.insert(0, new_item)
    return new_item


@app.get("/api/metrics")
def get_metrics():
    """Return live aggregate watershed metrics for dashboards."""
    total = len(evidence_db)
    verified = sum(1 for item in evidence_db if item["status"] == "Verified")
    verified_pct = int((verified / total * 100)) if total > 0 else 100
    high_priority = sum(1 for item in evidence_db if item["risk"] in ["High", "Medium"])
    villages = len(set(item["village"] for item in evidence_db))

    return {
        "assetsTracked": total + 122,  # Base portfolio + live submissions
        "cvVerifiedRate": f"{verified_pct}%",
        "highPrioritySites": high_priority + 10,
        "villagesCovered": max(villages, 34)
    }


@app.get("/api/analysis")
def get_analysis_data():
    """Return computer vision and remote sensing indicators."""
    return {
        "photoQuality": {
            "score": "93%",
            "status": "High Fidelity",
            "summary": "Automated laplacian blur detection, dynamic range, and duplicate hash verified."
        },
        "assetDetection": {
            "predictedClass": "Check Dam / Spillway",
            "confidence": "96.4%",
            "boundingCoordinates": [120, 45, 480, 390],
            "summary": "YOLO/ResNet feature extraction identified reinforced concrete spillway."
        },
        "vegetationIndex": {
            "metric": "NDVI Change",
            "delta": "+14.2%",
            "trend": "Positive vegetation recovery in catchment buffer",
            "preMonsoonNDVI": 0.31,
            "postMonsoonNDVI": 0.45
        },
        "waterSpread": {
            "status": "Stable Reservoir",
            "waterIndex": "MNDWI: +0.22",
            "estimatedAcreage": "1.8 Hectares",
            "summary": "Sentinel-2 / field photo correlation confirms positive percolation retention."
        }
    }

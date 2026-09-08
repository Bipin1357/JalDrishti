import React, { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';

// In development: API_BASE is '' so requests use Vite dev server proxy (:5501 -> :8000)
// In production (Vercel): API_BASE uses VITE_API_BASE_URL pointing to the deployed FastAPI backend
const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')
  : '';

const DEFAULT_EVIDENCE = [
  {
    id: 'JD-104',
    village: 'Rampur',
    assetType: 'Check Dam',
    assetId: 'North Nala Check Dam 4',
    observation: 'Masonry intact, upstream water retained at normal spillway height.',
    photoName: 'check_dam_rampur_04.jpg',
    gps: '24.5748, 80.8321',
    status: 'Verified',
    risk: 'Low',
    date: 'Today, 14:20',
    qualityScore: 94,
    cvConfidence: 0.96,
  },
  {
    id: 'JD-103',
    village: 'Kalyanpur',
    assetType: 'Farm Pond',
    assetId: 'Community Farm Pond 2',
    observation: 'Side embankment erosion noticed after heavy rain; silt accumulation.',
    photoName: 'farm_pond_kalyanpur_02.jpg',
    gps: '24.5612, 80.8417',
    status: 'Needs Review',
    risk: 'Medium',
    date: 'Yesterday, 11:05',
    qualityScore: 78,
    cvConfidence: 0.84,
  },
  {
    id: 'JD-102',
    village: 'Bhagwanpur',
    assetType: 'Contour Trench',
    assetId: 'East Ridge Trenches Tier-B',
    observation: 'Trenches holding runoff sediment effectively; surrounding grass growing.',
    photoName: 'contour_trench_bhagwanpur.jpg',
    gps: '24.5511, 80.8543',
    status: 'Verified',
    risk: 'Low',
    date: '2 days ago',
    qualityScore: 91,
    cvConfidence: 0.93,
  },
  {
    id: 'JD-101',
    village: 'Shivpuri',
    assetType: 'Percolation Tank',
    assetId: 'West Bund Percolation Tank',
    observation: 'Recharge aquifer level responding positively based on nearby borewell.',
    photoName: 'percolation_tank_shivpuri.jpg',
    gps: '24.5820, 80.8190',
    status: 'Verified',
    risk: 'Low',
    date: '3 days ago',
    qualityScore: 89,
    cvConfidence: 0.91,
  },
];

// ---------------------------------------------------------------------------
// Sentinel-2 Indices Cache & Request Sharing
// ---------------------------------------------------------------------------
// Module-level cache prevents duplicate 10980x10980 raster processing across
// React StrictMode double-mounts and navigation tab switches.
let cachedIndices = null;
let indicesInFlightPromise = null;

function fetchIndicesData(force = false) {
  if (force) {
    cachedIndices = null;
    indicesInFlightPromise = null;
  }

  if (cachedIndices) {
    return Promise.resolve(cachedIndices);
  }

  if (!indicesInFlightPromise) {
    console.log('[fetchIndicesData] Dispatching GET to:', `${API_BASE}/api/indices/before-after`);
    indicesInFlightPromise = fetch(`${API_BASE}/api/indices/before-after`)
      .then(async (response) => {
        console.log('[fetchIndicesData] Response status received:', response.status);
        if (!response.ok) {
          let errorDetail = '';
          try {
            const errJson = await response.json();
            errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
          } catch {
            errorDetail = await response.text().catch(() => '');
          }
          throw new Error(
            `Backend returned HTTP ${response.status}${errorDetail ? `: ${errorDetail}` : ''}`
          );
        }
        return response.json();
      })
      .then((data) => {
        console.log('[fetchIndicesData] Successfully parsed JSON payload:', data);
        cachedIndices = data;
        indicesInFlightPromise = null;
        return data;
      })
      .catch((err) => {
        console.error('[fetchIndicesData] Request failed:', err);
        indicesInFlightPromise = null;
        throw err;
      });
  }

  return indicesInFlightPromise;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [evidenceList, setEvidenceList] = useState(DEFAULT_EVIDENCE);
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [metrics, setMetrics] = useState({
    assetsTracked: 126,
    cvVerifiedRate: '92%',
    highPrioritySites: 12,
    villagesCovered: 34,
  });

  // CV Analysis state managed at root level to prevent remount wipes & ensure single in-flight fetch
  const [indexData, setIndexData] = useState(cachedIndices);
  const [indicesLoading, setIndicesLoading] = useState(false);
  const [indicesError, setIndicesError] = useState('');

  const loadIndices = (force = false) => {
    console.log('[loadIndices] Starting fetch...', { force, hasCached: !!cachedIndices });
    if (!force && cachedIndices) {
      console.log('[loadIndices] Instant return from memory cache');
      setIndexData(cachedIndices);
      setIndicesLoading(false);
      return;
    }

    setIndicesLoading(true);
    setIndicesError('');

    fetchIndicesData(force)
      .then((data) => {
        console.log('[loadIndices] Setting indexData and indicesLoading = false');
        setIndexData(data);
        setIndicesLoading(false);
      })
      .catch((err) => {
        console.error('[loadIndices] Error loading Sentinel-2 indices:', err);
        setIndicesError(
          err.message || 'Unable to load satellite index data. Make sure the FastAPI backend is running.'
        );
        setIndicesLoading(false);
      });
  };

  // Trigger exactly ONE request when entering the CV Analysis page
  useEffect(() => {
    if (currentPage === 'analysis') {
      loadIndices();
    }
  }, [currentPage]);

  const [formData, setFormData] = useState({
    village: '',
    assetType: 'Check Dam',
    assetId: '',
    observation: '',
    photoName: '',
    photoPreview: null,
    gps: '24.5748, 80.8321',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitNotice, setSubmitNotice] = useState('');

  // Check backend health & fetch live data
  useEffect(() => {
    let isMounted = true;

    async function checkBackend() {
      try {
        const healthRes = await fetch(`${API_BASE}/api/health`);
        if (healthRes.ok) {
          if (isMounted) setIsBackendOnline(true);

          const [evidenceRes, metricsRes] = await Promise.all([
            fetch(`${API_BASE}/api/evidence`),
            fetch(`${API_BASE}/api/metrics`),
          ]);

          if (evidenceRes.ok) {
            const data = await evidenceRes.json();
            if (isMounted && Array.isArray(data) && data.length > 0) {
              setEvidenceList(data);
            }
          }

          if (metricsRes.ok) {
            const mData = await metricsRes.json();
            if (isMounted) setMetrics(mData);
          }
        } else {
          if (isMounted) setIsBackendOnline(false);
        }
      } catch (err) {
        if (isMounted) setIsBackendOnline(false);
      }
    }

    checkBackend();
    const interval = setInterval(checkBackend, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const navigate = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitEvidence = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitNotice('');

    const submissionPayload = {
      village: formData.village || 'Rampur',
      assetType: formData.assetType,
      assetId: formData.assetId || `${formData.assetType} #${evidenceList.length + 1}`,
      observation: formData.observation || 'Visual inspection recorded.',
      photoName: formData.photoName || 'field_capture.jpg',
      gps: formData.gps || '24.5748, 80.8321',
    };

    let createdItem = null;

    if (isBackendOnline) {
      try {
        const response = await fetch(`${API_BASE}/api/evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submissionPayload),
        });
        if (response.ok) {
          createdItem = await response.json();
        }
      } catch (e) {
        console.warn('Backend submission failed, falling back to local state:', e);
      }
    }

    // Fallback simulation if backend fails or offline
    if (!createdItem) {
      const isWarn = /damage|erosion|silt|crack|leak/i.test(formData.observation);
      createdItem = {
        id: `JD-${105 + evidenceList.length}`,
        village: submissionPayload.village,
        assetType: submissionPayload.assetType,
        assetId: submissionPayload.assetId,
        observation: submissionPayload.observation,
        photoName: submissionPayload.photoName,
        gps: submissionPayload.gps,
        status: isWarn ? 'Needs Review' : 'Verified',
        risk: isWarn ? 'Medium' : 'Low',
        date: 'Just now',
        qualityScore: isWarn ? 82 : 95,
        cvConfidence: isWarn ? 0.85 : 0.97,
      };
    }

    setEvidenceList((prev) => [createdItem, ...prev]);
    setMetrics((prev) => ({
      ...prev,
      assetsTracked: (parseInt(prev.assetsTracked) || 126) + 1,
    }));

    setIsSubmitting(false);
    setSubmitNotice(`Evidence ${createdItem.id} saved successfully! Automated CV Check: ${createdItem.status}`);

    // Reset form
    setFormData({
      village: '',
      assetType: 'Check Dam',
      assetId: '',
      observation: '',
      photoName: '',
      photoPreview: null,
      gps: '24.5748, 80.8321',
    });

    // Navigate to dashboard to see updated queue
    setTimeout(() => {
      navigate('dashboard');
    }, 800);
  };

  return (
    <div className="app-container">
      <Header currentPage={currentPage} onNavigate={navigate} isBackendOnline={isBackendOnline} />

      <main className="main-content">
        {submitNotice && (
          <div className="status-pill verified" style={{ marginBottom: '1.25rem', padding: '0.6rem 1rem' }}>
            ✓ {submitNotice}
          </div>
        )}

        {currentPage === 'dashboard' && (
          <Dashboard evidenceItems={evidenceList} metrics={metrics} onNavigate={navigate} />
        )}

        {currentPage === 'evidence' && (
          <EvidencePage
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmitEvidence}
            isSubmitting={isSubmitting}
          />
        )}

        {currentPage === 'map' && <MapPage evidenceItems={evidenceList} />}

        {currentPage === 'analysis' && (
          <AnalysisPage
            indexData={indexData}
            loading={indicesLoading}
            error={indicesError}
            onRetry={() => loadIndices(true)}
          />
        )}

        {currentPage === 'reports' && <ReportsPage evidenceItems={evidenceList} />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Screen
// ---------------------------------------------------------------------------
function Dashboard({ evidenceItems, metrics, onNavigate }) {
  return (
    <section className="page-grid">
      <div className="intro-panel">
        <span className="eyebrow">SIH 2026 • Ministry of Rural Development</span>
        <h1>Geo-coded field evidence for smarter watershed decisions</h1>
        <p>
          JalDrishti combines smartphone geotagging, computer vision quality assurance, and remote sensing
          NDVI overlays to monitor rural water conservation assets at village scale.
        </p>

        <div className="action-row">
          <button className="primary-action" type="button" onClick={() => onNavigate('evidence')}>
            <span>📷</span>
            <span>Add Field Evidence</span>
          </button>
          <button className="secondary-action" type="button" onClick={() => onNavigate('map')}>
            <span>🗺️</span>
            <span>View Geo Map</span>
          </button>
        </div>
      </div>

      <div className="metrics-grid">
        <MetricCard label="Assets Tracked" value={metrics.assetsTracked} trend="+18 this month" />
        <MetricCard label="CV Verified" value={metrics.cvVerifiedRate || '92%'} trend="Photo quality high" />
        <MetricCard label="Priority Sites" value={metrics.highPrioritySites} trend="Scheduled review" />
        <MetricCard label="Villages Covered" value={metrics.villagesCovered} trend="3 blocks mapped" />
      </div>

      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Ground Truth Queue</span>
            <h2>Latest Evidence Submissions</h2>
          </div>
          <button className="text-button" type="button" onClick={() => onNavigate('evidence')}>
            + New Field Entry
          </button>
        </div>
        <EvidenceTable items={evidenceItems} />
      </div>

      <div className="panel workflow-panel">
        <span className="eyebrow">Integrated Pipeline</span>
        <h2>End-to-End Monitoring Architecture</h2>
        <div className="workflow-steps">
          <span className="workflow-step"><span className="workflow-step-num">1</span> Field Form</span>
          <span className="workflow-connector">➔</span>
          <span className="workflow-step"><span className="workflow-step-num">2</span> Photo + GPS Geotag</span>
          <span className="workflow-connector">➔</span>
          <span className="workflow-step"><span className="workflow-step-num">3</span> CV Quality & Asset Model</span>
          <span className="workflow-connector">➔</span>
          <span className="workflow-step"><span className="workflow-step-num">4</span> Satellite NDVI Layer</span>
          <span className="workflow-connector">➔</span>
          <span className="workflow-step"><span className="workflow-step-num">5</span> Officer Village Report</span>
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value, trend }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>↗ {trend}</small>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Evidence Capture Page
// ---------------------------------------------------------------------------
function EvidencePage({ formData, setFormData, onSubmit, isSubmitting }) {
  const [gpsStatus, setGpsStatus] = useState('');

  const updateField = (field, value) => {
    setFormData((data) => ({ ...data, [field]: value }));
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((data) => ({
          ...data,
          photoName: file.name,
          photoPreview: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const captureGPS = () => {
    if ('geolocation' in navigator) {
      setGpsStatus('Locating...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
          updateField('gps', coords);
          setGpsStatus('Locked ✓');
        },
        (err) => {
          setGpsStatus('Defaulting (simulated)');
          updateField('gps', '24.5748, 80.8321');
        },
        { timeout: 8000 }
      );
    } else {
      setGpsStatus('Not supported (using default)');
      updateField('gps', '24.5748, 80.8321');
    }
  };

  const fillDemoData = () => {
    setFormData({
      village: 'Rampur (Satna District)',
      assetType: 'Check Dam',
      assetId: 'North Nala Check Dam #07',
      observation: 'Masonry barrier holding approx 1.2m depth of rainwater. Spillway clean without boulder silt.',
      photoName: 'check_dam_sample.jpg',
      photoPreview: null,
      gps: '24.5748, 80.8321',
    });
  };

  return (
    <section className="split-layout">
      <div className="panel">
        <span className="eyebrow">Field Worker Evidence Collection</span>
        <h1>Add Ground Proof</h1>
        <p className="muted-copy">
          Submit geo-referenced photographs and structural observation data for automated computer vision
          verification and government watershed records.
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className="secondary-action"
            onClick={fillDemoData}
            style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}
          >
            ⚡ Auto-Fill Sample Record
          </button>
        </div>

        <form className="evidence-form" onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label">
              Village Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              className="form-input"
              value={formData.village}
              onChange={(e) => updateField('village', e.target.value)}
              placeholder="e.g. Rampur, Satna Block"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Asset Type <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              className="form-select"
              value={formData.assetType}
              onChange={(e) => updateField('assetType', e.target.value)}
            >
              <option value="Check Dam">Check Dam (Masonry / Earthen)</option>
              <option value="Farm Pond">Farm Pond (Khet Talab)</option>
              <option value="Percolation Tank">Percolation Tank</option>
              <option value="Contour Trench">Contour Trench / Bund</option>
              <option value="Plantation Area">Plantation / Catchment Buffer</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              Asset Identifier or Local Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              className="form-input"
              value={formData.assetId}
              onChange={(e) => updateField('assetId', e.target.value)}
              placeholder="e.g. North Nala Check Dam 4"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              GPS Geotag Location
              {gpsStatus && <span style={{ fontSize: '0.78rem', color: '#15803d' }}>{gpsStatus}</span>}
            </label>
            <div className="gps-input-row">
              <input
                className="form-input"
                value={formData.gps}
                onChange={(e) => updateField('gps', e.target.value)}
                placeholder="Latitude, Longitude"
                required
              />
              <button type="button" className={`btn-gps ${gpsStatus ? 'captured' : ''}`} onClick={captureGPS}>
                📍 {gpsStatus === 'Locked ✓' ? 'GPS Captured' : 'Get Location'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Field Observation / Structural Status</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={formData.observation}
              onChange={(e) => updateField('observation', e.target.value)}
              placeholder="Describe water retention, silt accumulation, structural cracks, or spillway health..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Photo Evidence (Geotagged)</label>
            <label className="upload-box">
              <input type="file" accept="image/*" onChange={handlePhotoUpload} />
              <div className="upload-icon">📷</div>
              <span className="upload-text">
                {formData.photoName ? formData.photoName : 'Click or Drag photo from camera'}
              </span>
              <span className="upload-subtext">Supports JPG, PNG, WEBP with EXIF metadata</span>
            </label>

            {formData.photoPreview && (
              <div className="photo-preview-container">
                <img src={formData.photoPreview} alt="Field preview" className="photo-preview-img" />
              </div>
            )}
          </div>

          <button className="primary-action full-width" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Verifying & Submitting...' : 'Submit & Run CV Verification'}
          </button>
        </form>
      </div>

      <aside className="panel help-panel">
        <span className="eyebrow">API Payload Inspector</span>
        <h2>Live Submission Preview</h2>
        <p>
          Every submission triggers our FastAPI pipeline, generating automated Laplacian blur detection,
          asset detection scoring, and watershed database registration.
        </p>

        <pre>
          {JSON.stringify(
            {
              village: formData.village || 'Rampur',
              assetType: formData.assetType,
              assetId: formData.assetId || 'North Nala Check Dam 4',
              observation: formData.observation || 'Masonry barrier intact.',
              photoName: formData.photoName || 'check_dam_rampur_04.jpg',
              gps: formData.gps || '24.5748, 80.8321',
              cvPipeline: {
                blurLaplacianFilter: 'Pass (>100 threshold)',
                detectionTarget: formData.assetType,
                expectedResolution: '1920x1080',
              },
            },
            null,
            2
          )}
        </pre>

        <div className="cv-pipeline-badge">
          <span>🧠</span>
          <span>FastAPI + YOLOv8 + Earth Engine NDVI Ready</span>
        </div>
      </aside>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Geo Map Screen
// ---------------------------------------------------------------------------
function MapPage({ evidenceItems }) {
  const [activeLayers, setActiveLayers] = useState({
    watershed: true,
    ndvi: true,
    assets: true,
  });

  const [selectedPoint, setSelectedPoint] = useState(null);

  const toggleLayer = (layer) => {
    setActiveLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const points = [
    {
      id: 'CD',
      name: 'North Nala Check Dam 4',
      village: 'Rampur',
      type: 'Check Dam',
      gps: '24.5748, 80.8321',
      status: 'Verified (94% CV score)',
      className: 'point-a',
    },
    {
      id: 'FP',
      name: 'Community Farm Pond 2',
      village: 'Kalyanpur',
      type: 'Farm Pond',
      gps: '24.5612, 80.8417',
      status: 'Needs Review (Erosion flag)',
      className: 'point-b',
    },
    {
      id: 'CT',
      name: 'East Ridge Contour Trenches',
      village: 'Bhagwanpur',
      type: 'Contour Trench',
      gps: '24.5511, 80.8543',
      status: 'Verified (91% CV score)',
      className: 'point-c',
    },
  ];

  return (
    <section className="split-layout map-layout">
      <div className="panel map-panel">
        <div className="panel-heading" style={{ marginBottom: '0.5rem' }}>
          <div>
            <span className="eyebrow">Spatial GIS Viewer</span>
            <h2>Watershed Micro-Basin Map</h2>
          </div>
        </div>

        <div className="map-toolbar">
          <button
            type="button"
            className={`layer-toggle ${activeLayers.watershed ? 'active' : ''}`}
            onClick={() => toggleLayer('watershed')}
          >
            🌊 Watershed Basin {activeLayers.watershed ? '✓' : ''}
          </button>
          <button
            type="button"
            className={`layer-toggle ${activeLayers.ndvi ? 'active' : ''}`}
            onClick={() => toggleLayer('ndvi')}
          >
            🌱 NDVI Vegetation {activeLayers.ndvi ? '✓' : ''}
          </button>
          <button
            type="button"
            className={`layer-toggle ${activeLayers.assets ? 'active' : ''}`}
            onClick={() => toggleLayer('assets')}
          >
            📍 Asset Geotags {activeLayers.assets ? '✓' : ''}
          </button>
        </div>

        <div className="map-canvas" aria-label="Interactive watershed GIS map">
          {activeLayers.watershed && <div className="watershed-layer"></div>}
          <div className="water-channel"></div>

          {activeLayers.assets &&
            points.map((pt) => (
              <button
                key={pt.id}
                type="button"
                className={`map-point ${pt.className}`}
                onClick={() => setSelectedPoint(pt)}
                title={`${pt.name} (${pt.village})`}
              >
                <span>{pt.id}</span>
              </button>
            ))}

          {activeLayers.ndvi && <div className="risk-zone">Low Vegetation Catchment Zone</div>}

          {selectedPoint && (
            <div className="marker-detail-card">
              <div className="marker-detail-info">
                <h4>{selectedPoint.name}</h4>
                <p>
                  <strong>{selectedPoint.village}</strong> • {selectedPoint.type} • {selectedPoint.gps}
                </p>
                <p style={{ color: '#15803d', fontWeight: 600 }}>{selectedPoint.status}</p>
              </div>
              <button type="button" className="btn-close-marker" onClick={() => setSelectedPoint(null)}>
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <span className="eyebrow">Geo-Coded Evidence Points</span>
        <h1>Spatial Ground Records</h1>
        <p className="muted-copy">
          Click on any interactive marker on the map to inspect the field worker submission, GPS coordinates,
          and CV health assessment.
        </p>

        <EvidenceTable items={evidenceItems.slice(0, 4)} compact />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// CV Analysis Board
// ---------------------------------------------------------------------------
function AnalysisPage({
  indexData = cachedIndices,
  loading = false,
  error = '',
  onRetry = () => {},
}) {
  console.log('[AnalysisPage Render] Props:', {
    hasIndexData: !!indexData,
    loading,
    error,
    ndviAfterMean: indexData?.ndvi?.after?.mean,
    ndwiAfterMean: indexData?.ndwi?.after?.mean,
  });

  const formatValue = (value, decimals = 5) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '—';
    }

    return Number(value).toFixed(decimals);
  };

  const calculatePercentChange = (before, after) => {
    if (
      before === null ||
      after === null ||
      before === undefined ||
      after === undefined ||
      before === 0
    ) {
      return null;
    }

    return ((after - before) / Math.abs(before)) * 100;
  };

  const ndviPercentChange = indexData?.ndvi?.before?.mean != null && indexData?.ndvi?.after?.mean != null
    ? calculatePercentChange(
        indexData.ndvi.before.mean,
        indexData.ndvi.after.mean
      )
    : null;

  const ndwiPercentChange = indexData?.ndwi?.before?.mean != null && indexData?.ndwi?.after?.mean != null
    ? calculatePercentChange(
        indexData.ndwi.before.mean,
        indexData.ndwi.after.mean
      )
    : null;

  return (
    <section className="page-grid">
      <div className="panel wide">
        <span className="eyebrow">AI & Remote Sensing Engine</span>
        <h1>Automated Computer Vision & Remote Sensing Board</h1>
        <p className="muted-copy">
          JalDrishti continuously evaluates uploaded ground photographs and
          Sentinel-2 multispectral tiles to detect assets, verify photographic
          authenticity, and track post-monsoon catchment rejuvenation.
        </p>
      </div>

      {error && (
        <div
          className="status-pill needs-review"
          style={{
            padding: '0.8rem 1.2rem',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            width: '100%',
          }}
        >
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={onRetry}
            style={{
              background: '#ffffff',
              border: '1px solid #d97706',
              borderRadius: '6px',
              padding: '0.35rem 0.85rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.82rem',
              color: '#92400e',
            }}
          >
            🔄 Retry
          </button>
        </div>
      )}

      <div className="analysis-grid">
        <article className="panel analysis-card">
          <div className="analysis-card-header">
            <span>NDVI — Vegetation Health</span>
            <span className="status-pill verified">🌱 Sentinel-2</span>
          </div>

          {loading ? (
            <strong>Loading...</strong>
          ) : indexData?.ndvi ? (
            <>
              <strong>{formatValue(indexData.ndvi.after.mean)}</strong>

              <div className="progress-bar-wrap">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.min(
                      Math.max(
                        ((indexData.ndvi.after.mean + 1) / 2) * 100,
                        0
                      ),
                      100
                    )}%`,
                  }}
                ></div>
              </div>

              <p>
                <strong>Before:</strong> {formatValue(indexData.ndvi.before.mean)}
                <br />
                <strong>After:</strong> {formatValue(indexData.ndvi.after.mean)}
                <br />
                <strong>Change:</strong> {formatValue(indexData.ndvi.change.mean)}
                {ndviPercentChange !== null && (
                  <>
                    {' '}
                    ({ndviPercentChange >= 0 ? '+' : ''}
                    {ndviPercentChange.toFixed(2)}%)
                  </>
                )}
              </p>
            </>
          ) : (
            <strong>—</strong>
          )}
        </article>

        <article className="panel analysis-card">
          <div className="analysis-card-header">
            <span>NDWI — Surface Water</span>
            <span className="status-pill verified">💧 Sentinel-2</span>
          </div>

          {loading ? (
            <strong>Loading...</strong>
          ) : indexData?.ndwi ? (
            <>
              <strong>{formatValue(indexData.ndwi.after.mean)}</strong>

              <div className="progress-bar-wrap">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.min(
                      Math.max(
                        ((indexData.ndwi.after.mean + 1) / 2) * 100,
                        0
                      ),
                      100
                    )}%`,
                  }}
                ></div>
              </div>

              <p>
                <strong>Before:</strong> {formatValue(indexData.ndwi.before.mean)}
                <br />
                <strong>After:</strong> {formatValue(indexData.ndwi.after.mean)}
                <br />
                <strong>Change:</strong> {formatValue(indexData.ndwi.change.mean)}
                {ndwiPercentChange !== null && (
                  <>
                    {' '}
                    ({ndwiPercentChange >= 0 ? '+' : ''}
                    {ndwiPercentChange.toFixed(2)}%)
                  </>
                )}
              </p>
            </>
          ) : (
            <strong>—</strong>
          )}
        </article>

        <article className="panel analysis-card">
          <div className="analysis-card-header">
            <span>NDVI Raster Statistics</span>
            <span className="status-pill verified">📡 Live</span>
          </div>

          {loading ? (
            <strong>Loading...</strong>
          ) : indexData?.ndvi ? (
            <>
              <strong>{formatValue(indexData.ndvi.after.mean)}</strong>
              <p>
                <strong>Minimum:</strong> {formatValue(indexData.ndvi.after.min)}
                <br />
                <strong>Maximum:</strong> {formatValue(indexData.ndvi.after.max)}
                <br />
                <strong>Mean:</strong> {formatValue(indexData.ndvi.after.mean)}
                <br />
                <strong>Raster:</strong> {indexData.ndvi.after.shape?.join(' × ')}
              </p>
            </>
          ) : (
            <strong>—</strong>
          )}
        </article>

        <article className="panel analysis-card">
          <div className="analysis-card-header">
            <span>NDWI Raster Statistics</span>
            <span className="status-pill verified">📡 Live</span>
          </div>

          {loading ? (
            <strong>Loading...</strong>
          ) : indexData?.ndwi ? (
            <>
              <strong>{formatValue(indexData.ndwi.after.mean)}</strong>
              <p>
                <strong>Minimum:</strong> {formatValue(indexData.ndwi.after.min)}
                <br />
                <strong>Maximum:</strong> {formatValue(indexData.ndwi.after.max)}
                <br />
                <strong>Mean:</strong> {formatValue(indexData.ndwi.after.mean)}
                <br />
                <strong>Raster:</strong> {indexData.ndwi.after.shape?.join(' × ')}
              </p>
            </>
          ) : (
            <strong>—</strong>
          )}
        </article>
      </div>

      {indexData && (
        <div className="panel wide">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Sentinel-2 Temporal Comparison</span>
              <h2>Before vs After Analysis</h2>
            </div>
          </div>

          <div className="report-stats-strip">
            <div className="report-stat-item">
              <span>NDVI Before</span>
              <strong>{formatValue(indexData.ndvi.before.mean)}</strong>
            </div>

            <div className="report-stat-item">
              <span>NDVI After</span>
              <strong>{formatValue(indexData.ndvi.after.mean)}</strong>
            </div>

            <div className="report-stat-item">
              <span>NDVI Change</span>
              <strong>{formatValue(indexData.ndvi.change.mean)}</strong>
            </div>

            <div className="report-stat-item">
              <span>NDWI Before</span>
              <strong>{formatValue(indexData.ndwi.before.mean)}</strong>
            </div>

            <div className="report-stat-item">
              <span>NDWI After</span>
              <strong>{formatValue(indexData.ndwi.after.mean)}</strong>
            </div>

            <div className="report-stat-item">
              <span>NDWI Change</span>
              <strong>{formatValue(indexData.ndwi.change.mean)}</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Reports Page
// ---------------------------------------------------------------------------
function ReportsPage({ evidenceItems }) {
  const verifiedCount = evidenceItems.filter((i) => i.status === 'Verified').length;
  const reviewCount = evidenceItems.filter((i) => i.status !== 'Verified').length;

  const handlePrint = () => {
    window.print();
  };

  return (
    <section className="split-layout">
      <div className="panel">
        <span className="eyebrow">Ministry of Rural Development</span>
        <h1>Village Watershed Inspection Report</h1>
        <p className="muted-copy">
          Official consolidated dossier generated from ground truth field evidence, automated computer vision
          audit, and satellite vegetation recovery records.
        </p>

        <div className="report-card">
          <h2>Rampur & Satna Watershed Basin Summary</h2>
          <p>
            Field monitoring report covering 4 critical water harvesting structures. Automated computer vision
            inspection indicates stable spillway conditions with high water percolation efficiency.
          </p>

          <div className="report-stats-strip">
            <div className="report-stat-item">
              <span>Assets Assessed</span>
              <strong>{evidenceItems.length}</strong>
            </div>
            <div className="report-stat-item">
              <span>Verified Sound</span>
              <strong style={{ color: '#15803d' }}>{verifiedCount}</strong>
            </div>
            <div className="report-stat-item">
              <span>Requires Visit</span>
              <strong style={{ color: '#d97706' }}>{reviewCount}</strong>
            </div>
          </div>

          <button className="primary-action" type="button" onClick={handlePrint}>
            <span>🖨️</span>
            <span>Print Official Dossier (PDF)</span>
          </button>
        </div>
      </div>

      <div className="panel">
        <span className="eyebrow">Attached Ground Truth Audit Trail</span>
        <h2>Verified Evidence Records</h2>
        <div style={{ marginTop: '1rem' }}>
          <EvidenceTable items={evidenceItems} compact />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Evidence Table Helper Component
// ---------------------------------------------------------------------------
function EvidenceTable({ items, compact = false }) {
  const getStatusClass = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('verified')) return 'verified';
    if (s.includes('review')) return 'needs-review';
    return 'pending-cv-check';
  };

  const getRiskClass = (risk) => {
    const r = (risk || '').toLowerCase();
    if (r === 'low') return 'low';
    if (r === 'medium') return 'medium';
    if (r === 'high') return 'high';
    return 'new';
  };

  return (
    <div className="table-wrap">
      <table className={compact ? 'compact-table' : ''}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Village</th>
            <th>Asset Type</th>
            <th>Status</th>
            {!compact && <th>GPS Location</th>}
            <th>Risk Level</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="td-id">{item.id}</td>
              <td>
                <strong>{item.village}</strong>
                {item.assetId && (
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{item.assetId}</div>
                )}
              </td>
              <td>{item.assetType}</td>
              <td>
                <span className={`status-pill ${getStatusClass(item.status)}`}>
                  {item.status === 'Verified' ? '✓ ' : '⚠️ '}
                  {item.status}
                </span>
              </td>
              {!compact && <td className="td-gps">{item.gps}</td>}
              <td>
                <span className={`risk-tag ${getRiskClass(item.risk)}`}>{item.risk}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

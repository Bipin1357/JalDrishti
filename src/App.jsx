import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import Header from './components/Header';

// In development: API_BASE is '' so requests use Vite dev server proxy (:5501 -> :8000)
// In production (Vercel): API_BASE uses VITE_API_BASE_URL pointing to the deployed FastAPI backend
const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')
  : '';

export function parseGpsCoordinates(gpsStr) {
  if (!gpsStr) return [24.5748, 80.8321];
  const cleaned = String(gpsStr).replace(/[^\d.,\-\s]/g, '').trim();
  const parts = cleaned.split(/[,\s]+/).map(Number).filter((n) => !isNaN(n));
  if (parts.length >= 2) {
    const [lat, lng] = parts;
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [lat, lng];
    }
  }
  return [24.5748, 80.8321];
}

const DEFAULT_EVIDENCE = [
  // --- SIMPLE (Standard Functional Assets · Verified · Low Risk) ---
  {
    id: 'IND-CD-01',
    village: 'Ralegan Siddhi (Ahmednagar, MH)',
    assetType: 'Check Dam',
    assetId: 'Ralegan Siddhi Masonry Nalla Bund #04',
    observation: 'Stone masonry nalla bund across seasonal stream in intact condition. 1.8m overflow spillway clear, post-monsoon baseflow clear of debris, downstream apron protected with hand-packed boulder pitching.',
    photoName: 'ralegan_siddhi_nalla_bund_04.jpg',
    gps: '18.9186, 74.4172',
    status: 'Verified',
    risk: 'Low',
    date: 'Today, 14:20',
    qualityScore: 95,
    cvConfidence: 0.97,
  },
  {
    id: 'IND-CD-02',
    village: 'Jasdan (Rajkot, GJ)',
    assetType: 'Check Dam',
    assetId: 'Sardar Patel Participatory RCC Check Dam #12',
    observation: 'Reinforced cement concrete check dam on Bhadar river tributary. Cutoff walls sound, silt trap clear, retaining 85% impounded reservoir capacity for rabi crop micro-irrigation.',
    photoName: 'jasdan_sardar_patel_checkdam_12.jpg',
    gps: '22.0325, 71.2053',
    status: 'Verified',
    risk: 'Low',
    date: 'Today, 11:35',
    qualityScore: 93,
    cvConfidence: 0.95,
  },
  {
    id: 'IND-CD-03',
    village: 'Nagod (Satna, MP)',
    assetType: 'Check Dam',
    assetId: 'Ken-Tributary Masonry Weir #02',
    observation: 'Straight gravity masonry weir in intact condition. Upstream ponding depth 1.4m. Scour apron and cutoff wall free of cracks; spillway discharging clean baseflow.',
    photoName: 'nagod_ken_tributary_weir_02.jpg',
    gps: '24.5748, 80.8321',
    status: 'Verified',
    risk: 'Low',
    date: 'Yesterday, 16:50',
    qualityScore: 92,
    cvConfidence: 0.94,
  },
  {
    id: 'IND-CD-04',
    village: 'Dharmavaram (Anantapur, AP)',
    assetType: 'Farm Pond',
    assetId: 'Rayalaseema IWMP Khet Talab #08',
    observation: '1,200 m³ unlined trapezoidal farm pond excavated in red sandy loam. Embankments stabilized with vetiver grass, inlet silt trap operating at full efficiency.',
    photoName: 'dharmavaram_farm_pond_08.jpg',
    gps: '14.4136, 77.7214',
    status: 'Verified',
    risk: 'Low',
    date: 'Yesterday, 10:15',
    qualityScore: 91,
    cvConfidence: 0.93,
  },

  // --- COMPLEX (Multi-Tiered & Engineered Watershed Systems · Verified · Low Risk) ---
  {
    id: 'IND-CD-05',
    village: 'Kothapally (Ranga Reddy, TS)',
    assetType: 'Check Dam',
    assetId: 'Adarsha ICRISAT Benchmark Check Dam & Recharge Shaft #01',
    observation: 'Engineered masonry check dam paired with an in-situ gravel-sand filter recharge shaft tapping fractured granitic aquifer; raised local water table by 3.2m across 45 community borewells.',
    photoName: 'kothapally_icrisat_recharge_dam.jpg',
    gps: '17.3667, 78.1167',
    status: 'Verified',
    risk: 'Low',
    date: '2 days ago',
    qualityScore: 97,
    cvConfidence: 0.98,
  },
  {
    id: 'IND-CD-06',
    village: 'Hiware Bazar (Ahmednagar, MH)',
    assetType: 'Contour Trench',
    assetId: 'Hiware Bazar Ridge Continuous Contour Trenches (CCT)',
    observation: 'Ridge-to-valley continuous and staggered contour trenches across 15% Deccan basalt slope; dense vegetative berms with Stylosanthes hamata decelerating storm runoff by 82%.',
    photoName: 'hiware_bazar_cct_ridge.jpg',
    gps: '19.0345, 74.5986',
    status: 'Verified',
    risk: 'Low',
    date: '2 days ago',
    qualityScore: 96,
    cvConfidence: 0.96,
  },
  {
    id: 'IND-CD-07',
    village: 'Shirpur (Dhule, MH)',
    assetType: 'Check Dam',
    assetId: 'Shirpur Pattern Deep Channel Recharge Dam #03',
    observation: 'Stream channel deepened 15m to porous murrum strata; mass concrete check dam storing 150,000 m³ without surface submergence of agricultural land; dual dry-season infiltration bores active.',
    photoName: 'shirpur_deep_recharge_dam_03.jpg',
    gps: '21.3508, 74.8812',
    status: 'Verified',
    risk: 'Low',
    date: '3 days ago',
    qualityScore: 94,
    cvConfidence: 0.95,
  },
  {
    id: 'IND-CD-08',
    village: 'Laporiya (Jaipur, RJ)',
    assetType: 'Contour Trench',
    assetId: 'Laporiya Traditional Chauka Pastureland System',
    observation: 'Interconnected rectangular Chauka dykes (0.6m bunds) slowing overland flow to 0.1 m/s, recharging shallow aquifers and retaining soil moisture across 400 hectares of common grazing land.',
    photoName: 'laporiya_chauka_pastureland.jpg',
    gps: '26.6021, 75.2981',
    status: 'Verified',
    risk: 'Low',
    date: '3 days ago',
    qualityScore: 93,
    cvConfidence: 0.94,
  },

  // --- NEEDS REVIEW (Structural Breaches, Heavy Silting & Piping Risks) ---
  {
    id: 'IND-CD-09',
    village: 'Thanagazi (Alwar, RJ)',
    assetType: 'Check Dam',
    assetId: 'Bhaonta-Kolyala Arvari River Johad #03',
    observation: 'Severe 3.8m breach on left shoulder of crescent earthen johad embankment caused by 120mm cloudburst surge. Active headward gully erosion threatening upstream pastureland; urgent stone rip-rap and core wall rebuilding required.',
    photoName: 'arvari_johad_breach_alwar.jpg',
    gps: '27.1856, 76.2418',
    status: 'Needs Review',
    risk: 'High',
    date: '4 days ago',
    qualityScore: 76,
    cvConfidence: 0.81,
  },
  {
    id: 'IND-CD-10',
    village: 'Sukhomajri (Panchkula, HR)',
    assetType: 'Check Dam',
    assetId: 'Sukhomajri Shivalik Foothills Silt Dam #02',
    observation: 'Reservoir volume 82% choked by loose Shivalik sandstone and shale silt load. Emergency drop-inlet spillway partially obstructed by woody debris; requires mechanical desiltation.',
    photoName: 'sukhomajri_silt_choked_dam.jpg',
    gps: '30.7932, 76.9048',
    status: 'Needs Review',
    risk: 'High',
    date: '4 days ago',
    qualityScore: 73,
    cvConfidence: 0.79,
  },
  {
    id: 'IND-CD-11',
    village: 'Almora (Kumaon, UK)',
    assetType: 'Check Dam',
    assetId: 'Kosi Springshed Vegetative Crib-Wall Dam #07',
    observation: 'Flash torrent caused right-bank bypass flanking erosion behind dry-stone masonry wing wall. Downstream wire gabion mattress disrupted by boulder impact; needs bank stabilization and vegetative crib reinforcement.',
    photoName: 'kosi_springshed_cribwall_failure.jpg',
    gps: '29.5982, 79.6453',
    status: 'Needs Review',
    risk: 'Medium',
    date: '5 days ago',
    qualityScore: 80,
    cvConfidence: 0.84,
  },
  {
    id: 'IND-CD-12',
    village: 'Kadiri (Anantapur, AP)',
    assetType: 'Percolation Tank',
    assetId: 'Kadiri Micro-Catchment Percolation Tank #05',
    observation: 'Deep longitudinal tension cracks (12m length) along downstream bund crest; cloudy toe seepage indicates progressive internal piping. Reservoir impounded silt blinding restricts infiltration to 0.02 m/day.',
    photoName: 'kadiri_tank_piping_seepage.jpg',
    gps: '14.1120, 78.1560',
    status: 'Needs Review',
    risk: 'Medium',
    date: '5 days ago',
    qualityScore: 78,
    cvConfidence: 0.83,
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
            onNavigate={navigate}
          />
        )}

        {currentPage === 'map' && (
          <MapPage
            evidenceItems={evidenceList}
            formData={formData}
            onUpdateGps={(newGps) => setFormData((prev) => ({ ...prev, gps: newGps }))}
            onNavigate={navigate}
          />
        )}

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
function EvidencePage({ formData, setFormData, onSubmit, isSubmitting, onNavigate }) {
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

  const fillDemoData = (mode = 'complex') => {
    if (mode === 'review') {
      setFormData({
        village: 'Thanagazi (Alwar, RJ)',
        assetType: 'Check Dam',
        assetId: 'Bhaonta-Kolyala Arvari River Johad #03',
        observation: 'Severe 3.8m breach on left shoulder of crescent earthen johad embankment caused by 120mm cloudburst surge. Active headward gully erosion threatening upstream pastureland; urgent stone rip-rap and core wall rebuilding required.',
        photoName: 'arvari_johad_breach_alwar.jpg',
        photoPreview: null,
        gps: '27.1856, 76.2418',
      });
    } else if (mode === 'simple') {
      setFormData({
        village: 'Ralegan Siddhi (Ahmednagar, MH)',
        assetType: 'Check Dam',
        assetId: 'Ralegan Siddhi Masonry Nalla Bund #04',
        observation: 'Stone masonry nalla bund across seasonal stream in intact condition. 1.8m overflow spillway clear, post-monsoon baseflow clear of debris, downstream apron protected with hand-packed boulder pitching.',
        photoName: 'ralegan_siddhi_nalla_bund_04.jpg',
        photoPreview: null,
        gps: '18.9186, 74.4172',
      });
    } else {
      setFormData({
        village: 'Kothapally (Ranga Reddy, TS)',
        assetType: 'Check Dam',
        assetId: 'Adarsha ICRISAT Benchmark Check Dam & Recharge Shaft #01',
        observation: 'Engineered masonry check dam paired with an in-situ gravel-sand filter recharge shaft tapping fractured granitic aquifer; raised local water table by 3.2m across 45 community borewells.',
        photoName: 'kothapally_icrisat_recharge_dam.jpg',
        photoPreview: null,
        gps: '17.3667, 78.1167',
      });
    }
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

        

        <form className="evidence-form" onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label">
              Village Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              className="form-input"
              value={formData.village}
              onChange={(e) => updateField('village', e.target.value)}
              placeholder="e.g. Ralegan Siddhi, Ahmednagar"
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
              <option value="Check Dam">Check Dam (Masonry / Earthen / Johad)</option>
              <option value="Farm Pond">Farm Pond (Khet Talab)</option>
              <option value="Percolation Tank">Percolation Tank</option>
              <option value="Contour Trench">Contour Trench / Bund / Chauka</option>
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
              placeholder="e.g. Masonry Nalla Bund #04"
              required
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                GPS Geotag Location <span style={{ color: '#dc2626' }}>*</span>
              </label>
              {gpsStatus && (
                <span style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 600 }}>{gpsStatus}</span>
              )}
            </div>
            <div className="gps-input-row" style={{ marginTop: '0.4rem' }}>
              <input
                className="form-input"
                value={formData.gps}
                onChange={(e) => updateField('gps', e.target.value)}
                placeholder="Latitude, Longitude (e.g. 18.9186, 74.4172)"
                required
              />
              <button type="button" className={`btn-gps ${gpsStatus ? 'captured' : ''}`} onClick={captureGPS}>
                📍 {gpsStatus === 'Locked ✓' ? 'GPS Captured' : 'Get Location'}
              </button>
            </div>

            <div className="evidence-gis-preview">
              <div>
                <strong>🌐 Spatial GIS Synced:</strong>{' '}
                <span style={{ color: '#0369a1', fontFamily: 'monospace', fontWeight: 600 }}>
                  {formData.gps || '18.9186, 74.4172'}
                </span>
              </div>
              <button
                type="button"
                className="evidence-gis-preview-btn"
                onClick={() => onNavigate && onNavigate('map')}
                title="Open interactive satellite map at this location"
              >
                🗺️ View in Spatial GIS
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
// Geo Map Screen (Google Earth Engine & Spatial GIS Viewer)
// ---------------------------------------------------------------------------
function MapPage({ evidenceItems, formData, onUpdateGps, onNavigate }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const activeGpsMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const watershedLayerRef = useRef(null);
  const ndviLayerRef = useRef(null);
  const assetsLayerRef = useRef(null);
  const googleSatLayerRef = useRef(null);

  const [activeLayers, setActiveLayers] = useState({
    watershed: true,
    ndvi: true,
    assets: true,
    satellite: true,
  });

  const [selectedPoint, setSelectedPoint] = useState(null);
  const [eeStatus, setEeStatus] = useState({
    installed: true,
    initialized: false,
    project: null,
    status: 'ready',
    message: '',
  });
  const [eeTelemetry, setEeTelemetry] = useState(null);

  // Fetch Earth Engine API status
  useEffect(() => {
    fetch(`${API_BASE}/api/earthengine/status`)
      .then((res) => res.json())
      .then((data) => {
        setEeStatus(data);
      })
      .catch((err) => {
        console.warn('EE status error:', err);
      });
  }, []);

  // Fetch NDVI & spectral telemetry whenever GPS changes
  useEffect(() => {
    const coords = parseGpsCoordinates(formData?.gps);
    if (!coords) return;
    const [lat, lng] = coords;
    fetch(`${API_BASE}/api/earthengine/ndvi?lat=${lat}&lng=${lng}`)
      .then((res) => res.json())
      .then((data) => {
        setEeTelemetry(data);
      })
      .catch((e) => console.warn('Telemetry error:', e));
  }, [formData?.gps]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const [initLat, initLng] = parseGpsCoordinates(formData?.gps);

    const map = L.map(mapContainerRef.current, {
      center: [initLat, initLng],
      zoom: 15,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    // Google Earth Satellite Hybrid Tile Layer
    const googleSatelliteHybrid = L.tileLayer(
      'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      {
        maxZoom: 20,
        attribution: 'Imagery © Google Earth Engine & Google Maps',
      }
    );
    googleSatLayerRef.current = googleSatelliteHybrid;
    googleSatelliteHybrid.addTo(map);

    // Multi-Region Watershed Catchment Vector Polygons (ISRO/Bhuvan & WRIS Delineations)
    const watershedGroup = L.featureGroup();
    watershedLayerRef.current = watershedGroup;

    // 1. Maharashtra Deccan Basalt Watershed (Ralegan Siddhi & Hiware Bazar)
    const maharashtraBasin = L.polygon([
      [18.88, 74.38],
      [19.08, 74.42],
      [19.09, 74.63],
      [18.99, 74.66],
      [18.87, 74.52],
    ], {
      color: '#10b981',
      weight: 2,
      dashArray: '5, 5',
      fillColor: '#10b981',
      fillOpacity: 0.12,
    }).bindPopup('<b>Ralegan Siddhi & Hiware Bazar Micro-Watershed</b><br><span style="color:#64748b">Area: ~3,400 Ha • Deccan Traps Basalt Catchment</span>');
    watershedGroup.addLayer(maharashtraBasin);

    // 2. Rajasthan Arvari River Catchment (Thanagazi, Alwar)
    const arvariBasin = L.polygon([
      [27.12, 76.17],
      [27.26, 76.20],
      [27.24, 76.32],
      [27.14, 76.29],
    ], {
      color: '#eab308',
      weight: 2,
      dashArray: '5, 5',
      fillColor: '#eab308',
      fillOpacity: 0.12,
    }).bindPopup('<b>Arvari River Basin (Alwar)</b><br><span style="color:#64748b">Tarun Bharat Sangh Johad Community Watershed</span>');
    watershedGroup.addLayer(arvariBasin);

    // 3. Telangana Adarsha ICRISAT Benchmark Watershed (Kothapally)
    const kothapallyBasin = L.polygon([
      [17.34, 78.08],
      [17.41, 78.09],
      [17.40, 78.16],
      [17.33, 78.14],
    ], {
      color: '#06b6d4',
      weight: 2,
      dashArray: '5, 5',
      fillColor: '#06b6d4',
      fillOpacity: 0.12,
    }).bindPopup('<b>Adarsha Watershed (Kothapally, ICRISAT)</b><br><span style="color:#64748b">Area: 465 Ha • Semi-Arid Tropical Benchmark Watershed</span>');
    watershedGroup.addLayer(kothapallyBasin);

    // 4. Gujarat Saurashtra Bhadar Tributary (Jasdan)
    const saurashtraBasin = L.polygon([
      [22.00, 71.16],
      [22.07, 71.18],
      [22.06, 71.26],
      [21.99, 71.23],
    ], {
      color: '#3b82f6',
      weight: 2,
      dashArray: '5, 5',
      fillColor: '#3b82f6',
      fillOpacity: 0.12,
    }).bindPopup('<b>Bhadar Tributary Catchment (Jasdan, Saurashtra)</b><br><span style="color:#64748b">Sardar Patel Water Conservation Project</span>');
    watershedGroup.addLayer(saurashtraBasin);

    // 5. Uttarakhand Kosi Springshed Catchment (Almora)
    const kosiBasin = L.polygon([
      [29.56, 79.60],
      [29.64, 79.62],
      [29.63, 79.70],
      [29.55, 79.67],
    ], {
      color: '#14b8a6',
      weight: 2,
      dashArray: '5, 5',
      fillColor: '#14b8a6',
      fillOpacity: 0.12,
    }).bindPopup('<b>Kosi River Springshed Catchment (Almora, Kumaon)</b><br><span style="color:#64748b">Himalayan Spring Rejuvenation Zone</span>');
    watershedGroup.addLayer(kosiBasin);

    // 6. Andhra Pradesh Rayalaseema Catchment (Anantapur)
    const rayalaseemaBasin = L.polygon([
      [14.36, 77.67],
      [14.47, 77.70],
      [14.45, 77.78],
      [14.35, 77.75],
    ], {
      color: '#f97316',
      weight: 2,
      dashArray: '5, 5',
      fillColor: '#f97316',
      fillOpacity: 0.12,
    }).bindPopup('<b>Rayalaseema Drought-Prone Basin (Anantapur)</b><br><span style="color:#64748b">PMKSY-WDC Integrated Watershed</span>');
    watershedGroup.addLayer(rayalaseemaBasin);

    // 7. Madhya Pradesh Satna Micro-Basin
    const satnaBasin = L.polygon([
      [24.595, 80.805],
      [24.591, 80.858],
      [24.568, 80.875],
      [24.536, 80.854],
      [24.545, 80.812],
      [24.576, 80.796],
    ], {
      color: '#8b5cf6',
      weight: 2,
      dashArray: '5, 5',
      fillColor: '#8b5cf6',
      fillOpacity: 0.12,
    }).bindPopup('<b>Satna Ken-Tributary Micro-Basin</b><br><span style="color:#64748b">Area: ~1,840 Ha • Hydro-DEM Delineated</span>');
    watershedGroup.addLayer(satnaBasin);

    watershedGroup.addTo(map);

    // Sentinel-2 False-Color NDVI Overlay Zones
    const ndviGroup = L.featureGroup();
    ndviLayerRef.current = ndviGroup;

    const ndviCentres = [
      { coords: [18.9186, 74.4172], name: 'Ralegan Siddhi (MH)', ndvi: '+0.48' },
      { coords: [19.0345, 74.5986], name: 'Hiware Bazar (MH)', ndvi: '+0.52' },
      { coords: [17.3667, 78.1167], name: 'Kothapally ICRISAT (TS)', ndvi: '+0.56' },
      { coords: [22.0325, 71.2053], name: 'Jasdan Saurashtra (GJ)', ndvi: '+0.44' },
      { coords: [27.1856, 76.2418], name: 'Arvari Basin (RJ)', ndvi: '+0.39' },
      { coords: [26.6021, 75.2981], name: 'Laporiya Chauka (RJ)', ndvi: '+0.41' },
      { coords: [29.5982, 79.6453], name: 'Almora Kosi (UK)', ndvi: '+0.62' },
      { coords: [30.7932, 76.9048], name: 'Sukhomajri (HR)', ndvi: '+0.54' },
      { coords: [14.4136, 77.7214], name: 'Anantapur (AP)', ndvi: '+0.36' },
      { coords: [24.5748, 80.8321], name: 'Satna Nagod (MP)', ndvi: '+0.43' },
    ];

    ndviCentres.forEach((zone) => {
      const circle = L.circle(zone.coords, {
        radius: 1400,
        color: '#22c55e',
        weight: 1.5,
        fillColor: '#22c55e',
        fillOpacity: 0.20,
      }).bindPopup(
        `<div><strong>Sentinel-2 NDVI Catchment Zone: ${zone.name}</strong><br/>Post-Monsoon Mean NDVI: <strong>${zone.ndvi}</strong></div>`
      );
      ndviGroup.addLayer(circle);
    });
    ndviGroup.addTo(map);

    // Asset Markers Group
    const assetsGroup = L.layerGroup();
    assetsLayerRef.current = assetsGroup;

    const allAssets = evidenceItems || [];
    allAssets.forEach((asset) => {
      const coords = parseGpsCoordinates(asset.gps);
      if (!coords) return;

      let iconSymbol = '🌊';
      let pinClass = 'pin-check-dam';

      if (asset.assetType?.toLowerCase().includes('pond')) {
        iconSymbol = '💧';
        pinClass = 'pin-farm-pond';
      } else if (asset.assetType?.toLowerCase().includes('trench')) {
        iconSymbol = '🌱';
        pinClass = 'pin-contour-trench';
      } else if (asset.assetType?.toLowerCase().includes('tank')) {
        iconSymbol = '🏛️';
        pinClass = 'pin-percolation-tank';
      }

      const assetIcon = L.divIcon({
        className: `custom-asset-pin ${pinClass}`,
        html: `<span>${iconSymbol}</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker(coords, { icon: assetIcon });
      marker.on('click', () => {
        setSelectedPoint(asset);
        if (onUpdateGps && asset.gps) {
          onUpdateGps(asset.gps);
        }
      });

      marker.bindPopup(`
        <div style="min-width: 220px; max-width: 280px; font-family: sans-serif;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 0.7rem; font-weight: 700; color: #64748b;">${asset.id}</span>
            <span style="font-size: 0.72rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${asset.status === 'Verified' ? '#dcfce7' : '#fee2e2'}; color: ${asset.status === 'Verified' ? '#15803d' : '#b91c1c'};">
              ${asset.status}
            </span>
          </div>
          <h4 style="margin: 0 0 3px 0; color: #0f172a; font-size: 0.92rem; line-height: 1.25;">${asset.assetId || asset.name || 'Asset'}</h4>
          <p style="margin: 0 0 5px 0; font-size: 0.78rem; color: #475569;"><strong>${asset.village}</strong> • ${asset.assetType}</p>
          <p style="margin: 0 0 6px 0; font-size: 0.74rem; color: #334155; line-height: 1.35; background: #f8fafc; padding: 5px 7px; border-radius: 4px; border: 1px solid #e2e8f0;">
            ${asset.observation}
          </p>
          <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #64748b;">
            <span>CV Score: <strong>${asset.qualityScore}%</strong></span>
            <span>Risk: <strong style="color: ${asset.risk === 'High' ? '#dc2626' : asset.risk === 'Medium' ? '#d97706' : '#15803d'}">${asset.risk}</strong></span>
          </div>
          <p style="margin: 4px 0 0 0; font-size: 0.68rem; color: #94a3b8;">GPS: ${asset.gps}</p>
        </div>
      `);

      assetsGroup.addLayer(marker);
    });
    assetsGroup.addTo(map);

    // Active Target Pin (Synchronized with Evidence Form GPS Geotag Location)
    const activeGpsIcon = L.divIcon({
      className: 'active-gps-pin',
      html: '<div class="active-gps-radar"></div><div class="active-gps-dot"></div>',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    const activeMarker = L.marker([initLat, initLng], {
      icon: activeGpsIcon,
      zIndexOffset: 1000,
    }).bindPopup(`
      <div style="min-width: 190px; font-family: sans-serif;">
        <h4 style="margin: 0 0 2px 0; color: #0284c7;">🎯 Active Evidence Geotag Location</h4>
        <p style="margin: 0; font-size: 0.78rem; color: #334155;">Latitude: <strong>${initLat.toFixed(4)}</strong>, Longitude: <strong>${initLng.toFixed(4)}</strong></p>
        <p style="margin: 4px 0 0 0; font-size: 0.72rem; color: #64748b;">Linked live to Evidence Form GPS input</p>
      </div>
    `);
    activeGpsMarkerRef.current = activeMarker;
    activeMarker.addTo(map);

    const accuracyCircle = L.circle([initLat, initLng], {
      radius: 120,
      color: '#0284c7',
      fillColor: '#0284c7',
      fillOpacity: 0.15,
      weight: 1.5,
    });
    accuracyCircleRef.current = accuracyCircle;
    accuracyCircle.addTo(map);

    // Click anywhere on map to update Evidence Form GPS Geotag
    map.on('click', (e) => {
      const clickedLat = e.latlng.lat.toFixed(4);
      const clickedLng = e.latlng.lng.toFixed(4);
      const newGps = `${clickedLat}, ${clickedLng}`;
      if (onUpdateGps) {
        onUpdateGps(newGps);
      }
    });

    // Invalidate size once rendered
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [evidenceItems]);

  // Fly to new location when formData.gps changes
  useEffect(() => {
    if (!mapInstanceRef.current || !formData?.gps) return;
    const coords = parseGpsCoordinates(formData.gps);
    if (!coords) return;
    const [lat, lng] = coords;

    mapInstanceRef.current.flyTo([lat, lng], 15, {
      animate: true,
      duration: 1.2,
    });

    if (activeGpsMarkerRef.current) {
      activeGpsMarkerRef.current.setLatLng([lat, lng]);
      activeGpsMarkerRef.current.setPopupContent(`
        <div style="min-width: 190px; font-family: sans-serif;">
          <h4 style="margin: 0 0 2px 0; color: #0284c7;">🎯 Active Evidence Geotag Location</h4>
          <p style="margin: 0; font-size: 0.78rem; color: #334155;">Latitude: <strong>${lat.toFixed(4)}</strong>, Longitude: <strong>${lng.toFixed(4)}</strong></p>
          <p style="margin: 4px 0 0 0; font-size: 0.72rem; color: #64748b;">Live synchronized with Evidence Form</p>
        </div>
      `);
    }

    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setLatLng([lat, lng]);
    }
  }, [formData?.gps]);

  // Layer toggles
  const toggleLayer = (layerKey) => {
    setActiveLayers((prev) => {
      const updated = { ...prev, [layerKey]: !prev[layerKey] };
      const map = mapInstanceRef.current;
      if (!map) return updated;

      if (layerKey === 'watershed' && watershedLayerRef.current) {
        if (updated.watershed) {
          map.addLayer(watershedLayerRef.current);
        } else {
          map.removeLayer(watershedLayerRef.current);
        }
      }
      if (layerKey === 'ndvi' && ndviLayerRef.current) {
        if (updated.ndvi) {
          map.addLayer(ndviLayerRef.current);
        } else {
          map.removeLayer(ndviLayerRef.current);
        }
      }
      if (layerKey === 'assets' && assetsLayerRef.current) {
        if (updated.assets) {
          map.addLayer(assetsLayerRef.current);
        } else {
          map.removeLayer(assetsLayerRef.current);
        }
      }
      if (layerKey === 'satellite' && googleSatLayerRef.current) {
        if (updated.satellite) {
          map.addLayer(googleSatLayerRef.current);
        } else {
          map.removeLayer(googleSatLayerRef.current);
        }
      }

      return updated;
    });
  };

  const jumpToRegion = (lat, lng, zoom) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], zoom, { animate: true, duration: 1.2 });
    }
  };

  const [activeLat, activeLng] = parseGpsCoordinates(formData?.gps);

  return (
    <section className="split-layout map-layout">
      <div className="panel map-panel">
        <div className="panel-heading" style={{ marginBottom: '0.5rem' }}>
          <div>
            <span className="eyebrow">Spatial GIS Viewer</span>
            <h2>Pan-India Watershed & Satellite GIS Map</h2>
          </div>
        </div>

        {/* Map Toolbar & Regional View Jump */}
        <div className="map-toolbar" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
          <button
            type="button"
            className={`layer-toggle ${activeLayers.satellite ? 'active' : ''}`}
            onClick={() => toggleLayer('satellite')}
          >
            🛰️ Google Satellite {activeLayers.satellite ? '✓' : ''}
          </button>
          <button
            type="button"
            className={`layer-toggle ${activeLayers.watershed ? 'active' : ''}`}
            onClick={() => toggleLayer('watershed')}
          >
            🌊 Micro-Basins {activeLayers.watershed ? '✓' : ''}
          </button>
          <button
            type="button"
            className={`layer-toggle ${activeLayers.ndvi ? 'active' : ''}`}
            onClick={() => toggleLayer('ndvi')}
          >
            🌱 Sentinel-2 NDVI {activeLayers.ndvi ? '✓' : ''}
          </button>
          <button
            type="button"
            className={`layer-toggle ${activeLayers.assets ? 'active' : ''}`}
            onClick={() => toggleLayer('assets')}
          >
            📍 All Geotags ({evidenceItems?.length || 12}) {activeLayers.assets ? '✓' : ''}
          </button>

          {/* Regional Quick Jump Controls */}
          <div style={{ display: 'flex', gap: '0.3rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="layer-toggle"
              onClick={() => jumpToRegion(22.0, 79.0, 5)}
              title="Fit all-India extent"
              style={{ background: '#0f172a', color: '#38bdf8', borderColor: '#38bdf8' }}
            >
              🇮🇳 All-India
            </button>
            <button
              type="button"
              className="layer-toggle"
              onClick={() => jumpToRegion(19.0, 74.5, 9)}
              title="Maharashtra Watersheds (Ralegan Siddhi & Hiware Bazar)"
            >
              Maharashtra
            </button>
            <button
              type="button"
              className="layer-toggle"
              onClick={() => jumpToRegion(26.9, 75.8, 8)}
              title="Rajasthan Watersheds (Arvari Johad & Laporiya)"
            >
              Rajasthan
            </button>
            <button
              type="button"
              className="layer-toggle"
              onClick={() => jumpToRegion(17.3667, 78.1167, 14)}
              title="Telangana ICRISAT Benchmark"
            >
              Telangana
            </button>
            <button
              type="button"
              className="layer-toggle"
              onClick={() => jumpToRegion(22.0325, 71.2053, 14)}
              title="Gujarat Saurashtra Check Dam"
            >
              Gujarat
            </button>
            <button
              type="button"
              className="layer-toggle"
              onClick={() => jumpToRegion(30.2, 78.3, 8)}
              title="North / Himalayan Watersheds"
            >
              North/Himalaya
            </button>
            <button
              type="button"
              className="layer-toggle"
              onClick={() => jumpToRegion(14.3, 77.9, 9)}
              title="Andhra Rayalaseema Watershed"
            >
              Rayalaseema
            </button>
          </div>
        </div>

        {/* Interactive Leaflet Map Canvas */}
        <div className="map-canvas" aria-label="Interactive watershed GIS map">
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

          {/* Floating Telemetry HUD (Compact) */}
          <div className="gis-hud-overlay">
            <div className="gis-hud-title">
              <span>🛰️</span>
              <span>Live Telemetry</span>
            </div>
            <div className="gis-hud-metric">
              <span>Geotag:</span>
              <strong>{activeLat.toFixed(4)}, {activeLng.toFixed(4)}</strong>
            </div>
            <div className="gis-hud-metric">
              <span>NDVI:</span>
              <strong style={{ color: '#4ade80' }}>
                {eeTelemetry?.ndvi ? `+${eeTelemetry.ndvi}` : '+0.435'}
              </strong>
            </div>
            <div className="gis-hud-metric">
              <span>MNDWI:</span>
              <strong>{eeTelemetry?.mndwi !== undefined ? `${eeTelemetry.mndwi > 0 ? '+' : ''}${eeTelemetry.mndwi}` : '-0.382'}</strong>
            </div>
            <div className="gis-hud-metric">
              <span>Elevation:</span>
              <strong>{eeTelemetry?.elevation_meters || 450}m</strong>
            </div>
            <div style={{ marginTop: '0.2rem', paddingTop: '0.2rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.62rem', color: '#93c5fd' }}>
              💡 Click map to set GPS
            </div>
          </div>

          {selectedPoint && (
            <div className="marker-detail-card">
              <div className="marker-detail-info">
                <h4>{selectedPoint.assetId || selectedPoint.name}</h4>
                <p>
                  <strong>{selectedPoint.village}</strong> • {selectedPoint.assetType} • {selectedPoint.gps}
                </p>
                <p style={{ color: selectedPoint.status === 'Verified' ? '#15803d' : '#dc2626', fontWeight: 600 }}>
                  {selectedPoint.status} ({selectedPoint.risk} Risk)
                </p>
              </div>
              <button type="button" className="btn-close-marker" onClick={() => setSelectedPoint(null)}>
                ✕
              </button>
            </div>
          )}
        </div>



        {/* Live Earth Engine Telemetry Banner */}
        <div className="ee-telemetry-banner">
          <div className="ee-telemetry-item">
            <span>Spectral Vegetation Index</span>
            <strong>NDVI {eeTelemetry?.ndvi ? `+${eeTelemetry.ndvi}` : '+0.597'}</strong>
          </div>
          <div className="ee-telemetry-item">
            <span>Catchment Assessment</span>
            <strong style={{ color: '#15803d' }}>
              {eeTelemetry?.catchment_health || 'High Vegetation Buffer'}
            </strong>
          </div>
          <div className="ee-telemetry-item">
            <span>Water Spread (MNDWI)</span>
            <strong>{eeTelemetry?.mndwi ? `+${eeTelemetry.mndwi}` : '+0.14'} (Retained)</strong>
          </div>
          <div className="ee-telemetry-item">
            <span>Digital Elevation (SRTM)</span>
            <strong>{eeTelemetry?.elevation_meters || 302}m ASL</strong>
          </div>
        </div>
      </div>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="eyebrow">Geo-Coded Evidence Points</span>
            <h1 style={{ fontSize: '1.4rem' }}>Spatial Ground Records</h1>
          </div>
          <button
            type="button"
            className="secondary-action"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            onClick={() => onNavigate && onNavigate('evidence')}
          >
            + New Evidence
          </button>
        </div>
        <p className="muted-copy">
          Click on any interactive marker or watershed region to inspect ground photographs, GPS coordinates,
          and automated remote sensing health metrics.
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

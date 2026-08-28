import React, { useState } from 'react';

/**
 * FieldEvidenceForm Component
 * Screen allowing field workers to record watershed asset details before photo/GPS capture.
 */
export default function FieldEvidenceForm({ onBack }) {
  // Form input states
  const [villageName, setVillageName] = useState('');
  const [assetType, setAssetType] = useState('Check Dam');
  const [assetIdentifier, setAssetIdentifier] = useState('');
  const [observations, setObservations] = useState('');

  // Info message trigger state
  const [infoMessage, setInfoMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Display the requested simple next step message
    setInfoMessage('Next, you will add a photo.');
  };

  return (
    <div className="form-screen-container">
      {/* Navigation Top Bar with Back button */}
      <div className="form-top-bar">
        <button
          type="button"
          className="btn-back"
          onClick={onBack}
          id="btn-back-home"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back to home</span>
        </button>

        <div className="form-step-indicator">
          <span>Step 1 of 2: Asset Details</span>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="form-card">
        {/* Header section */}
        <div className="form-header">
          <div className="form-badge-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h1 className="form-title">Add Field Evidence</h1>
          <p className="form-subtitle">
            Record details of the watershed asset you are visiting.
          </p>
        </div>

        {/* The Field Worker Form */}
        <form onSubmit={handleSubmit} className="field-form">
          {/* Village Name */}
          <div className="form-group">
            <label htmlFor="village-name" className="form-label">
              Village Name <span className="required-star">*</span>
            </label>
            <div className="input-icon-wrapper">
              <span className="input-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </span>
              <input
                id="village-name"
                type="text"
                className="form-input with-icon"
                placeholder="e.g., Rampur, Block A"
                value={villageName}
                onChange={(e) => {
                  setVillageName(e.target.value);
                  if (infoMessage) setInfoMessage('');
                }}
                required
              />
            </div>
          </div>

          {/* Asset Type Dropdown */}
          <div className="form-group">
            <label htmlFor="asset-type" className="form-label">
              Asset Type <span className="required-star">*</span>
            </label>
            <div className="select-wrapper">
              <select
                id="asset-type"
                className="form-select"
                value={assetType}
                onChange={(e) => {
                  setAssetType(e.target.value);
                  if (infoMessage) setInfoMessage('');
                }}
                required
              >
                <option value="Check Dam">Check Dam</option>
                <option value="Farm Pond">Farm Pond</option>
                <option value="Percolation Tank">Percolation Tank</option>
                <option value="Contour Trench">Contour Trench</option>
                <option value="Plantation Area">Plantation Area</option>
              </select>
              <span className="select-caret" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>
          </div>

          {/* Asset Name / Local Identifier */}
          <div className="form-group">
            <label htmlFor="asset-identifier" className="form-label">
              Asset Name / Local Identifier <span className="required-star">*</span>
            </label>
            <div className="input-icon-wrapper">
              <span className="input-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
              </span>
              <input
                id="asset-identifier"
                type="text"
                className="form-input with-icon"
                placeholder="e.g., Check Dam #4 (North Nala) or Farm Pond 12"
                value={assetIdentifier}
                onChange={(e) => {
                  setAssetIdentifier(e.target.value);
                  if (infoMessage) setInfoMessage('');
                }}
                required
              />
            </div>
          </div>

          {/* Field Observation Text Box */}
          <div className="form-group">
            <label htmlFor="field-observations" className="form-label">
              Field Observation
            </label>
            <textarea
              id="field-observations"
              rows={4}
              className="form-textarea"
              placeholder="e.g., Water retention level is normal, side spillway in good condition, no silt blockage observed."
              value={observations}
              onChange={(e) => {
                setObservations(e.target.value);
                if (infoMessage) setInfoMessage('');
              }}
            />
          </div>

          {/* Small message shown when Continue button is clicked */}
          {infoMessage && (
            <div className="form-info-banner" role="status">
              <div className="info-banner-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <div className="info-banner-text">
                <p className="info-banner-title">{infoMessage}</p>
                <p className="info-banner-desc">
                  Photo upload and GPS geotagging will be enabled in the upcoming update.
                </p>
              </div>
            </div>
          )}

          {/* Large Green Submit / Continue Button */}
          <div className="form-action-area">
            <button
              id="btn-continue-photo"
              type="submit"
              className="btn-primary-large btn-form-submit"
            >
              <span>Continue to Photo Evidence</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

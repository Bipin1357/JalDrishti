import React from 'react';

/**
 * WelcomeHero Component
 * The main welcome interface for JalDrishti field workers.
 */
export default function WelcomeHero({ onOpenForm }) {
  const handleButtonClick = () => {
    if (onOpenForm) {
      onOpenForm();
    }
  };

  return (
    <section className="hero-wrapper">
      {/* Decorative rural water background elements */}
      <div className="hero-decor-leaf" aria-hidden="true"></div>
      <div className="hero-decor-water" aria-hidden="true"></div>

      {/* Pill badge */}
      <div className="hero-pill">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>Rural Water Conservation & Asset Monitoring</span>
      </div>

      {/* Primary Heading */}
      <h1 className="hero-heading">
        Monitor watershed work with <span className="highlight">trusted field evidence</span>
      </h1>

      {/* Short Explanatory Text */}
      <p className="hero-description">
        Field workers can upload a photo and GPS location of assets such as check dams and farm ponds.
      </p>

      {/* One Large Green Button */}
      <div className="cta-button-container">
        <button
          id="btn-add-evidence"
          className="btn-primary-large"
          onClick={handleButtonClick}
          type="button"
        >
          {/* Plus / Camera Evidence Icon */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <span>Add Field Evidence</span>
        </button>
        <span className="btn-hint">
          <span>📷</span> Quick geotagged asset capture
        </span>
      </div>

      {/* Asset Preview Cards (Water, Farm, GPS) */}
      <div className="assets-grid">
        {/* Check Dams Card */}
        <div className="asset-card">
          <div className="asset-icon-box water" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="22"
              height="22"
            >
              <path d="M2 12h20M2 17h20M2 7h20" />
            </svg>
          </div>
          <div className="asset-info">
            <h3>Check Dams</h3>
            <p>Verify water retention barriers, masonry structures, and overflow levels.</p>
          </div>
        </div>

        {/* Farm Ponds Card */}
        <div className="asset-card">
          <div className="asset-icon-box farm" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="22"
              height="22"
            >
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
            </svg>
          </div>
          <div className="asset-info">
            <h3>Farm Ponds</h3>
            <p>Document excavated farm ponds, embankment conditions, and storage capacity.</p>
          </div>
        </div>

        {/* GPS Location Card */}
        <div className="asset-card">
          <div className="asset-icon-box gps" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="22"
              height="22"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div className="asset-info">
            <h3>GPS Coordinates</h3>
            <p>Precise latitude and longitude tagging to ensure authentic ground proof.</p>
          </div>
        </div>
      </div>

    </section>
  );
}

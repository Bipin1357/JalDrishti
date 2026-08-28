import React from 'react';

/**
 * Header Component
 * Displays the JalDrishti brand name, official subtitle, and field readiness status.
 */
export default function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <div className="brand-group">
          {/* Logo icon representing water conservation and agriculture */}
          <div className="brand-icon-wrapper" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Droplet outline */}
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              {/* Sprouting leaf vein inside droplet */}
              <path d="M12 12c0 2.5 1.5 4 3 4" strokeWidth="1.75" />
            </svg>
          </div>

          <div className="brand-text">
            <span className="brand-title">JalDrishti</span>
            <span className="brand-subtitle">Watershed Evidence Portal</span>
          </div>
        </div>

        {/* Live readiness badge */}
        <div className="header-badge">
          <span className="header-badge-dot"></span>
          <span>Field Ready</span>
        </div>
      </div>
    </header>
  );
}

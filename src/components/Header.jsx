import React from 'react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'evidence', label: 'Evidence Form', icon: '📷' },
  { id: 'map', label: 'Geo Map', icon: '🗺️' },
  { id: 'analysis', label: 'CV Analysis', icon: '🧠' },
  { id: 'reports', label: 'Village Reports', icon: '📑' },
];

export default function Header({ currentPage, onNavigate, isBackendOnline }) {
  return (
    <header className="header">
      <div className="header-content">
        {/* Brand Group */}
        <button
          className="brand-group"
          type="button"
          onClick={() => onNavigate('dashboard')}
          aria-label="JalDrishti Home"
        >
          <div className="brand-icon-wrapper" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              <path d="M12 12c0 2.5 1.5 4 3 4" strokeWidth="2" />
            </svg>
          </div>

          <div className="brand-text">
            <span className="brand-title">JalDrishti</span>
            <span className="brand-subtitle">Watershed Evidence Portal</span>
          </div>
        </button>

        {/* Navigation Tabs */}
        <nav className="nav-tabs" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-tab ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Live Backend Connection Status */}
        <div className="header-actions">
          <div
            className={`backend-badge ${isBackendOnline ? 'online' : 'offline'}`}
            title={isBackendOnline ? 'FastAPI backend connected at :8000' : 'Offline / Standalone mode'}
          >
            <span className="status-dot"></span>
            <span>{isBackendOnline ? 'Live Backend' : 'Offline Mode'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

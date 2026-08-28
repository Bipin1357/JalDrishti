import React, { useState } from 'react';
import Header from './components/Header';
import WelcomeHero from './components/WelcomeHero';
import FieldEvidenceForm from './components/FieldEvidenceForm';

/**
 * App Component
 * Root component managing navigation between Welcome screen and Field Evidence Form screen.
 */
export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home'); // 'home' | 'form'

  const navigateToForm = () => {
    setCurrentScreen('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToHome = () => {
    setCurrentScreen('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-container">
      {/* Top Header with JalDrishti branding */}
      <Header />

      {/* Main Content Area: switches between Welcome Hero and Form Screen */}
      <main className="main-content">
        {currentScreen === 'home' ? (
          <WelcomeHero onOpenForm={navigateToForm} />
        ) : (
          <FieldEvidenceForm onBack={navigateToHome} />
        )}
      </main>

      {/* Clean, unobtrusive footer */}
      <footer className="footer">
        <p>
          <span className="footer-highlight">JalDrishti</span> • Watershed Evidence Portal for Rural Development & Water Security
        </p>
      </footer>
    </div>
  );
}

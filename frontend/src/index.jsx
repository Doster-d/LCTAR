import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import Landing from './Landing';
import AprilTagLayoutEditor from './AprilTagLayoutEditor';
import { ApiProvider } from './api/ApiContext';


const AppContainer = () => {
  const [currentView, setCurrentView] = useState('app');

  const handleSwitchToApp = () => {
    console.log('[DEBUG] index.jsx: Switching from landing to app view');
    setCurrentView('app');
  };

  const handleSwitchToLanding = () => {
    console.log('[DEBUG] index.jsx: Switching to landing view');
    setCurrentView('landing');
  };

  const handleOpenEditor = () => {
    console.log('[DEBUG] index.jsx: Switching to AprilTag editor view');
    setCurrentView('editor');
  };

  const renderCurrentView = () => {
    console.log('[DEBUG] index.jsx: Rendering view:', currentView);
    switch (currentView) {
      case 'app':
        return <App onSwitchToLanding={handleSwitchToLanding} />;
      case 'editor':
        return <AprilTagLayoutEditor onExit={handleSwitchToLanding} />;
      case 'landing':
      default:
        return <Landing onSwitchToApp={handleSwitchToApp} onOpenEditor={handleOpenEditor} />;
    }
  };

  return renderCurrentView();
};

const container = document.getElementById('root');
/**
 * @brief Создаёт корневой React-узел для управления рендерингом.
 */
const root = createRoot(container);
/**
 * @brief Загружает выбранный компонент в DOM.
 */
root.render(
  <ApiProvider>
    <AppContainer />
  </ApiProvider>
);

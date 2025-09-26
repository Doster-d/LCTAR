import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import Landing from './Landing';


const AppContainer = () => {
 const [currentView, setCurrentView] = useState('landing');

 const handleSwitchToApp = () => {
   console.log('[DEBUG] index.jsx: Switching from landing to app view');
   setCurrentView('app');
 };

 const handleSwitchToLanding = () => {
   console.log('[DEBUG] index.jsx: Switching from app to landing view');
   setCurrentView('landing');
 };

 const renderCurrentView = () => {
   console.log('[DEBUG] index.jsx: Rendering view:', currentView);
   switch (currentView) {
     case 'app':
       return <App onSwitchToLanding={handleSwitchToLanding} />;
     case 'landing':
     default:
       return <Landing onSwitchToApp={handleSwitchToApp} />;
   }
 };

 return renderCurrentView();
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<AppContainer />);
/**
 * @file Оптимизированный главный компонент приложения
 */
import React, { useState } from 'react';
import ARRecorder from './ARRecorder.jsx';
import Landing from './Landing.jsx';
import AprilTagLayoutEditor from './AprilTagLayoutEditor.jsx';

const App = () => {
  const [view, setView] = useState('camera');

  if (view === 'landing') {
    return (
      <Landing
        onSwitchToApp={() => setView('camera')}
        onOpenEditor={() => setView('editor')}
      />
    );
  }

  if (view === 'editor') {
    return (
      <AprilTagLayoutEditor 
        onExit={() => setView('landing')} 
      />
    );
  }

  return (
    <ARRecorder 
      onShowLanding={() => setView('landing')} 
    />
  );
};

export default App;

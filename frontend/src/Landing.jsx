import React from 'react';
import WavyGridBackground from './WavyGridBackground';
import LandingPageTemplate from './LandingPageTemplate';

/**
 * @brief Компонует маркетинговый лендинг.
 * @param onSwitchToApp Обработчик перехода в основное приложение.
 * @returns {JSX.Element} Разметка лендинга.
 */
const Landing = ({ onSwitchToApp, onOpenEditor }) => {
  return (
    <>
      <WavyGridBackground />
      <LandingPageTemplate onSwitchToApp={onSwitchToApp} onOpenEditor={onOpenEditor} />
    </>
  );
};

export default Landing;
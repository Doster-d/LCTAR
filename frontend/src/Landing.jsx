import React from 'react';
import WavyGridBackground from './WavyGridBackground';
import LandingPageTemplate from './LandingPageTemplate';

const Landing = ({ onSwitchToApp }) => {
  return (
    <>
      <WavyGridBackground />
      <LandingPageTemplate onSwitchToApp={onSwitchToApp} />
    </>
  );
};

export default Landing;
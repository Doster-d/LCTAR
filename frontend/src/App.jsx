import React, { useState } from 'react'
import ARScene from './ARScene.jsx'
import TechnicalLanding from './components/TechnicalLanding.jsx'

export default function App() {
  const [currentView, setCurrentView] = useState('ar')

  const switchToAR = () => setCurrentView('ar')
  const switchToTechnical = () => setCurrentView('technical')

  const renderCurrentView = () => {
    switch (currentView) {
      case 'technical':
        return <TechnicalLanding onBackToAR={switchToAR} />
      case 'ar':
      default:
        return <ARScene onSwitchToTechnical={switchToTechnical} />
    }
  }

  return renderCurrentView()
}

import React, { useState, useEffect } from 'react'
import ARScene from './ARScene.jsx'
import TechnicalLanding from './components/TechnicalLanding.jsx'

export default function App() {
  const [currentView, setCurrentView] = useState('ar')

  const switchToAR = () => setCurrentView('ar')
  const switchToTechnical = () => setCurrentView('technical')

  // Custom cursor functionality
  useEffect(() => {
    // Create custom cursor element
    const cursor = document.createElement('div')
    cursor.id = 'custom-cursor'
    document.body.appendChild(cursor)

    const handleMouseMove = (e) => {
      cursor.style.left = e.clientX + 'px'
      cursor.style.top = e.clientY + 'px'
    }

    const handleMouseEnter = (e) => {
      const target = e.target
      if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'INPUT' || target.closest('button')) {
        cursor.classList.add('hover')
        cursor.classList.remove('active')
      }
    }

    const handleMouseLeave = (e) => {
      const target = e.target
      if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'INPUT' || target.closest('button')) {
        cursor.classList.remove('hover', 'active')
      }
    }

    const handleMouseDown = (e) => {
      const target = e.target
      if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'INPUT' || target.closest('button')) {
        cursor.classList.add('active')
        cursor.classList.remove('hover')
      }
    }

    const handleMouseUp = () => {
      cursor.classList.remove('active')
    }

    // Hide cursor when mouse leaves window
    const handleMouseOut = () => {
      cursor.classList.add('hidden')
    }

    const handleMouseOver = () => {
      cursor.classList.remove('hidden')
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseenter', handleMouseEnter, true)
    document.addEventListener('mouseleave', handleMouseLeave, true)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mouseout', handleMouseOut)
    document.addEventListener('mouseover', handleMouseOver)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseenter', handleMouseEnter, true)
      document.removeEventListener('mouseleave', handleMouseLeave, true)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mouseout', handleMouseOut)
      document.removeEventListener('mouseover', handleMouseOver)
      if (cursor.parentNode) {
        document.body.removeChild(cursor)
      }
    }
  }, [])

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

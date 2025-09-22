import React from 'react'

function ToTechnicalButton({ onSwitchToTechnical }) {
  return (
    <button
      onClick={onSwitchToTechnical}
      style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 10,
        padding: '8px 14px',
        background: '#2196F3',
        color: '#fff',
        border: '1px solid #1976D2',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        transition: 'background 0.3s',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}
      onMouseOver={(e) => e.target.style.background = '#1976D2'}
      onMouseOut={(e) => e.target.style.background = '#2196F3'}
    >
      🛠️ Техническая информация
    </button>
  )
}

export default ToTechnicalButton
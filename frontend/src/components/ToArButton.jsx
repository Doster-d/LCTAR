import React from 'react'

function ToArButton({ onSwitchToAR }) {
  return (
    <button
      onClick={onSwitchToAR}
      style={{
        padding: '12px 24px',
        background: '#4CAF50',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
        transition: 'background 0.3s',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}
      onMouseOver={(e) => e.target.style.background = '#45a049'}
      onMouseOut={(e) => e.target.style.background = '#4CAF50'}
    >
      ← Вернуться в AR
    </button>
  )
}

export default ToArButton
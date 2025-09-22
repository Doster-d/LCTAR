import React from 'react'

function TechnicalLanding({ onBackToAR }) {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        textAlign: 'center',
        marginBottom: '40px'
      }}>
        <h1 style={{
          fontSize: '3rem',
          margin: '0 0 20px 0',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>
          🛠️ Техническая информация
        </h1>
        <p style={{
          fontSize: '1.2rem',
          margin: '0',
          opacity: '0.9'
        }}>
          Система дополненной реальности для технических специалистов
        </p>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '800px',
        background: 'rgba(255,255,255,0.1)',
        padding: '30px',
        borderRadius: '15px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.2)'
      }}>
        {/* System Architecture */}
        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '15px' }}>🏗️ Архитектура системы</h2>
          <div style={{ display: 'grid', gap: '15px' }}>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '15px',
              borderRadius: '8px',
              borderLeft: '4px solid #4CAF50'
            }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#4CAF50' }}>Frontend</h3>
              <p style={{ margin: '0' }}>React + Three.js для AR визуализации</p>
              <p style={{ margin: '5px 0 0 0', opacity: '0.8' }}>Использует @react-three/fiber и @zappar/zappar-react-three-fiber</p>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '15px',
              borderRadius: '8px',
              borderLeft: '4px solid #2196F3'
            }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#2196F3' }}>Backend</h3>
              <p style={{ margin: '0' }}>FastAPI + Python для обработки данных и ИИ</p>
              <p style={{ margin: '5px 0 0 0', opacity: '0.8' }}>Инференс моделей, обработка видео, аутентификация</p>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '15px',
              borderRadius: '8px',
              borderLeft: '4px solid #FF9800'
            }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#FF9800' }}>AI Pipeline</h3>
              <p style={{ margin: '0' }}>Машинное обучение для анализа объектов</p>
              <p style={{ margin: '5px 0 0 0', opacity: '0.8' }}>Детекция объектов, измерение высоты, анализ характеристик</p>
            </div>
          </div>
        </section>

        {/* Technical Features */}
        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '15px' }}>⚙️ Технические возможности</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '15px'
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '15px',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📐</div>
              <h3>Измерение высоты</h3>
              <p>Автоматический расчет высоты объектов в реальном времени</p>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '15px',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🎯</div>
              <h3>Детекция объектов</h3>
              <p>Распознавание и классификация объектов в AR пространстве</p>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '15px',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📍</div>
              <h3>Трекинг позиции</h3>
              <p>Отслеживание положения объектов в 3D пространстве</p>
            </div>
          </div>
        </section>

        {/* API Endpoints */}
        <section>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '15px' }}>🔌 API Endpoints</h2>
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            padding: '20px',
            borderRadius: '8px',
            fontFamily: 'monospace'
          }}>
            <div style={{ marginBottom: '10px' }}>
              <span style={{ color: '#4CAF50' }}>POST</span> /api/inference - Запуск ИИ анализа
            </div>
            <div style={{ marginBottom: '10px' }}>
              <span style={{ color: '#2196F3' }}>POST</span> /api/videos - Загрузка видео
            </div>
            <div style={{ marginBottom: '10px' }}>
              <span style={{ color: '#FF9800' }}>GET</span> /api/logs - Получение логов
            </div>
            <div>
              <span style={{ color: '#9C27B0' }}>POST</span> /api/auth/login - Аутентификация
            </div>
          </div>
        </section>
      </main>

      {/* Back Button */}
      <button
        onClick={onBackToAR}
        style={{
          marginTop: '30px',
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
    </div>
  )
}

export default TechnicalLanding
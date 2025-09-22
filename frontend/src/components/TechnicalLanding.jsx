import React from 'react'

function TechnicalLanding({ onBackToAR }) {
    return (
        <div style={{
            width: '100vw',
            minHeight: '100vh',
            color: '#fff',
            background: `
                radial-gradient(ellipse at top, #1a0033 0%, #0d0019 50%, #000000 100%),
                radial-gradient(ellipse at bottom, #2d0038 0%, #1a0024 50%, #000000 100%),
                linear-gradient(135deg, #000000 0%, #1a0033 25%, #2d0044 50%, #1a0033 75%, #000000 100%)
            `,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: '20px',
            fontFamily: '"Cygre", "Inter", "Roboto", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Optimized Animated Grid Background */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
        `,
                backgroundSize: '80px 80px',
                animation: 'gridMove 20s linear infinite',
                zIndex: 0,
                opacity: 0.3
            }} />

            {/* Simple energy waves */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: `
            radial-gradient(circle at 25% 25%, rgba(147, 51, 234, 0.08) 0%, transparent 60%),
            radial-gradient(circle at 75% 75%, rgba(219, 39, 119, 0.08) 0%, transparent 60%)
        `,
                animation: 'energyPulse 15s ease-in-out infinite',
                zIndex: 1
            }} />

            <style jsx>{`
        @keyframes gridMove {
            0% {
                background-position: 0 0, 0 0;
            }
            100% {
                background-position: 80px 80px, 80px 80px;
            }
        }

        @keyframes energyPulse {
            0%, 100% {
                opacity: 0.3;
                transform: scale(1);
            }
            50% {
                opacity: 0.6;
                transform: scale(1.05);
            }
        }

        @keyframes glowLine {
            0% {
                opacity: 0.3;
                box-shadow: 0 0 5px rgba(147, 51, 234, 0.5);
            }
            100% {
                opacity: 1;
                box-shadow: 0 0 20px rgba(147, 51, 234, 1);
            }
        }

        @media (max-width: 768px) {
            .team-row-2 {
                grid-template-columns: 1fr !important;
            }
            .team-row-3 {
                grid-template-columns: 1fr !important;
            }
        }
        `}
            </style>
            <div style={{
                position: 'relative',
                zIndex: 3,
                maxWidth: '1000px',
                width: '90%',
                display: 'flex',
                flexDirection: 'column',
                gap: '30px',
                marginTop: '50px',
                paddingBottom: '50px'
            }}>
                <div style={{
                    background: 'rgba(20, 15, 30, 0.8)',
                    backdropFilter: 'blur(15px)',
                    border: '1px solid rgba(147, 51, 234, 0.3)',
                    borderRadius: '20px',
                    padding: '30px',
                    boxShadow: '0 8px 40px rgba(147, 51, 234, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, transparent 0%, #9333ea 50%, transparent 100%)',
                        animation: 'glowLine 3s ease-in-out infinite alternate'
                    }} />
                    <h1 style={{ margin: '0 0 25px 0', fontSize: '2.2rem', textAlign: 'center', color: '#9333ea' }}>Техническая информация</h1>
                    <h2 style={{ margin: '25px 0 15px 0', color: '#a855f7'}}>Архитектура системы</h2>
                    <h3 style={{ margin: '20px 0 10px 0', color: '#c084fc' }}>Клиентская часть</h3>
                    <p style={{ margin: '0 0 15px 0', lineHeight: '1.6', opacity: '0.9', color: '#e5e7eb' }}>React + Three.js для AR визуализации с использованием @react-three/fiber</p>
                    <h3 style={{ margin: '20px 0 10px 0', color: '#c084fc' }}>Серверная часть</h3>
                    <p style={{ margin: '0 0 15px 0', lineHeight: '1.6', opacity: '0.9', color: '#e5e7eb' }}>FastAPI + Python для обработки данных и ИИ с использованием современных ML фреймворков</p>
                    <h3 style={{ margin: '20px 0 10px 0', color: '#c084fc' }}>Инфраструктура</h3>
                    <p style={{ margin: '0', lineHeight: '1.6', opacity: '0.9', color: '#e5e7eb' }}>Docker контейнеризация с балансировкой нагрузки и облачным деплоем</p>
                </div>

                <div style={{
                    background: 'rgba(20, 15, 30, 0.8)',
                    backdropFilter: 'blur(15px)',
                    border: '1px solid rgba(147, 51, 234, 0.3)',
                    borderRadius: '20px',
                    padding: '30px',
                    boxShadow: '0 8px 40px rgba(147, 51, 234, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, transparent 0%, #9333ea 50%, transparent 100%)',
                        animation: 'glowLine 3s ease-in-out infinite alternate'
                    }} />
                    <h2 style={{ margin: '0 0 25px 0', color: '#a855f7'}}>Возможности системы</h2>
                    <h3 style={{ margin: '20px 0 10px 0', color: '#c084fc' }}>Возможность 1</h3>
                    <p style={{ margin: '0 0 15px 0', lineHeight: '1.6', opacity: '0.9', color: '#e5e7eb' }}>Автоматический расчет высоты объектов в реальном времени</p>
                    <h3 style={{ margin: '20px 0 10px 0', color: '#c084fc' }}>Возможность 2</h3>
                    <p style={{ margin: '0 0 15px 0', lineHeight: '1.6', opacity: '0.9', color: '#e5e7eb' }}>Распознавание и классификация объектов в AR пространстве</p>
                    <h3 style={{ margin: '20px 0 10px 0', color: '#c084fc' }}>Возможность 3</h3>
                    <p style={{ margin: '0 0 15px 0', lineHeight: '1.6', opacity: '0.9', color: '#e5e7eb' }}>Отслеживание положения объектов в 3D пространстве</p>
                    <h3 style={{ margin: '20px 0 10px 0', color: '#c084fc' }}>Возможность 4</h3>
                    <p style={{ margin: '0 0 15px 0', lineHeight: '1.6', opacity: '0.9', color: '#e5e7eb' }}>Анализ характеристик объектов с помощью машинного обучения</p>
                    <h3 style={{ margin: '20px 0 10px 0', color: '#c084fc' }}>Возможность 5</h3>
                    <p style={{ margin: '0', lineHeight: '1.6', opacity: '0.9', color: '#e5e7eb' }}>Визуализация данных в интерактивном AR интерфейсе</p>
                </div>

                <div style={{
                    background: 'rgba(20, 15, 30, 0.8)',
                    backdropFilter: 'blur(15px)',
                    border: '1px solid rgba(147, 51, 234, 0.3)',
                    borderRadius: '20px',
                    padding: '30px',
                    boxShadow: '0 8px 40px rgba(147, 51, 234, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, transparent 0%, #9333ea 50%, transparent 100%)',
                        animation: 'glowLine 3s ease-in-out infinite alternate'
                    }} />
                    <h2 style={{ margin: '0 0 25px 0', color: '#a855f7' }}>Команда разработки</h2>
                    {/* First row container - 2 developers */}
                    <div className="team-row-2" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '20px',
                        marginBottom: '30px',
                        maxWidth: '400px',
                        marginLeft: 'auto',
                        marginRight: 'auto'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#9333ea', margin: '0 auto 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#fff' }}>
                                ВА
                            </div>
                            <h3 style={{ margin: '0 0 10px 0', color: '#c084fc' }}>Вагулич Александр</h3>
                            <p style={{ margin: '0', opacity: '0.8', color: '#e5e7eb' }}>Lead, UX/UI</p>
                            <p style={{ margin: '10px 0 0 0', fontSize: '0.9rem', opacity: '0.7', color: '#d1d5db' }}>Interface, Graphics</p>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#9333ea', margin: '0 auto 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#fff' }}>
                                АД
                            </div>
                            <h3 style={{ margin: '0 0 10px 0', color: '#c084fc' }}>Алексеев Дмитрий</h3>
                            <p style={{ margin: '0', opacity: '0.8', color: '#e5e7eb' }}>Full-stack</p>
                            <p style={{ margin: '10px 0 0 0', fontSize: '0.9rem', opacity: '0.7', color: '#d1d5db' }}>React, Three.js, AR</p>
                        </div>
                    </div>

                    {/* Second row container - 3 developers */}
                    <div className="team-row-3" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '20px',
                        marginBottom: '30px',
                        maxWidth: '600px',
                        marginLeft: 'auto',
                        marginRight: 'auto'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#9333ea', margin: '0 auto 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#fff' }}>
                                ГА
                            </div>
                            <h3 style={{ margin: '0 0 10px 0', color: '#c084fc' }}>Горбунов Андрей</h3>
                            <p style={{ margin: '0', opacity: '0.8', color: '#e5e7eb' }}>3D-designer, animator</p>
                            <p style={{ margin: '10px 0 0 0', fontSize: '0.9rem', opacity: '0.7', color: '#d1d5db' }}>Blender</p>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#9333ea', margin: '0 auto 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#fff' }}>
                                АР
                            </div>
                            <h3 style={{ margin: '0 0 10px 0', color: '#c084fc' }}>Ахмедов Ринат</h3>
                            <p style={{ margin: '0', opacity: '0.8', color: '#e5e7eb' }}>Backend</p>
                            <p style={{ margin: '10px 0 0 0', fontSize: '0.9rem', opacity: '0.7', color: '#d1d5db' }}>FastAPI</p>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#9333ea', margin: '0 auto 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#fff' }}>
                                ПА
                            </div>
                            <h3 style={{ margin: '0 0 10px 0', color: '#c084fc' }}>Пашкова Арина</h3>
                            <p style={{ margin: '0', opacity: '0.8', color: '#e5e7eb' }}>DevOps Engineer</p>
                            <p style={{ margin: '10px 0 0 0', fontSize: '0.9rem', opacity: '0.7', color: '#d1d5db' }}>Docker, CI/CD</p>
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(147, 51, 234, 0.2)', paddingTop: '20px', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 15px 0', color: '#a855f7' }}>Основные технологии</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                            {['React', 'Three.js', 'Zappar','FastAPI', 'Python', 'Docker', 'PostgreSQL', 'AR'].map(tech => (
                                <span key={tech} style={{
                                    background: 'rgba(147, 51, 234, 0.2)',
                                    color: '#c084fc',
                                    padding: '5px 12px',
                                    borderRadius: '15px',
                                    fontSize: '0.8rem',
                                    border: '1px solid rgba(147, 51, 234, 0.3)'
                                }}>{tech}</span>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{
                    background: 'rgba(20, 15, 30, 0.8)',
                    backdropFilter: 'blur(15px)',
                    border: '1px solid rgba(147, 51, 234, 0.3)',
                    borderRadius: '20px',
                    padding: '30px',
                    boxShadow: '0 8px 40px rgba(147, 51, 234, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, transparent 0%, #9333ea 50%, transparent 100%)',
                        animation: 'glowLine 3s ease-in-out infinite alternate'
                    }} />
                    <h2 style={{ margin: '0 0 25px 0', color: '#a855f7' }}>Дальнейшее развитие</h2>

                    <div style={{ marginBottom: '25px' }}>
                        <h3 style={{ margin: '0 0 15px 0', color: '#c084fc' }}>📊 Планируемые графики и аналитика</h3>
                        <p style={{ margin: '0 0 15px 0', lineHeight: '1.6', opacity: '0.9', color: '#e5e7eb' }}>Интерактивные графики производительности, статистика использования системы, анализ данных в реальном времени.</p>

                        <h3 style={{ margin: '20px 0 15px 0', color: '#c084fc' }}>🚀 Будущие улучшения</h3>
                        <ul style={{ margin: '0', paddingLeft: '20px', color: '#e5e7eb', opacity: '0.9' }}>
                            <li style={{ marginBottom: '8px' }}>Интеграция с облачными AI сервисами</li>
                            <li style={{ marginBottom: '8px' }}>Поддержка мобильных платформ</li>
                            <li style={{ marginBottom: '8px' }}>Расширенная аналитика и отчетность</li>
                            <li style={{ marginBottom: '8px' }}>API для внешних интеграций</li>
                        </ul>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(147, 51, 234, 0.2)', paddingTop: '20px' }}>
                        <h3 style={{ margin: '0 0 15px 0', color: '#a855f7' }}>📚 Документация</h3>
                        <p style={{ margin: '0', lineHeight: '1.6', opacity: '0.9', color: '#e5e7eb' }}>Подробная техническая документация доступна в GitHub репозитории проекта с примерами использования API и руководствами по развертыванию.</p>
                    </div>
                </div>

                <div style={{
                    background: 'rgba(20, 15, 30, 0.8)',
                    backdropFilter: 'blur(15px)',
                    border: '1px solid rgba(147, 51, 234, 0.3)',
                    borderRadius: '20px',
                    padding: '30px',
                    boxShadow: '0 8px 40px rgba(147, 51, 234, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, transparent 0%, #9333ea 50%, transparent 100%)',
                        animation: 'glowLine 3s ease-in-out infinite alternate'
                    }} />
                    {/* Back Button */}
                    <button
                        onClick={onBackToAR}
                        style={{
                            marginTop: '10px',
                            padding: '15px 30px',
                            background: 'linear-gradient(135deg, #9333ea 0%, #a855f7 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            transition: 'all 0.3s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)'
                            e.target.style.transform = 'translateY(-3px) scale(1.05)'
                            e.target.style.boxShadow = '0 8px 30px rgba(147, 51, 234, 0.6)'
                        }}
                        onMouseOut={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #9333ea 0%, #a855f7 100%)'
                            e.target.style.transform = 'translateY(0px) scale(1)'
                        }}
                    >
                        <span style={{ fontSize: '18px' }}>←</span>
                        Вернуться в AR
                    </button>
                </div>
            </div>
        </div>
    )
}

export default TechnicalLanding
// ARScene.jsx
import React, { Suspense, useEffect, useState, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR, createXRStore } from '@react-three/xr'
import { OrbitControls, Environment } from '@react-three/drei'
import { Model } from './components/Model.jsx'
// import { ZapparCamera, InstantTracker, AnchorGroup } from '@zappar/zappar-react-three-fiber'
import { inferenceService } from './services/inferenceService.js'
import ToTechnicalButton from './components/ToTechnicalButton.jsx'

const xrStore = createXRStore()

function SceneContents({ anchors, planeFound }) {
//   const handlePlaneFound = () => {
//     setPlaneFound(true)
//   }

//   const handleAnchorCreated = (anchor) => {
//     setAnchors(prev => [...prev, anchor])
//   }

//   return (
//     <>
//       {/* Zapper Camera */}
//       <ZapparCamera />

//       {/* Instant World Tracker for plane detection */}
//       <InstantTracker
//         onPlaneFound={handlePlaneFound}
//         placementMode="best"
//         placementCameraOffset={[0, 0, -5]}
//       >
//         <ambientLight intensity={0.8} />
//         <directionalLight position={[1, 3, 2]} intensity={1.2} castShadow />

//         {/* Render all anchors */}
//         {anchors.map((anchor) => (
//           <AnchorGroup key={anchor.id}>
//             <Suspense fallback={null}>
//               <Model position={anchor.position} scale={0.8} />
//             </Suspense>
//           </AnchorGroup>
//         ))}

//         {/* Default placement if no anchors */}
//         {anchors.length === 0 && (
//           <AnchorGroup>
//             <Suspense fallback={null}>
//               <Model position={[0, 0, -0.8]} scale={0.8} />
//             </Suspense>
//           </AnchorGroup>
//         )}

//         {/* OrbitControls useful outside AR session; XR will override head pose in AR */}
//         <OrbitControls enablePan={false} />
//         <Environment preset="city" />
//       </InstantTracker>

//       {/* UI for plane detection and placement */}
//       {planeFound && (
//         <div style={{
//           position: 'absolute',
//           top: '60px',
//           left: '16px',
//           background: '#333',
//           color: '#fff',
//           padding: '8px 12px',
//           borderRadius: '4px',
//           fontSize: '14px'
//         }}>
//           ✅ Плоскость обнаружена! Коснитесь экрана для размещения объекта
//         </div>
//       )}
//     </>
//   )
}

function EnterARButton({ enabled }) {
    if (!enabled) return null
    return (
        <button
            onClick={() => xrStore.enterAR()}
            style={{
                position: 'absolute', top: 16, left: 16, zIndex: 10, padding: '8px 14px',
                background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 6, cursor: 'pointer'
            }}
        >Enter AR</button>
    )
}

function PlacementControls({ planeFound, onPlaceObject, onClearAnchors, onRunInference, inferenceLoading }) {
    if (!planeFound) return null

    return (
        <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '12px',
            zIndex: 10,
            flexWrap: 'wrap',
            justifyContent: 'center'
        }}>
            <button
                onClick={onPlaceObject}
                style={{
                    padding: '12px 20px',
                    background: '#4CAF50',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold'
                }}
            >
                📍 Разместить объект
            </button>
            <button
                onClick={onClearAnchors}
                style={{
                    padding: '12px 20px',
                    background: '#f44336',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold'
                }}
            >
                🗑️ Очистить
            </button>
            <button
                onClick={onRunInference}
                disabled={inferenceLoading}
                style={{
                    padding: '12px 20px',
                    background: inferenceLoading ? '#666' : '#2196F3',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: inferenceLoading ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold'
                }}
            >
                {inferenceLoading ? '🔄 Анализ...' : '🤖 Запустить ИИ'}
            </button>
        </div>
    )
}

export default function ARScene({ onSwitchToTechnical }) {
    const [arSupport, setArSupport] = useState('checking')
    const [ready, setReady] = useState(false)
    const [showXR, setShowXR] = useState(false)
    const [anchors, setAnchors] = useState([])
    const [planeFound, setPlaneFound] = useState(false)
    const canvasCreatedRef = useRef(false)

    // Inference состояние
    const [inferenceResult, setInferenceResult] = useState(null)
    const [inferenceLoading, setInferenceLoading] = useState(false)
    const [inferenceError, setInferenceError] = useState(null)

    useEffect(() => {
        let mounted = true
            ; (async () => {
                try {
                    if ('xr' in navigator) {
                        const ok = await navigator.xr.isSessionSupported('immersive-ar')
                        if (mounted) setArSupport(ok ? 'supported' : 'unsupported')
                    } else if (mounted) setArSupport('unsupported')
                } catch { if (mounted) setArSupport('unsupported') }
            })()
        return () => { mounted = false }
    }, [])

    useEffect(() => { if (ready) Promise.resolve().then(() => setShowXR(true)) }, [ready])

    const handlePlaceObject = () => {
        // Create new anchor at current camera position
        const newAnchor = {
            id: Date.now().toString(),
            position: [0, 0, -0.8],
            rotation: [0, 0, 0],
            created: Date.now()
        }
        setAnchors(prev => [...prev, newAnchor])
    }

    const handleClearAnchors = () => {
        setAnchors([])
    }

    const handleAnchorClick = (anchorId) => {
        console.log('Anchor clicked:', anchorId)
        // Future: Add anchor-specific interactions
    }

    const handleRunInference = async () => {
        try {
            setInferenceLoading(true)
            setInferenceError(null)

            const result = await inferenceService.runInference()

            setInferenceResult(result)
            console.log('Inference completed successfully:', result)

            // Показываем уведомление об успехе
            setTimeout(() => {
                setInferenceResult(null)
            }, 5000)

        } catch (error) {
            console.error('Inference failed:', error)
            setInferenceError(error.message)

            // Скрываем ошибку через 5 секунд
            setTimeout(() => {
                setInferenceError(null)
            }, 5000)
        } finally {
            setInferenceLoading(false)
        }
    }

    return (
          <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#000' }}>
              <EnterARButton enabled={arSupport === 'supported'} />
              <ToTechnicalButton onSwitchToTechnical={onSwitchToTechnical} />
              <PlacementControls
                  planeFound={planeFound}
                  onPlaceObject={handlePlaceObject}
                  onClearAnchors={handleClearAnchors}
                  onRunInference={handleRunInference}
                  inferenceLoading={inferenceLoading}
              />

            {/* Inference Results */}
            {inferenceResult && (
                <div style={{
                    position: 'absolute',
                    top: '120px',
                    right: '16px',
                    background: '#4CAF50',
                    color: '#fff',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    maxWidth: '300px',
                    zIndex: 10
                }}>
                    <h4 style={{ margin: '0 0 8px 0' }}>🎉 Результат ИИ:</h4>
                    <p style={{ margin: '0' }}>
                        Обнаружено: {inferenceResult.detected ? '✅ Да' : '❌ Нет'}<br/>
                        Высота: {inferenceResult.height_m ? `${inferenceResult.height_m.toFixed(2)} м` : 'Не определена'}
                    </p>
                </div>
            )}

            {/* Inference Error */}
            {inferenceError && (
                <div style={{
                    position: 'absolute',
                    top: '120px',
                    right: '16px',
                    background: '#f44336',
                    color: '#fff',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    maxWidth: '300px',
                    zIndex: 10
                }}>
                    <h4 style={{ margin: '0 0 8px 0' }}>❌ Ошибка ИИ:</h4>
                    <p style={{ margin: '0' }}>{inferenceError}</p>
                </div>
            )}

            <Canvas camera={{ position: [0, 1.5, 2], fov: 60 }} onCreated={() => { canvasCreatedRef.current = true; setReady(true) }}>
                {showXR ? (
                    <XR store={xrStore}>
                        <SceneContents
                            anchors={anchors}
                            planeFound={planeFound}
                            onAnchorClick={handleAnchorClick}
                        />
                    </XR>
                ) : (
                    <mesh position={[0, 1.3, -0.8]}><boxGeometry args={[0.1, 0.1, 0.1]} /><meshStandardMaterial color="#444" /></mesh>
                )}
            </Canvas>
        </div>
    )
}

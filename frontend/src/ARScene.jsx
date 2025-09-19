// ARScene.jsx
import React, { Suspense, useEffect, useState, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR, createXRStore } from '@react-three/xr'
import { OrbitControls, Environment } from '@react-three/drei'
import { Model } from './components/Model.jsx'

const xrStore = createXRStore()

function SceneContents() {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[1, 3, 2]} intensity={1.2} castShadow />
      <Suspense fallback={null}>
        {/* Slightly smaller scale for AR, placed just ahead of user */}
        <Model position={[0, 0, -0.8]} scale={0.8} />
      </Suspense>
      {/* OrbitControls useful outside AR session; XR will override head pose in AR */}
      <OrbitControls enablePan={false} />
      <Environment preset="city" />
    </>
  )
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

export default function ARScene() {
    const [arSupport, setArSupport] = useState('checking')
    const [ready, setReady] = useState(false)
    const [showXR, setShowXR] = useState(false)
    const canvasCreatedRef = useRef(false)

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

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#000' }}>
            <EnterARButton enabled={arSupport === 'supported'} />
            <Canvas camera={{ position: [0, 1.5, 2], fov: 60 }} onCreated={() => { canvasCreatedRef.current = true; setReady(true) }}>
                {showXR ? (
                    <XR store={xrStore}>
                        <SceneContents />
                    </XR>
                ) : (
                    <mesh position={[0, 1.3, -0.8]}><boxGeometry args={[0.1, 0.1, 0.1]} /><meshStandardMaterial color="#444" /></mesh>
                )}
            </Canvas>
        </div>
    )
}

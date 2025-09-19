import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR, useXR } from '@react-three/xr'
import { OrbitControls, Environment } from '@react-three/drei'
import { Model } from '../public/Testmodel.jsx'

// Simple ground reference (non-rendered plane for shadows could be added later)
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

function EnterARButton() {
  const xr = useXR()
  return (
    <button
      onClick={() => xr.enterAR()}
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 10,
        padding: '8px 14px',
        background: '#222',
        color: '#fff',
        border: '1px solid #444',
        borderRadius: 6,
        cursor: 'pointer'
      }}
    >Enter AR</button>
  )
}

export default function ARScene() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <Canvas camera={{ position: [0, 1.5, 2], fov: 60 }}>
        <XR>
          <SceneContents />
          <EnterARButton />
        </XR>
      </Canvas>
    </div>
  )
}

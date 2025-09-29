import React, { forwardRef, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

/**
 * @brief Меш куба с различными цветами граней для дебага сцены.
 * @param size Длина ребра куба.
 */
export const DebugCube = forwardRef(({ size = 0.12, ...props }, ref) => {
  const meshRef = useRef(null)

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BoxGeometry(size, size, size)
    const colors = new Float32Array(geo.attributes.position.count * 3)
    const palette = [
      new THREE.Color('#ff4d4f'), // +X
      new THREE.Color('#8c1c1d'), // -X
      new THREE.Color('#52c41a'), // +Y
      new THREE.Color('#1f6f1a'), // -Y
      new THREE.Color('#1890ff'), // +Z
      new THREE.Color('#152773')  // -Z
    ]

    for (let face = 0; face < 6; face += 1) {
      const color = palette[face]
      for (let vertex = 0; vertex < 6; vertex += 1) {
        const index = (face * 6 + vertex) * 3
        colors[index] = color.r
        colors[index + 1] = color.g
        colors[index + 2] = color.b
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.1,
      roughness: 0.35
    })

    return { geometry: geo, material: mat }
  }, [size])

  useEffect(() => {
    if (!ref) return
    if (typeof ref === 'function') ref(meshRef.current)
    else ref.current = meshRef.current
  }, [ref])

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} {...props} />
  )
})

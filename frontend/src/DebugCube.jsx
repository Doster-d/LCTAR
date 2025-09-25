import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export default function DebugCube() {
  const ref = useRef();
  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += 0.7 * delta;
    ref.current.rotation.y += 0.5 * delta;
  });
  return (
    <mesh ref={ref} position={[0.6, -0.6, -1]}>
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshStandardMaterial emissive={'hotpink'} emissiveIntensity={1.0} />
    </mesh>
  );
}

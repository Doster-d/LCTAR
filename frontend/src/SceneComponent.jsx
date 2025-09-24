import React, { Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Matrix4 } from 'three';
import * as THREE from 'three';

function isMatrixValid(matrixArray) {
  return Boolean(matrixArray && Array.isArray(matrixArray) &&
                matrixArray.length === 16 &&
                matrixArray.every(val => val !== null && val !== undefined && !isNaN(val)));
}

function setProjectionFromIntrinsics(camera, fx, fy, cx, cy, w, h, near=0.01, far=100) {
  const P = new Matrix4()
  const m00 = 2*fx/w, m11 = 2*fy/h
  const m02 = 1 - 2*cx/w, m12 = 2*cy/h - 1
  const m22 = (far+near)/(near-far), m23 = (2*far*near)/(near-far)
  P.set(
    m00, 0,   m02, 0,
    0,   m11, m12, 0,
    0,   0,   m22, m23,
    0,   0,  -1,   0
  )
  camera.projectionMatrix.copy(P)
  // camera.projectionMatrixInverse.copy(P.clone().invert())
  camera.projectionMatrixInverse.copy(P.clone())
}

function TagNode({ matrixArray, color='red' }) {
  const ref = React.useRef()

  // Проверяем валидность матрицы
  const isValidMatrix = isMatrixValid(matrixArray)

  // Отладка: проверка получения matrixArray в TagNode
  console.error(`❌ [TagNode ${color}] Получен matrixArray:`, matrixArray);

  const mat = React.useMemo(() => {
    if (isValidMatrix) {
      try {
        const matrix = new Matrix4().fromArray(matrixArray)
        return matrix
      } catch (error) {
        console.error(`❌ [TagNode] Ошибка создания матрицы для цвета ${color}:`, error)
        return new Matrix4() // Возвращаем единичную матрицу
      }
    }
    console.warn(`⚠️ [TagNode] Неверная матрица для цвета ${color}, используем единичную`)
    return new Matrix4() // Возвращаем единичную матрицу
  }, [matrixArray, isValidMatrix])

  React.useLayoutEffect(() => {
    if (ref.current) {
      ref.current.matrix.copy(mat)
      ref.current.matrixWorldNeedsUpdate = true
      ref.current.updateMatrixWorld(true)
      // Отладка: проверка применения matrix.copy(mat)
      console.error(`❌ [TagNode ${color}] Применена matrix.copy(mat):`, mat.toArray());
    }
  }, [mat])
  return (
    <group ref={ref}>
      <mesh>
        <boxGeometry args={[1,1,1]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

function Scene({ transforms, pipelineRef, videoWidth, videoHeight, anchorMatrix }) {
  const { camera } = useThree();

  React.useEffect(() => {
    // Делаем камеру полностью статической
    camera.position.set(0, 0, 0);
    camera.updateMatrix();

    // Настраиваем проекционную матрицу камеры
    if (pipelineRef.current && videoWidth && videoHeight) {
      const intrinsics = pipelineRef.current.getCameraInfo();
      setProjectionFromIntrinsics(
        camera,
        intrinsics.fx,
        intrinsics.fy,
        intrinsics.cx,
        intrinsics.cy,
        videoWidth,
        videoHeight
      );
      // Отладка: проверка настройки камеры (статическая ли)
      console.error(`❌ [Scene] Камера настроена: position=`, camera.position.toArray(), `matrix=`, camera.matrix.toArray());
    }
  }, [camera, pipelineRef, videoWidth, videoHeight]);

  return (
    <>
      {/* Рендерим контент в якоре, зафиксированном на AprilTag, но в мировой системе AlvaAR */}
      {anchorMatrix && (
        <group matrixAutoUpdate={false} matrix={new Matrix4().fromArray(anchorMatrix)}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.08, 0.08, 0.08]} />
            <meshStandardMaterial color={'orange'} />
          </mesh>
        </group>
      )}
      <ambientLight intensity={0.4} />
      <directionalLight position={[2.5, 8, 5]} intensity={1.5} />
    </>
  );
}

function SceneComponent({ transforms, pipelineRef, videoWidth, videoHeight, anchorMatrix }) {
  return (
    <Canvas style={{ height: '100vh', position: 'relative', zIndex: 1 }}>
      <Scene
        transforms={transforms}
        pipelineRef={pipelineRef}
        videoWidth={videoWidth}
        videoHeight={videoHeight}
        anchorMatrix={anchorMatrix}
      />
    </Canvas>
  );
}

export default SceneComponent;
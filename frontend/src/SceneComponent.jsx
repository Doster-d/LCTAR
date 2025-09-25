import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Matrix4 } from 'three';
function isMatrixValid(matrixArray) {
  return Boolean(matrixArray && Array.isArray(matrixArray) &&
    matrixArray.length === 16 &&
    matrixArray.every(val => val !== null && val !== undefined && !isNaN(val)));
}

function setProjectionFromIntrinsics(camera, fx, fy, cx, cy, w, h, near=0.01, far=100) {
  const P = new Matrix4();
  const m00 = 2*fx/w, m11 = 2*fy/h;
  const m02 = 1 - 2*cx/w, m12 = 2*cy/h - 1;
  const m22 = (far+near)/(near-far), m23 = (2*far*near)/(near-far);
  P.set(
    m00, 0,   m02, 0,
    0,   m11, m12, 0,
    0,   0,   m22, m23,
    0,   0,  -1,   0
  );
  camera.projectionMatrix.copy(P);
  // camera.projectionMatrixInverse.copy(P.clone().invert());
}

function Scene({ transforms, pipelineRef, videoWidth, videoHeight, anchorMatrix }) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 0, 0);
    camera.matrixAutoUpdate = false;
    camera.updateMatrix();
    camera.updateMatrixWorld(true);

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
    }
  }, [camera, pipelineRef, videoWidth, videoHeight]);

  return (
    <>
      {anchorMatrix && (
        <group matrixAutoUpdate={false} matrix={new Matrix4().fromArray(anchorMatrix)}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.08, 0.08, 0.08]} />
            <meshStandardMaterial color={'orange'} />
          </mesh>
        </group>
      )}
      {/* Пример для отрисовки найденных тэгов, если нужно:
      {transforms.map((t, i) => (
        <group key={i} matrixAutoUpdate={false} matrix={new Matrix4().fromArray(t.matrix)}>
          <mesh>
            <boxGeometry args={[0.08,0.08,0.08]} />
            <meshStandardMaterial color="blue" />
          </mesh>
        </group>
      ))} */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[2.5, 8, 5]} intensity={1.5} />
    </>
  );
}

export default function SceneComponent(props) {
  return <Scene {...props} />;
}

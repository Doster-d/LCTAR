import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";

const toEven = (n) => (n & 1 ? n - 1 : n);

// Shared texture singleton so remounts reuse the same texture and avoid repeated creation
// Add a short dispose debounce to avoid disposing/creating textures during quick remounts
const SHARED = { tex: null, owners: 0, disposeTimer: null };

export default function CameraBackground({ videoRef, canvasRef, lockCanvasToVideo = true }) {
  const meshRef = useRef();
  const textureRef = useRef(null);
  const { gl, viewport } = useThree();
  const [ready, setReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const localIdRef = useRef(Math.random().toString(36).slice(2, 8));

  // watch for video metadata to know when dimensions are available
  useEffect(() => {
    const v = videoRef?.current;
    if (!v) return;
    const onMeta = () => setReady(true);
    v.addEventListener('loadedmetadata', onMeta);
    setReady(v.readyState >= 2);
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [videoRef]);

  // create a single texture once (video preferred, canvas fallback)
  useEffect(() => {
    const id = localIdRef.current;
    console.log(`[DEBUG] CameraBackground(${id}): mount`);

    // If shared texture exists reuse it
    if (SHARED.tex) {
      // cancel pending dispose if any
      if (SHARED.disposeTimer) { clearTimeout(SHARED.disposeTimer); SHARED.disposeTimer = null; }
      textureRef.current = SHARED.tex;
      SHARED.owners += 1;
      setMapReady(true);
      console.log(`[DEBUG] CameraBackground(${id}): attached existing shared texture; owners=${SHARED.owners}`);
      return () => {
        SHARED.owners -= 1;
        console.log(`[DEBUG] CameraBackground(${id}): unmount; owners=${SHARED.owners}`);
        if (SHARED.owners <= 0) {
          // debounce disposal to avoid churn when remounting rapidly
          SHARED.disposeTimer = setTimeout(() => {
            try { SHARED.tex.dispose(); } catch (e) { /* ignore */ }
            SHARED.tex = null;
            SHARED.disposeTimer = null;
            console.log(`[DEBUG] CameraBackground(${id}): disposed shared texture after debounce`);
          }, 500);
        }
        setMapReady(false);
      };
    }

    // helper to create VideoTexture
    const tryCreateVideoTexture = (v) => {
      if (!v || v.readyState < 2 || v.videoWidth <= 0) return null;
      try {
        const t = new THREE.VideoTexture(v);
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.generateMipmaps = false;
        if ('SRGBColorSpace' in THREE && THREE.SRGBColorSpace) {
          try { t.colorSpace = THREE.SRGBColorSpace; } catch (e) { /* ignore */ }
        }
        return t;
      } catch (e) {
        console.warn(`[DEBUG] CameraBackground(${id}): VideoTexture creation failed`, e);
        return null;
      }
    };

    // Attempt VideoTexture first
    const v = videoRef?.current;
    let created = null;
    if (v) created = tryCreateVideoTexture(v);

    // If not, try canvas fallback (temporary)
    if (!created) {
      const c = canvasRef?.current;
      if (c) {
        try {
          created = new THREE.CanvasTexture(c);
          created.minFilter = THREE.LinearFilter;
          created.magFilter = THREE.LinearFilter;
          created.generateMipmaps = false;
          if ('SRGBColorSpace' in THREE && THREE.SRGBColorSpace) {
            try { created.colorSpace = THREE.SRGBColorSpace; } catch (e) { /* ignore */ }
          }
        } catch (err2) {
          console.error(`[DEBUG] CameraBackground(${id}): CanvasTexture creation failed`, err2);
        }
      }
    }

    if (created) {
      SHARED.tex = created;
      SHARED.owners = 1;
      textureRef.current = created;
      setMapReady(true);
      console.log(`[DEBUG] CameraBackground(${id}): created shared ${created instanceof THREE.VideoTexture ? 'VideoTexture' : 'CanvasTexture'} `);
    }

    // Watch for the video to become ready and swap in a VideoTexture if necessary
    let onMeta = null;
    if (!(SHARED.tex instanceof THREE.VideoTexture) && videoRef?.current) {
      onMeta = () => {
        const tv = tryCreateVideoTexture(videoRef.current);
        if (tv) {
          // dispose old shared texture and replace
          try { if (SHARED.tex) SHARED.tex.dispose(); } catch (e) { /* ignore */ }
          SHARED.tex = tv;
          textureRef.current = tv;
          setMapReady(true);
          console.log(`[DEBUG] CameraBackground(${id}): swapped to VideoTexture after video ready`);
        }
      };
      videoRef.current.addEventListener('loadedmetadata', onMeta);
    }

    return () => {
      const id2 = localIdRef.current;
      console.log(`[DEBUG] CameraBackground(${id2}): unmount`);
      if (onMeta && videoRef?.current) videoRef.current.removeEventListener('loadedmetadata', onMeta);
      // decrement owners; dispose only when last owner unmounts
      if (SHARED.tex) {
        SHARED.owners -= 1;
        console.log(`[DEBUG] CameraBackground(${id2}): owners=${SHARED.owners}`);
        if (SHARED.owners <= 0) {
          try { SHARED.tex.dispose(); } catch (e) { /* ignore */ }
          SHARED.tex = null;
        }
      }
      textureRef.current = null;
      setMapReady(false);
    };
  }, [videoRef, canvasRef, ready]);

  // keep GL canvas size in sync with video when requested
  useEffect(() => {
    if (!ready || !videoRef?.current || !lockCanvasToVideo) return;
    const w = toEven(videoRef.current.videoWidth);
    const h = toEven(videoRef.current.videoHeight);
    // Avoid forcing renderer size here; resizing the root Canvas can cause remounts.
    // The VideoCanvas / r3f layer manages canvas size. We keep this effect no-op to avoid churn.
    if (w && h) {
      console.debug('[DEBUG] CameraBackground: video size available', w, h, '— not forcing gl.setSize to avoid remounts');
    }
  }, [ready, gl, lockCanvasToVideo, videoRef]);

  // update texture each frame
  useFrame(() => {
    const tex = textureRef.current;
    if (!meshRef.current || !tex) return;
    meshRef.current.scale.set(viewport.width, viewport.height, 1);
    try { tex.needsUpdate = true; } catch (e) { /* ignore */ }
  });

  const map = textureRef.current;
  if (!mapReady) return null;
  return (
    <mesh ref={meshRef} position={[0, 0, -1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} toneMapped={false} />
    </mesh>
  );
}

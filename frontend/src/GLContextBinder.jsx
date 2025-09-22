import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import pipeline from './zapparPipeline';
import './consoleCapture'; // ensure console capture loaded

// Attempts to bind the WebGL context to Zappar pipeline manually.
export default function GLContextBinder() {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    if (!gl) return;
    // Some builds expose underlying context at gl.getContext?. Otherwise gl is already renderer.
    try {
      const ctx = gl.getContext ? gl.getContext() : gl.getContext?.('webgl2') || gl?.context || gl;
      if (ctx) {
        // The actual API name is guessed; log to see what's available.
        const possible = Object.keys(pipeline).filter(k => k.toLowerCase().includes('gl'));
        console.info('[GLContextBinder] Possible pipeline GL methods:', possible);
        // Heuristic: look for glContextSet or setGLContext
        const setter = pipeline.glContextSet || pipeline.setGLContext || pipeline.setGlContext || pipeline.gl_context_set;
        if (setter) {
          setter.call(pipeline, ctx);
          console.info('[GLContextBinder] Bound GL context to pipeline.');
        } else {
          console.warn('[GLContextBinder] No GL context setter method found on pipeline. Keys:', Object.keys(pipeline));
        }
      } else {
        console.warn('[GLContextBinder] Could not obtain raw WebGL context');
      }
    } catch (e) {
      console.error('[GLContextBinder] Failed to bind GL context', e);
    }
  }, [gl]);
  return null;
}

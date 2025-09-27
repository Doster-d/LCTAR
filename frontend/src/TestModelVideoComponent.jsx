import React, { useRef, useState, useEffect, Suspense, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Model } from './models/Train';

// Video background component for React Three Fiber
function VideoBackground({ videoRef }) {
  const textureRef = useRef(null);
  const { viewport } = useThree();

  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBAFormat;
    textureRef.current = texture;

    return () => {
      texture.dispose();
    };
  }, [videoRef]);

  useFrame(() => {
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
    }
  });

  if (!textureRef.current) return null;

  return (
    <mesh position={[0, 0, -2]}>
      <planeGeometry args={[viewport.width, viewport.height]} />
      <meshBasicMaterial map={textureRef.current} />
    </mesh>
  );
}

const TestModelVideoComponent = () => {
  const videoRef = useRef(null);
  const mixCanvasRef = useRef(null);
  const mixCtxRef = useRef(null);
  const [videoStream, setVideoStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const animationRef = useRef(null);

  // Initialize camera stream
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }
        });
        setVideoStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setCameraError('Unable to access camera. Please check permissions.');
      }
    };

    startCamera();

    // Cleanup function
    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Handle video ready state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setIsVideoReady(true);
      setupCompositeCanvas();
    };

    const handleCanPlay = () => {
      video.play().catch(console.error);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [videoStream]);

  const setupCompositeCanvas = useCallback(() => {
    const video = videoRef.current;
    const mixCanvas = mixCanvasRef.current;
    if (!video || !mixCanvas || !video.videoWidth) return;

    // Set up 2D canvas for compositing
    mixCanvas.width = window.innerWidth;
    mixCanvas.height = window.innerHeight;
    const ctx = mixCanvas.getContext('2d');
    mixCtxRef.current = ctx;

    // Start render loop
    const render = () => {
      if (ctx && video.videoWidth > 0) {
        // Clear canvas
        ctx.clearRect(0, 0, mixCanvas.width, mixCanvas.height);

        // Calculate video aspect ratio and positioning
        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = mixCanvas.width / mixCanvas.height;

        let drawWidth, drawHeight, drawX, drawY;

        if (videoAspect > canvasAspect) {
          // Video is wider than canvas aspect ratio
          drawWidth = mixCanvas.width;
          drawHeight = mixCanvas.width / videoAspect;
          drawX = 0;
          drawY = (mixCanvas.height - drawHeight) / 2;
        } else {
          // Video is taller than canvas aspect ratio
          drawWidth = mixCanvas.height * videoAspect;
          drawHeight = mixCanvas.height;
          drawX = (mixCanvas.width - drawWidth) / 2;
          drawY = 0;
        }

        // Draw video frame
        ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();
  }, []);

  // Loading fallback component
  const LoadingFallback = () => (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: 'white',
      fontSize: '18px',
      textAlign: 'center',
      zIndex: 10
    }}>
      Loading 3D Model...
    </div>
  );

  // Error display component
  const ErrorDisplay = ({ error }) => (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: 'red',
      fontSize: '16px',
      textAlign: 'center',
      zIndex: 10,
      padding: '20px',
      background: 'rgba(0,0,0,0.8)',
      borderRadius: '8px'
    }}>
      <p>⚠️ Error: {error}</p>
      <p>Please check camera permissions and refresh the page.</p>
    </div>
  );

  // 3D Scene component
  const Scene3D = () => {
    return (
      <>
        {/* Video background */}
        <VideoBackground videoRef={videoRef} />

        {/* Lighting setup */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[5, 5, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-5, -5, -5]} intensity={0.5} color="#ffffff" />

        {/* Environment lighting */}
        <Environment preset="city" />

        {/* 3D Model - positioned in front of video background */}
        <Suspense fallback={null}>
          <group position={[0, -0.5, 0]}>
            <Model scale={[0.8, 0.8, 0.8]} />
          </group>
        </Suspense>

        {/* Camera controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={15}
          maxPolarAngle={Math.PI / 1.5}
          minPolarAngle={Math.PI / 6}
          target={[0, -0.5, 0]}
        />
      </>
    );
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100vh',
      background: '#000',
      overflow: 'hidden'
    }}>
      {/* Hidden video element for camera stream */}
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        playsInline
        muted
        autoPlay
      />

      {/* Composite canvas for video background */}
      <canvas
        ref={mixCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: isVideoReady ? 'block' : 'none',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />

      {/* Display camera error if any */}
      {cameraError && <ErrorDisplay error={cameraError} />}

      {/* 3D Canvas - renders on top */}
      {isVideoReady && !cameraError && (
        <Canvas
          camera={{
            position: [0, 0, 5],
            fov: 50,
            near: 0.1,
            far: 1000
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 2
          }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
          }}
          onCreated={({ gl }) => {
            gl.setClearColor('#000000', 0);
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }}
        >
          <Scene3D />
        </Canvas>
      )}

      {/* Loading overlay */}
      {!isVideoReady && !cameraError && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontSize: '18px',
          textAlign: 'center',
          zIndex: 10
        }}>
          <p>Initializing camera...</p>
          <div style={{
            marginTop: '10px',
            width: '40px',
            height: '40px',
            border: '4px solid #333',
            borderTop: '4px solid #fff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Instructions overlay */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        color: 'white',
        fontSize: '14px',
        background: 'rgba(0,0,0,0.6)',
        padding: '10px',
        borderRadius: '8px',
        zIndex: 5
      }}>
        <p><strong>Controls:</strong></p>
        <p>• Drag to rotate view</p>
        <p>• Scroll to zoom</p>
        <p>• Right-click drag to pan</p>
      </div>
    </div>
  );
};

export default TestModelVideoComponent;
// src/App.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import ApriltagPipeline from "./apriltagPipeline";

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function fmt(ms) {
  const s = Math.floor(ms / 1000);
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}
function pickMime() {
  const list = [
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of list) if (MediaRecorder.isTypeSupported?.(t)) return t;
  return "";
}

export default function ARRecorder() {
  const mixRef = useRef(null);     // конечный 2D-canvas
  const procRef = useRef(null);    // hidden processing canvas (fixed 640x480 for OpenCV)
  const pctxRef = useRef(null);    // cached 2D context for processing canvas
  const camRef = useRef(null);     // <video> с камерой
  const glCanvasRef = useRef(null);// offscreen WebGL canvas
  const ctxRef = useRef(null);

  // Three.js
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const cubeRef = useRef(null);
  const pyramidMapRef = useRef(new Map());
  const pyramidGeoRef = useRef(null);
  const pyramidMatRef = useRef(null);
  const trainPrefabRef = useRef(null);
  const trainMapRef = useRef(new Map());

  // Streams / recorder
  const camStreamRef = useRef(null);
  const micStreamRef = useRef(null);
  const rafIdRef = useRef(0);
  const recRef = useRef(null); // { recorder, chunks, mime, ext }

  // UI state
  const [status, setStatus] = useState("Нужен HTTPS или localhost");
  const [withMic, setWithMic] = useState(true);
  const [fps, setFps] = useState(30);
  const [running, setRunning] = useState(false);
  const [recOn, setRecOn] = useState(false);
  const [dl, setDl] = useState(null); // { url, name, size }
  const [time, setTime] = useState("00:00");
  const t0Ref = useRef(0);
  const tidRef = useRef(0);

  // AprilTag state
  const [aprilTagTransforms, setAprilTagTransforms] = useState([]);
  const aprilTagPipelineRef = useRef(null);

  // init renderer + scene once
  useEffect(() => {
    const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    gl.domElement.style.display = "none"; // offscreen
    document.body.appendChild(gl.domElement);
    glCanvasRef.current = gl.domElement;

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1.2));

    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.15, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x55a8ff, roughness: 0.5, metalness: 0.1 })
    );
    cube.position.set(0, 0, -0.6);
    scene.add(cube);

    // Pyramid debug geometry (a 4-sided cone) and material
    const pyramidGeo = new THREE.ConeGeometry(0.08, 0.12, 4);
    // rotate so flat base aligns with tag plane if needed (adjust by -Math.PI/4 to align square)
    pyramidGeo.rotateY(-Math.PI / 4);
    const pyramidMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.2, roughness: 0.6, transparent: true, opacity: 0.95 });
    pyramidGeoRef.current = pyramidGeo;
    pyramidMatRef.current = pyramidMat;

    // Load Train GLB to use as a debug model (cloned per-detection)
    try {
      const loader = new GLTFLoader();
      loader.load(
        'models/Train-transformed.glb',
        (gltf) => {
          const obj = gltf.scene || gltf.scenes?.[0];
          if (!obj) return;
          // Normalize scale and orientation for AR placement
          obj.scale.set(0.6, 0.6, 0.6);
          obj.traverse((n) => {
            if (n.isMesh) {
              n.castShadow = false;
              n.receiveShadow = false;
            }
          });
          obj.visible = false; // keep prefab hidden
          trainPrefabRef.current = obj;
        },
        undefined,
        (err) => { console.warn('Failed to load Train model:', err); }
      );
    } catch (e) {
      console.warn('GLTFLoader not available or failed to load model', e);
    }

    rendererRef.current = gl;
    sceneRef.current = scene;
    cameraRef.current = cam;
    cubeRef.current = cube;

    const mix = mixRef.current;
    // request a context optimized for frequent readbacks
    ctxRef.current = mix.getContext("2d", { willReadFrequently: true });
    try {
      ctxRef.current.imageSmoothingEnabled = true;
      ctxRef.current.imageSmoothingQuality = "high";
    } catch (e) {
      /* ignore if not supported */
    }

    // create a hidden processing canvas fixed at 640x480 for OpenCV/AprilTag
    const proc = document.createElement("canvas");
    proc.width = 640; proc.height = 480;
    proc.style.display = "none";
    document.body.appendChild(proc);
    // enable high-quality scaling on processing canvas and cache its 2D context
    try {
      const pctxInit = proc.getContext("2d", { willReadFrequently: true });
      pctxInit.imageSmoothingEnabled = true;
      pctxInit.imageSmoothingQuality = "high";
      pctxRef.current = pctxInit;
    } catch (e) { /* ignore */ }
    procRef.current = proc;

    setStatus((location.protocol === "https:" || location.hostname === "localhost") ? "Готово" : "Нужен HTTPS или localhost");

    return () => {
      try { gl.dispose(); } catch {}
      try { gl.domElement.remove(); } catch {}
      try { procRef.current?.remove(); } catch {}
    };
  }, []);

  // Initialize AprilTag pipeline
  useEffect(() => {
    const initAprilTag = async () => {
      try {
        const pipeline = new ApriltagPipeline();
        await pipeline.init();
        aprilTagPipelineRef.current = pipeline;
        setStatus("AprilTag pipeline готово");
      } catch (error) {
        console.error("Failed to initialize AprilTag pipeline:", error);
        setStatus("Ошибка AprilTag pipeline");
      }
    };

    initAprilTag();

    return () => {
      if (aprilTagPipelineRef.current) {
        // Cleanup AprilTag pipeline if needed
      }
    };
  }, []);

  const sizeAll = useCallback(() => {
    const video = camRef.current;
    const mix = mixRef.current;
    const gl = rendererRef.current;
    const cam = cameraRef.current;
    if (!video || !video.videoWidth || !gl || !cam) return;
    // Keep processing canvas at fixed 640x480 for OpenCV contract
    const pw = 640, ph = 480;
    // For display we want to fill the viewport with a higher internal resolution
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const displayW = Math.max(video.videoWidth, Math.floor(window.innerWidth * dpr));
    const displayH = Math.max(video.videoHeight, Math.floor(window.innerHeight * dpr));
    // Set visible canvas internal size larger for crisp display while keeping CSS 100%
    mix.width = displayW; mix.height = displayH;
    gl.setSize(displayW, displayH, false);
    cam.aspect = displayW / displayH;
    cam.updateProjectionMatrix();

    mix.style.width = "100%";
    mix.style.height = "100%";
  }, []);

  // main render loop
  const renderLoop = useCallback(() => {
    const ctx = ctxRef.current;
    const video = camRef.current;
    const gl = rendererRef.current;
    const scene = sceneRef.current;
    const cam = cameraRef.current;
    const glCanvas = glCanvasRef.current;
    const cube = cubeRef.current;
    const pipeline = aprilTagPipelineRef.current;
    if (!ctx || !video || !gl || !scene || !cam || !glCanvas) return;

    // 1) фон: камера
    ctx.drawImage(video, 0, 0, mixRef.current.width, mixRef.current.height);

    // Also draw into fixed-size processing canvas (640x480) for OpenCV/AprilTag
    try {
      const proc = procRef.current;
      const pctx = pctxRef.current || (proc && proc.getContext && proc.getContext("2d"));
      if (proc && pctx && video.videoWidth && video.videoHeight) {
        // Prefer createImageBitmap with high-quality resize when available
        if (typeof createImageBitmap === "function") {
          try {
            // createImageBitmap can accept a video element and resize it with high quality
            // note: this is async and may reduce max FPS, but gives better downscale quality
            (async () => {
              try {
                const bitmap = await createImageBitmap(video, { resizeWidth: proc.width, resizeHeight: proc.height, resizeQuality: 'high' });
                pctx.clearRect(0, 0, proc.width, proc.height);
                pctx.drawImage(bitmap, 0, 0);
                bitmap.close?.();
              } catch (e) {
                // fallback
                pctx.drawImage(video, 0, 0, proc.width, proc.height);
              }
            })();
          } catch (e) {
            pctx.drawImage(video, 0, 0, proc.width, proc.height);
          }
        } else {
          pctx.drawImage(video, 0, 0, proc.width, proc.height);
        }
      }
    } catch (err) {
      console.warn("proc draw failed", err);
    }

    // 2) AprilTag detection
    try {
      if (pipeline && video.videoWidth > 0 && video.videoHeight > 0) {
        // Create ImageData from the fixed processing canvas (640x480) so OpenCV sees expected size
        const proc = procRef.current;
        const pctx = pctxRef.current || (proc && proc.getContext && proc.getContext("2d"));
        if (pctx) {
          try { pctx.imageSmoothingEnabled = true; pctx.imageSmoothingQuality = 'high'; } catch (e) {}
        }
        try {
          const imageData = pctx ? pctx.getImageData(0, 0, proc.width, proc.height) : ctx.getImageData(0, 0, video.videoWidth, video.videoHeight);
          const transforms = pipeline.detect(imageData);
          // Update state with detected transforms
          setAprilTagTransforms(transforms);

          // Update pyramid debug objects in the scene immediately
            try {
              const scene = sceneRef.current;
              const modelMap = trainMapRef.current;
              const prefab = trainPrefabRef.current;
              const seenIds = new Set();

              transforms.forEach(t => {
                const id = t.id;
                seenIds.add(id);
                let obj = modelMap.get(id);
                if (!obj) {
                  if (prefab) {
                    obj = prefab.clone(true);
                    obj.matrixAutoUpdate = false;
                    scene.add(obj);
                    modelMap.set(id, obj);
                  } else {
                    // If prefab missing, fallback to a small box so we still see something
                    obj = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: 0xffcc00 }));
                    obj.matrixAutoUpdate = false;
                    scene.add(obj);
                    modelMap.set(id, obj);
                  }
                }

                const m = new THREE.Matrix4();
                try {
                  m.fromArray(t.matrix);
                } catch (e) {
                  return;
                }
                // lift model slightly above tag plane so it doesn't Z-fight
                const up = new THREE.Matrix4().makeTranslation(0, 0.06, 0);
                m.multiply(up);
                obj.matrix.copy(m);
              });

              // Remove models for tags not present
              for (const [key, obj] of Array.from(modelMap.entries())) {
                if (!seenIds.has(key)) {
                  obj.removeFromParent();
                  modelMap.delete(key);
                }
              }
            } catch (e) {
              console.warn('Failed to update Train models', e);
            }
        } catch (err) {
          console.error('Error reading imageData for detection', err);
        }
      }
    } catch (error) {
      console.error("AprilTag detection error:", error);
    }

    // 3) three.js
    cube.rotation.y += 0.01;
    cube.rotation.x += 0.005;
    gl.render(scene, cam);
    // 4) композит
    ctx.drawImage(glCanvas, 0, 0, mixRef.current.width, mixRef.current.height);

    rafIdRef.current = requestAnimationFrame(renderLoop);
  }, []);

  // camera control
  const startCamera = useCallback(async () => {
    try {
      // stop previous
      cancelAnimationFrame(rafIdRef.current);
      if (camStreamRef.current) { camStreamRef.current.getTracks().forEach(t => t.stop()); camStreamRef.current = null; }
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }

      let camStream = null;
      // Try exact 640x480 first to avoid browser up/down-scaling artifacts
      try {
        camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { exact: 640 }, height: { exact: 480 }, frameRate: 30 }, audio: false });
        console.log('Acquired exact 640x480 stream');
      } catch (err) {
        console.warn('Exact 640x480 failed, falling back to ideal 1280x720:', err);
        camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false });
      }
      camStreamRef.current = camStream;
      camRef.current.srcObject = camStream;
      try { camRef.current.setAttribute('playsinline', 'true'); } catch (e) {}
      try { camRef.current.style.objectFit = 'cover'; } catch (e) {}
      await camRef.current.play();
      sizeAll();

      // Configure AprilTag pipeline with camera info
      if (aprilTagPipelineRef.current) {
        const videoTrack = camStream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        const width = settings.width || 640;
        const height = settings.height || 480;

        // Try to request the camera deliver 640x480 directly to avoid heavy resizing artifacts.
        try {
          await videoTrack.applyConstraints({ width: 640, height: 480, frameRate: 30 });
          const newSettings = videoTrack.getSettings();
             console.log('Applied track constraints, new settings:', newSettings);
        } catch (e) {
          // not all browsers/devices allow changing track resolution; ignore
          console.warn('Could not apply 640x480 constraints to video track:', e);
        }

        // Set camera intrinsics for AprilTag detection
        // Using reasonable default values for focal length (can be adjusted based on camera specs)
        const fx = width * 0.8; // Approximate focal length based on width
        const fy = height * 0.8; // Approximate focal length based on height
        const cx = width / 2;   // Center x
        const cy = height / 2;  // Center y

        try {
          aprilTagPipelineRef.current.set_camera_info(fx, fy, cx, cy);
          console.log(`AprilTag camera info configured: ${fx}, ${fy}, ${cx}, ${cy}`);
        } catch (error) {
          console.warn("Failed to configure AprilTag camera info:", error);
        }
      }

      if (withMic) {
        try {
          micStreamRef.current = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
        } catch { micStreamRef.current = null; }
      }

      rafIdRef.current = requestAnimationFrame(renderLoop);
      setRunning(true);
      setStatus("Камера активна");
    } catch (e) {
      setStatus(`Ошибка камеры: ${e.name}`);
    }
  }, [renderLoop, sizeAll, withMic]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafIdRef.current);
    if (camStreamRef.current) { camStreamRef.current.getTracks().forEach(t => t.stop()); camStreamRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    if (camRef.current) camRef.current.srcObject = null;

    // Clear AprilTag transforms when camera stops
    setAprilTagTransforms([]);

    setRunning(false);
    setStatus("Камера остановлена");
  }, []);

  // recording
  const startRecording = useCallback(() => {
    const canvas = mixRef.current;
    if (!canvas) return;
    const stream = canvas.captureStream(Math.max(1, fps|0));
    if (withMic && micStreamRef.current) {
      const track = micStreamRef.current.getAudioTracks()[0];
      if (track) stream.addTrack(track);
    }
    const mime = pickMime();
    const ext = mime.includes("mp4") ? "mp4" : "webm";

    let recorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (e) {
      setStatus(`MediaRecorder: ${e.name}`);
      return;
    }
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const type = recorder.mimeType || (chunks[0]?.type || "video/webm");
      const blob = new Blob(chunks, { type });
      const url = URL.createObjectURL(blob);
      const name = `ar_cam_${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`;
      setDl({ url, name, size: (blob.size / 1048576).toFixed(2) });
      setRecOn(false);
      setStatus("Готово");
    };
    recorder.start(100);
    recRef.current = { recorder, chunks, mime, ext };

    // timer
    t0Ref.current = Date.now();
    setTime("00:00");
    clearInterval(tidRef.current);
    tidRef.current = setInterval(() => setTime(fmt(Date.now() - t0Ref.current)), 250);

    setRecOn(true);
    setDl(null);
    setStatus(`Запись: ${recorder.mimeType || "auto"}`);
  }, [fps, withMic]);

  const stopRecording = useCallback(() => {
    const r = recRef.current?.recorder;
    if (r && r.state !== "inactive") {
      r.stop();
      clearInterval(tidRef.current);
    }
  }, []);

  // interactions
  useEffect(() => {
    const mix = mixRef.current;
    if (!mix) return;

    const onPointerDown = (e) => {
      const rect = mix.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const cube = cubeRef.current;
      if (!cube) return;
      cube.position.x = x * 0.5;
      cube.position.y = y * 0.5;
    };

    const onWheel = (e) => {
      e.preventDefault();
      const cube = cubeRef.current;
      if (!cube) return;
      const factor = Math.exp(-e.deltaY * 0.001);
      cube.scale.z = clamp(cube.scale.z * factor, 0.05, 10);
    };

    mix.addEventListener("pointerdown", onPointerDown);
    mix.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      mix.removeEventListener("pointerdown", onPointerDown);
      mix.removeEventListener("wheel", onWheel);
    };
  }, []);

  // resize when video metadata ready
  useEffect(() => {
    const v = camRef.current;
    if (!v) return;
    const onMeta = () => sizeAll();
    v.addEventListener("loadedmetadata", onMeta);
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [sizeAll]);

  // cleanup on unmount
  useEffect(() => () => {
    stopRecording();
    stopCamera();
    clearInterval(tidRef.current);
  }, [stopCamera, stopRecording]);

  return (
    <div style={{
      height: "100vh",
      background: "#1a1a1a",
      position: "relative",
      overflow: "hidden"
    }}>

      {/* Enhanced UI Container - Bottom positioned */}
      <div id="ui" style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        background: "rgba(0, 0, 0, 0.9)",
        borderTop: "1px solid #333",
        padding: "10px",
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }}>
        {/* Status Bar */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#e0e0e0",
          fontSize: "12px",
          fontWeight: "500"
        }}>
          <div style={{
            display: "flex",
            gap: "20px",
            alignItems: "center"
          }}>
            {/* Timer */}
            <div style={{
              padding: "4px 8px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              fontSize: "12px",
              fontWeight: "600",
              color: "#fff",
              fontFamily: "monospace"
            }}>
              {time}
            </div>

            {/* AprilTag Counter */}
            <div style={{
              padding: "4px 8px",
              borderRadius: "8px",
              background: aprilTagTransforms.length > 0
                ? "rgba(0, 255, 136, 0.2)"
                : "rgba(255, 255, 255, 0.1)",
              border: aprilTagTransforms.length > 0
                ? "1px solid rgba(0, 255, 136, 0.4)"
                : "1px solid rgba(255, 255, 255, 0.2)",
              fontSize: "11px",
              fontWeight: "600",
              color: aprilTagTransforms.length > 0 ? "#00ff88" : "#e0e0e0",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}>
              <div style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: aprilTagTransforms.length > 0 ? "#00ff88" : "#666",
                animation: aprilTagTransforms.length > 0 ? "blink 2s ease-in-out infinite" : "none"
              }} />
              AprilTags: {aprilTagTransforms.length}
            </div>

            {/* Download Link */}
            {dl && (
              <a href={dl.url} download={dl.name} style={{
                padding: "6px 12px",
                borderRadius: "8px",
                background: "#5514db",
                color: "#fff",
                textDecoration: "none",
                fontSize: "11px",
                fontWeight: "600",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 8px 25px rgba(102, 126, 234, 0.6)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.4)";
              }}
              >
                Download {dl.name} ({dl.size} MB)
              </a>
            )}
          </div>

          {/* Status */}
          <div style={{
            padding: "4px 8px",
            borderRadius: "8px",
            background: "rgba(85, 20, 219, 0.2)",
            border: "1px solid rgba(85, 20, 219, 0.3)",
            color: "#b794f6",
            fontSize: "11px",
            fontWeight: "500"
          }}>
            {status}
          </div>
        </div>

        {/* Control Groups */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          flexWrap: "wrap"
        }}>
          {/* Camera Controls Group */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px"
          }}>
            <h4 style={{
              color: "#e0e0e0",
              fontSize: "12px",
              fontWeight: "600",
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "1px",
              opacity: 0.8
            }}>
              Камера
            </h4>
            <div style={{
              display: "flex",
              gap: "12px"
            }}>
              <button onClick={startCamera} disabled={running} style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #333",
                background: running ? "#666" : "#4ecdc4",
                color: "#fff",
                fontSize: "12px",
                fontWeight: "600",
                cursor: running ? "not-allowed" : "pointer",
                opacity: running ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!running) {
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow = "0 8px 25px rgba(78, 205, 196, 0.6)";
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = running
                  ? "0 4px 15px rgba(255, 107, 107, 0.3)"
                  : "0 6px 20px rgba(78, 205, 196, 0.4)";
              }}
              >
                Start
              </button>
              <button onClick={stopCamera} disabled={!running} style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #333",
                background: !running ? "#666" : "#ff6b6b",
                color: "#fff",
                fontSize: "12px",
                fontWeight: "600",
                cursor: !running ? "not-allowed" : "pointer",
                opacity: !running ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (running) {
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow = "0 8px 25px rgba(255, 236, 210, 0.6)";
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = !running
                  ? "0 4px 15px rgba(255, 107, 107, 0.3)"
                  : "0 6px 20px rgba(255, 236, 210, 0.4)";
              }}
              >
                Stop
              </button>
            </div>
          </div>

          {/* Audio Controls Group */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px"
          }}>
            <h4 style={{
              color: "#e0e0e0",
              fontSize: "12px",
              fontWeight: "600",
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "1px",
              opacity: 0.8
            }}>
              Аудио
            </h4>
            <label style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              padding: "6px 12px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)"
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.1)";
              e.target.style.borderColor = "rgba(255, 255, 255, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.05)";
              e.target.style.borderColor = "rgba(255, 255, 255, 0.1)";
            }}
            >
              <input
                type="checkbox"
                checked={withMic}
                onChange={(e) => setWithMic(e.target.checked)}
                style={{
                  accentColor: "#5514db",
                  transform: "scale(1.2)"
                }}
              />
              <span style={{
                color: "#e0e0e0",
                fontSize: "14px",
                fontWeight: "500"
              }}>
                Microphone
              </span>
            </label>
          </div>

          {/* Quality Controls Group */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px"
          }}>
            <h4 style={{
              color: "#e0e0e0",
              fontSize: "12px",
              fontWeight: "600",
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "1px",
              opacity: 0.8
            }}>
              Качество
            </h4>
            <label style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)"
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.1)";
              e.target.style.borderColor = "rgba(255, 255, 255, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.05)";
              e.target.style.borderColor = "rgba(255, 255, 255, 0.1)";
            }}
            >
              <span style={{
                color: "#e0e0e0",
                fontSize: "14px",
                fontWeight: "500"
              }}>
                FPS:
              </span>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                style={{
                  background: "rgba(85, 20, 219, 0.2)",
                  border: "1px solid rgba(85, 20, 219, 0.4)",
                  borderRadius: "6px",
                  color: "#e0e0e0",
                  padding: "2px 8px",
                  fontSize: "11px",
                  fontWeight: "500",
                  cursor: "pointer",
                  outline: "none"
                }}
              >
                <option value={30}>30</option>
                <option value={60}>60</option>
              </select>
            </label>
          </div>

          {/* Recording Controls Group */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px"
          }}>
            <h4 style={{
              color: "#e0e0e0",
              fontSize: "12px",
              fontWeight: "600",
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "1px",
              opacity: 0.8
            }}>
              Запись
            </h4>
            <div style={{
              display: "flex",
              gap: "12px"
            }}>
              <button onClick={startRecording} disabled={!running || recOn} style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #333",
                background: (!running || recOn) ? "#666" : "#ff0080",
                color: "#fff",
                fontSize: "12px",
                fontWeight: "600",
                cursor: (!running || recOn) ? "not-allowed" : "pointer",
                opacity: (!running || recOn) ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (running && !recOn) {
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow = "0 8px 25px rgba(255, 0, 128, 0.6)";
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = (!running || recOn)
                  ? "0 4px 15px rgba(255, 107, 107, 0.3)"
                  : "0 6px 20px rgba(255, 0, 128, 0.4)";
              }}
              >
                Record
              </button>
              <button onClick={stopRecording} disabled={!recOn} style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #333",
                background: !recOn ? "#666" : "#ff6b6b",
                color: "#fff",
                fontSize: "12px",
                fontWeight: "600",
                cursor: !recOn ? "not-allowed" : "pointer",
                opacity: !recOn ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (recOn) {
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow = "0 8px 25px rgba(255, 236, 210, 0.6)";
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = !recOn
                  ? "0 4px 15px rgba(255, 107, 107, 0.3)"
                  : "0 6px 20px rgba(255, 236, 210, 0.4)";
              }}
              >
                Stop
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Canvas */}
      <canvas
        id="mix"
        ref={mixRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          position: "relative",
          zIndex: 1
        }}
      />
      <video
        id="cam"
        ref={camRef}
        playsInline
        muted
        style={{ display: "none" }}
      />

      {/* CSS Animations */}
      <style jsx>{` 
        select:focus {
          border-color: #5514db !important;
        }
      `}</style>
    </div>
  );
}

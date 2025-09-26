// src/App.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
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
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4;codecs=h264,aac",
    "video/mp4"
  ];
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of list) if (MediaRecorder.isTypeSupported?.(t)) return t;
  return "";
}

export default function ARRecorder() {
  const mixRef = useRef(null);     // конечный 2D-canvas
  const camRef = useRef(null);     // <video> с камерой
  const glCanvasRef = useRef(null);// offscreen WebGL canvas
  const ctxRef = useRef(null);

  // Three.js
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const cubeRef = useRef(null);

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

    rendererRef.current = gl;
    sceneRef.current = scene;
    cameraRef.current = cam;
    cubeRef.current = cube;

    const mix = mixRef.current;
    ctxRef.current = mix.getContext("2d");

    setStatus((location.protocol === "https:" || location.hostname === "localhost") ? "Готово" : "Нужен HTTPS или localhost");

    return () => {
      try { gl.dispose(); } catch {}
      try { gl.domElement.remove(); } catch {}
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

    const w = video.videoWidth, h = video.videoHeight;
    mix.width = w; mix.height = h;
    gl.setSize(w, h, false);
    cam.aspect = w / h;
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

    // 2) AprilTag detection
    try {
      if (pipeline && video.videoWidth > 0 && video.videoHeight > 0) {
        // Create ImageData from the video frame
        const imageData = ctx.getImageData(0, 0, video.videoWidth, video.videoHeight);
        const transforms = pipeline.detect(imageData);

        // Update state with detected transforms
        setAprilTagTransforms(transforms);
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

      const camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      camStreamRef.current = camStream;
      camRef.current.srcObject = camStream;
      await camRef.current.play();
      sizeAll();

      // Configure AprilTag pipeline with camera info
      if (aprilTagPipelineRef.current) {
        const videoTrack = camStream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        const width = settings.width || 640;
        const height = settings.height || 480;

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
    <div style={{ height: "100vh", background: "#000" }}>
      <div id="ui" style={{
        position: "fixed", inset: "0 0 auto 0", display: "flex", gap: 8, alignItems: "center",
        flexWrap: "wrap", padding: 10, zIndex: 10, backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)", background: "color-mix(in srgb, Canvas, transparent 70%)"
      }}>
        <button onClick={startCamera} disabled={running}>Старт</button>
        <button onClick={stopCamera} disabled={!running}>Стоп</button>

        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={withMic} onChange={(e) => setWithMic(e.target.checked)} />
          микрофон
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          FPS:
          <select value={fps} onChange={(e) => setFps(Number(e.target.value))}>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </label>

        <button onClick={startRecording} disabled={!running || recOn}>Запись</button>
        <button onClick={stopRecording} disabled={!recOn}>Стоп запись</button>

        <span style={{ padding: "2px 8px", borderRadius: 999, background: "#00000030", fontSize: 12 }}>{time}</span>

        <span style={{ padding: "2px 8px", borderRadius: 999, background: aprilTagTransforms.length > 0 ? "#00ff0030" : "#00000030", fontSize: 12 }}>
          AprilTags: {aprilTagTransforms.length}
        </span>

        {dl ? (
          <a href={dl.url} download={dl.name} style={{ marginLeft: 8 }}>
            Скачать {dl.name} ({dl.size} MB)
          </a>
        ) : null}

        <span style={{ marginLeft: "auto", opacity: 0.8, fontSize: 12 }}>{status}</span>
      </div>

      <canvas id="mix" ref={mixRef} style={{ width: "100%", height: "100%", display: "block" }} />
      <video id="cam" ref={camRef} playsInline muted style={{ display: "none" }} />
    </div>
  );
}

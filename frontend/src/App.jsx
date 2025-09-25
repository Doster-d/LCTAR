/* @refresh reset */
import React, { useRef, useEffect, useState, Suspense, startTransition } from 'react';
import ConsolePanel from './ConsolePanel';
import { VideoCanvas } from "./lib/r3f-video-recorder";
import CameraBackground from "./CameraBackground";
import FileSaver from "file-saver";
import { loadAlva, poseToMatrix4 } from './alvaBridge';
import { Matrix4, Vector3, Quaternion } from 'three';
const SceneComponent = React.lazy(() => import('./SceneComponent'));
import DebugCube from './DebugCube';

function App({ onSwitchToLanding }) {
  class CameraErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }
    componentDidCatch(error, info) {
      console.error('[CameraErrorBoundary] Caught error in CameraBackground:', error, info);
    }
    render() {
      if (this.state.hasError) {
        return null;
      }
      return this.props.children;
    }
  }
  const [transforms, setTransforms] = useState([]);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [anchorMatrix, setAnchorMatrix] = useState(null);
  const [PipelineClass, setPipelineClass] = useState(null);

  const [stream, setStream] = useState(null);
  const [showDebugVideo, setShowDebugVideo] = useState(false);
  const [mgr, setMgr] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const r3fStateRef = useRef(null);
  const recPromiseRef = useRef(null);

  const rafIdRef = useRef(0);
  const loopStartedRef = useRef(false);
  const lastSizeRef = useRef({ w: 0, h: 0 });
  const lastDetKeyRef = useRef('');
  const isStartingRef = useRef(false);

  const videoRef = useRef(null);
  const debugVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const pipelineRef = useRef(null);
  const alvaRef = useRef(null);

  const anchorLockedRef = useRef(false);
  const isActiveRef = useRef(false);

  // --- запись (тоггл) ---
  const toggleRecord = async () => {
    if (!mgr) return;
    if (!isRecording) {
      recPromiseRef.current = mgr
        .record({ mode: "realtime", fps: 30, size: "1x" })
        .then((blob) => FileSaver.saveAs(blob, "capture.mp4"))
        .catch(console.error);
      setIsRecording(true);
    } else {
      mgr?.recording?.stop();
      await recPromiseRef.current;
      setIsRecording(false);
    }
  };

  // --- фото PNG из WebGL-канваса ---
  const takePhoto = () => {
    const canvas = r3fStateRef.current?.gl?.domElement;
    if (!canvas) return;
    canvas.toBlob((blob) => blob && FileSaver.saveAs(blob, `photo_${Date.now()}.png`), 'image/png');
  };

  // --- загрузка пайплайна ---
  useEffect(() => {
    import('./apriltagPipeline').then(module => {
      setPipelineClass(() => module.default);
    });
  }, []);

  // helper: извлечь {R,t} из детекторного 4x4 массива (three.js column-major)
  const rtFromMatrixArray = (arr) => {
    try {
      const m = new Matrix4().fromArray(arr);
      const pos = new Vector3();
      const quat = new Quaternion();
      const scl  = new Vector3();
      m.decompose(pos, quat, scl);

      const Rm = new Matrix4().makeRotationFromQuaternion(quat);
      const e = Rm.elements; // column-major
      // row-major 3x3
      const R = new Float64Array([
        e[0], e[4], e[8],
        e[1], e[5], e[9],
        e[2], e[6], e[10],
      ]);
      const t = new Float64Array([pos.x, pos.y, pos.z]);
      return { R, t };
    } catch {
      return null;
    }
  };

  // --- инициализация камеры и обработки кадров ---
  useEffect(() => {
    if (!PipelineClass) return;
    isActiveRef.current = true;

    // Guarded camera starter with fallback and wait-for-play
    const waitForVideoPlayable = (videoEl, timeoutMs = 3000) => {
      return new Promise((resolve, reject) => {
        if (!videoEl) return reject(new Error('no video element'));
        if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) return resolve();
        let timedOut = false;
        const to = setTimeout(() => { timedOut = true; reject(new Error('video play timeout')); }, timeoutMs);
        const onPlaying = () => { if (timedOut) return; clearTimeout(to); videoEl.removeEventListener('playing', onPlaying); resolve(); };
        videoEl.addEventListener('playing', onPlaying);
      });
    };

    const startCamera = async (constraints = { video: { facingMode: { ideal: 'environment' } }, audio: false }) => {
      if (isStartingRef.current) {
        console.warn('[DEBUG] startCamera: already starting, skip');
        return;
      }
      isStartingRef.current = true;
      try {
        console.log('[DEBUG] startCamera: Attempting getUserMedia', constraints);
        let s;
        try {
          s = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
          console.warn('[DEBUG] startCamera: primary constraints failed:', e?.name || e);
          // fallback to simpler constraints if facingMode failed
          if (constraints && constraints.video && typeof constraints.video === 'object') {
            try {
              s = await navigator.mediaDevices.getUserMedia({ video: true });
              console.log('[DEBUG] startCamera: fallback {video:true} success');
            } catch (e2) {
              console.error('[DEBUG] startCamera: fallback getUserMedia error:', e2);
              throw e2;
            }
          } else {
            throw e;
          }
        }

        if (!s) throw new Error('No stream returned');
        console.log('[DEBUG] startCamera: getUserMedia success');
        setStream(s);
        // attach to debug video if visible for diagnostics
        try {
          if (debugVideoRef.current) {
            debugVideoRef.current.srcObject = s;
            await debugVideoRef.current.play().catch(()=>{});
            console.log('[DEBUG] startCamera: attached stream to debugVideo');
          }
        } catch (attachErr) {
          console.warn('[DEBUG] startCamera: debug attach failed', attachErr);
        }
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.setAttribute('playsinline', '');
          videoRef.current.muted = true;
          // ensure play succeeds and video dimensions are available
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn('[DEBUG] startCamera: video.play error:', playErr);
          }
          try {
            await waitForVideoPlayable(videoRef.current, 3000);
            console.log('[DEBUG] startCamera: video is playable with size', videoRef.current.videoWidth, videoRef.current.videoHeight);
          } catch (waitErr) {
            console.warn('[DEBUG] startCamera: waitForVideoPlayable failed:', waitErr);
            // continue — pipeline later will check dimensions
          }
        }
      } finally {
        isStartingRef.current = false;
      }
    };

    const init = async () => {
      if (!navigator.mediaDevices?.getUserMedia) { console.error('getUserMedia unsupported'); return; }
      if (!videoRef.current) { console.error('hidden video missing'); return; }

      await startCamera();

      if (pipelineRef.current) return;
      pipelineRef.current = new PipelineClass();
      await pipelineRef.current.init();

      const ensureAlva = async () => {
        const w = videoRef.current.videoWidth, h = videoRef.current.videoHeight;
        if (w && h && !alvaRef.current) alvaRef.current = await loadAlva(w, h);
      };
      await ensureAlva();
      setTimeout(ensureAlva, 1000);
      
      const processFrame = () => {
        if (!isActiveRef.current) return;
        if (!videoRef.current || !canvasRef.current || !pipelineRef.current) { requestAnimationFrame(processFrame); return; }
        if (!videoRef.current.videoWidth) { requestAnimationFrame(processFrame); return; }

        const canvas = canvasRef.current;
        const vW = videoRef.current.videoWidth;
        const vH = videoRef.current.videoHeight;
        if (canvas.width !== vW || canvas.height !== vH) {
          canvas.width = vW;
          canvas.height = vH;
        }
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height, { willReadFrequently: true });

        const detected = pipelineRef.current.detect(imageData) || [];
        const detKey = detected.length + ':' + detected.map(d => d?.id ?? -1).join(',');
        if (detKey !== lastDetKeyRef.current) {
          lastDetKeyRef.current = detKey;
          startTransition(() => setTransforms(detected));
        }

        // подготовить detections для AlvaAR: добавить pose {R,t} из matrix, если нет
        const augDetections = detected.map(d => {
          if (!d) return d;
          if (!d.pose && d.matrix && Array.isArray(d.matrix) && d.matrix.length === 16) {
            const rt = rtFromMatrixArray(d.matrix);
            if (rt) return { ...d, pose: { R: Array.from(rt.R), t: Array.from(rt.t) } };
          }
          return d;
        });

        if (alvaRef.current) {
          // Калибровка: взять fx,fy у пайплайна и cx,cy по центру кадра
          const intr = pipelineRef.current.getCameraInfo?.() || {};
          const fx = intr.fx ?? (canvas.width * 0.5);
          const fy = intr.fy ?? (canvas.height * 0.5);
          const cx = canvas.width * 0.5;
          const cy = canvas.height * 0.5;

          // Поза камеры от VO
          const camPose = alvaRef.current.findCameraPose(imageData);

          // Плоскость: только через AprilTag приоритетно (внутри будет лог через console.error при первом успехе)
          const T_cam_plane = alvaRef.current.findPlaneAuto({
            frame: imageData,
            detections: augDetections,
            K: { fx, fy, cx, cy },
            // tagSizeById: { /* опционально, если нет pose у тегов */ },
            // tagLayout:   { /* опционально для мульти-тегов */ }
          });

          // Фиксируем якорь только если:
          // 1) есть поза камеры, 2) есть detections, 3) T_cam_plane получена
          if (!anchorLockedRef.current && camPose && detected.length > 0 && T_cam_plane) {
            const T_world_cam = poseToMatrix4(camPose);
            const T_cam_plane_m4 = new Matrix4().fromArray(T_cam_plane);
            const T_world_anchor = T_world_cam.clone().multiply(T_cam_plane_m4);
            setAnchorMatrix(T_world_anchor.toArray());
            anchorLockedRef.current = true;
          }
        }

        if (lastSizeRef.current.w !== vW || lastSizeRef.current.h !== vH) {
          lastSizeRef.current = { w: vW, h: vH };
          setVideoSize({ width: vW, height: vH });
        }
        rafIdRef.current = requestAnimationFrame(processFrame);
      };

      videoRef.current.onloadedmetadata = () => {
        const v = videoRef.current;
        const intr = pipelineRef.current.getCameraInfo?.() || {};
        // центр ставим по текущему размеру видеопотока
        pipelineRef.current.set_camera_info?.(intr.fx ?? (v.videoWidth*0.5), intr.fy ?? (v.videoHeight*0.5), v.videoWidth / 2, v.videoHeight / 2);
        if (!loopStartedRef.current) {
          loopStartedRef.current = true;
          rafIdRef.current = requestAnimationFrame(processFrame);
        }
      };

      // fallback
      setTimeout(() => {
        if (!loopStartedRef.current) {
          loopStartedRef.current = true;
          rafIdRef.current = requestAnimationFrame(processFrame);
        }
      }, 3000);
    };

    init();

    return () => {
      isActiveRef.current = false;
      cancelAnimationFrame(rafIdRef.current);
      loopStartedRef.current = false;
      if (videoRef.current) {
        videoRef.current.pause();
        if (videoRef.current.srcObject) {
          videoRef.current.srcObject.getTracks().forEach(t => t.stop());
          videoRef.current.srcObject = null;
        }
      }
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
      }
      pipelineRef.current = null;
      alvaRef.current = null;
      anchorLockedRef.current = false;
    };
  }, [PipelineClass]);

  // --- тоггл камеры (одна кнопка) ---
  const toggleCamera = async () => {
    console.log('[DEBUG] toggleCamera: called, stream:', !!stream);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
      if (videoRef.current) videoRef.current.srcObject = null;
      console.log('[DEBUG] toggleCamera: stopped stream');
    } else {
      await startCamera();
    }
  };

  // debug helper: attach stream to debug video element when toggled
  useEffect(() => {
    if (showDebugVideo && stream && debugVideoRef.current) {
      debugVideoRef.current.srcObject = stream;
      debugVideoRef.current.setAttribute('playsinline', '');
      debugVideoRef.current.muted = true;
      debugVideoRef.current.play().catch(e => console.warn('[DEBUG] debugVideo play error', e));
    }
  }, [showDebugVideo, stream]);

  return (
    <>
      <button onClick={onSwitchToLanding}
              style={{ position:'absolute', top:10, right:10, zIndex:1000 }}>Back to Landing</button>

      <ConsolePanel />

      {/* Панель управления */}
      <div style={{ position:'absolute', top:10, left:10, zIndex:1000, display:'flex', gap:8 }}>
        <button onClick={toggleCamera}>{stream ? 'Камера: стоп' : 'Камера: старт'}</button>
        <button onClick={toggleRecord} disabled={!mgr}>{isRecording ? 'Запись: стоп' : 'Запись: старт'}</button>
        <button onClick={takePhoto}>Фото</button>
        <button onClick={() => setShowDebugVideo(s => !s)}>{showDebugVideo ? 'Hide debug video' : 'Show debug video'}</button>
      </div>

      {/* скрытые источники для CV */}
      <video ref={videoRef} style={{ display:'none' }} />
      {showDebugVideo && <div style={{ position:'absolute', bottom:10, left:10, zIndex:1000, border:'1px solid #444' }}>
        <video ref={debugVideoRef} style={{ width:240, height:180 }} playsInline muted />
      </div>}
      <canvas ref={canvasRef} style={{ display:'none' }} />

      {/* AR-канвас */}
      {/* hoist these props to stable values to avoid remount churn */}
      {(() => {
        const vcStyle = { background: '#000', width: '100vw', height: '100vh' };
        const vcCamera = { position: [0, 0, 2] };
        return (
          <VideoCanvas
            fps={30}
            onCreated={({ state, videoCanvas }) => { r3fStateRef.current = state; setMgr(videoCanvas); }}
            style={vcStyle}
            camera={vcCamera}
          >
            {stream && <CameraErrorBoundary><CameraBackground videoRef={videoRef} canvasRef={canvasRef} lockCanvasToVideo={true} /></CameraErrorBoundary>}
            <Suspense fallback={null}>
              <SceneComponent
                transforms={transforms}
                pipelineRef={pipelineRef}
                videoWidth={videoSize.width}
                videoHeight={videoSize.height}
                anchorMatrix={anchorMatrix}
              />
            </Suspense>
            {/* Debug cube for visibility checks */}
            <DebugCube />
          </VideoCanvas>
        );
      })()}
    </>
  );
}

export default App;

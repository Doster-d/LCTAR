// src/App.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import ApriltagPipeline from "./apriltagPipeline";
import { Canvas } from '@react-three/fiber';
import { Model as TrainModel } from './models/Train';
import { SkeletonUtils } from 'three-stdlib'
import { useGLTF } from '@react-three/drei'
import { averageQuaternion, bestFitPointFromRays, toVector3, clampQuaternion, softenSmallAngleQuaternion } from './lib/anchorMath';
import { loadAlva } from './alvaBridge';
import { startTrainAnimation } from './trainAnimation';
import Landing from './Landing';
import AprilTagLayoutEditor from './AprilTagLayoutEditor';
import {
  startSession as apiStartSession,
  sendViewEvent,
  submitEmail as apiSubmitEmail,
  getSessionProgress,
  getPromoBySession,
  getPromoByUser,
  getStats as apiGetStats,
  getHealth as apiGetHealth,
} from './api/backend';
import { getAssetByDetection } from './data/assets';

/**
 * @brief Ограничивает число указанным диапазоном.
 * @param v Исходное значение.
 * @param a Нижняя граница.
 * @param b Верхняя граница.
 * @returns {number} Значение, зажатое между a и b.
 */
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

/**
 * @brief Форматирует миллисекунды в строку mm:ss.
 * @param ms Длительность в миллисекундах.
 * @returns {string} Отформатированное время.
 */
function fmt(ms) {
  const s = Math.floor(ms / 1000);
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}

/**
 * @brief Подбирает поддерживаемый MIME-тип для записи видео.
 * @returns {string} Предпочтительный MIME-тип или пустую строку при отсутствии поддержки.
 */
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

/**
 * @brief Коэффициент интерполяции позиции якоря между кадрами.
 */
const ANCHOR_POSITION_LERP = 0.05;
/**
 * @brief Коэффициент интерполяции ориентации якоря между кадрами.
 */
const ANCHOR_ROTATION_SLERP = 0.03;
/**
 * @brief Dead zone (радианы), в пределах которой якорь считается без поворота.
 */
const SMALL_ANGLE_DEADZONE = 0.08;
/**
 * @brief Угол (радианы), при превышении которого демпфирование не применяется.
 */
const SMALL_ANGLE_SOFT_ZONE = 0.24;
const APRILTAG_VISIBILITY_HOLD_MS = 3000;
const CV_TO_GL_MATRIX3 = new THREE.Matrix3().set(
  1,  0,  0,
  0, -1,  0,
  0,  0, -1
);
/**
 * @brief Генерирует насыщенный цвет для указанного идентификатора тега.
 * @param tagId Идентификатор AprilTag.
 * @returns {THREE.Color} Детеминированный цвет.
 */
const getRayColor = (tagId) => {
  const hue = ((tagId ?? 0) * 0.173) % 1;
  return new THREE.Color().setHSL(hue, 0.68, 0.53);
};

/**
 * @brief Основной AR-компонент: камера, детектор, отрисовка и запись.
 * @returns {JSX.Element} Узел с разметкой приложения.
 */
function ARRecorder({ onShowLanding }) {
  const mixRef = useRef(null);     // конечный 2D-canvas
  const procRef = useRef(null);    // hidden processing canvas (fixed 640x480 for OpenCV)
  const pctxRef = useRef(null);    // cached 2D context for processing canvas
  const camRef = useRef(null);     // <video> с камерой
  const glCanvasRef = useRef(null);// offscreen WebGL canvas
  const ctxRef = useRef(null);
  const drawRectRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Three.js
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const cubeRef = useRef(null); // anchor group aligned to active scene
  const pyramidMapRef = useRef(new Map());
  const pyramidGeoRef = useRef(null);
  const pyramidMatRef = useRef(null);
  const trainPrefabRef = useRef(null); // Train model prefab captured from R3F scene
  const trainInstanceRef = useRef(null);
  const trainSmoothPosition = useRef(new THREE.Vector3());
  const trainSmoothQuaternion = useRef(new THREE.Quaternion());
  const trainInitialized = useRef(false);
  const lastDetectionTime = useRef(0);
  const debugCubeInstanceRef = useRef(null); // Debug cube instance
  const sceneAnchorsRef = useRef(new Map());
  const anchorDebugMapRef = useRef(new Map());
  const scenePlaneRef = useRef(new Map());
  const activeSceneIdRef = useRef(null);
  const [activeSceneId, setActiveSceneId] = useState(null);
  const alvaRef = useRef(null);
  const lastAlvaUpdateRef = useRef(0);
  const alvaPointsRef = useRef([]);
  const debugCubeRef = useRef(null);
  const sessionIdRef = useRef(null);
  const detectedAssetsRef = useRef(new Set());
  const pendingAssetsRef = useRef(new Set());
  const submittedAssetsRef = useRef(new Set());

  // Streams / recorder
  const camStreamRef = useRef(null);
  const micStreamRef = useRef(null);
  const rafIdRef = useRef(0);
  const recRef = useRef(null); // { recorder, chunks, mime, ext }

  // UI state
  const [status, setStatus] = useState("Нужен HTTPS или localhost");
  const [withMic, setWithMic] = useState(true);

  const [running, setRunning] = useState(false);
  const [recOn, setRecOn] = useState(false);
  const [dl, setDl] = useState(null); // { url, name, size }


  const [time, setTime] = useState("00:00");
  const t0Ref = useRef(0);
  const tidRef = useRef(0);

  // AprilTag state
  const [aprilTagTransforms, setAprilTagTransforms] = useState([]);
  const aprilTagPipelineRef = useRef(null);

  // Backend integration state
  const [sessionId, setSessionId] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [progressState, setProgressState] = useState(null);
  const [promoState, setPromoState] = useState(null);
  const [userState, setUserState] = useState(null);
  const [statsState, setStatsState] = useState(null);
  const [healthState, setHealthState] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [lastViewEvent, setLastViewEvent] = useState(null);
  
  // Прямая загрузка модели поезда
  const trainGltf = useGLTF('./models/Train-transformed.glb');
  
  useEffect(() => {
    if (trainGltf && trainGltf.scene) {
      console.log('🚂 Direct GLTF load success:', trainGltf);
      
      // Создаем группу из загруженной сцены
      const trainGroup = new THREE.Group();
      trainGroup.add(trainGltf.scene.clone());
      trainGroup.name = 'DirectTrainPrefab';
      
      // Настраиваем группу как префаб
      trainGroup.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
      
      trainPrefabRef.current = trainGroup;
      console.log('✅ Direct train prefab set from GLTF');
    } else if (trainGltf === null) {
      // Fallback: создаем простой тестовый куб, если GLTF не загружается
      console.log('⚠️ GLTF failed, creating fallback cube');
      const fallbackGeometry = new THREE.BoxGeometry(0.2, 0.1, 0.4);
      const fallbackMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xff6600,
        metalness: 0.3,
        roughness: 0.7
      });
      const fallbackMesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
      fallbackMesh.name = 'FallbackTrain';
      
      const fallbackGroup = new THREE.Group();
      fallbackGroup.add(fallbackMesh);
      fallbackGroup.position.set(0, 0.05, 0);
      
      trainPrefabRef.current = fallbackGroup;
      console.log('✅ Fallback train cube created');
    }
  }, [trainGltf]);

  /**
   * @brief Создает DebugCube напрямую через Three.js для размещения в центре AR-сцены.
   */
  const createDebugCube = () => {
    console.log('🎯 Creating DebugCube directly with Three.js');
    
    const size = 0.15;
    const geometry = new THREE.BoxGeometry(size, size, size);
    
    // Создаем цветные грани как в оригинальном компоненте
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    const palette = [
      new THREE.Color('#ff4d4f'), // +X (красный)
      new THREE.Color('#8c1c1d'), // -X (темно-красный)
      new THREE.Color('#52c41a'), // +Y (зеленый)
      new THREE.Color('#1f6f1a'), // -Y (темно-зеленый)
      new THREE.Color('#1890ff'), // +Z (синий)
      new THREE.Color('#152773')  // -Z (темно-синий)
    ];

    for (let face = 0; face < 6; face += 1) {
      const color = palette[face];
      for (let vertex = 0; vertex < 6; vertex += 1) {
        const index = (face * 6 + vertex) * 3;
        colors[index] = color.r;
        colors[index + 1] = color.g;
        colors[index + 2] = color.b;
      }
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.1,
      roughness: 0.35
    });

    const debugCube = new THREE.Mesh(geometry, material);
    debugCube.name = 'CenterDebugCube';
    debugCube.position.set(0, 0, 0); // Центр сцены
    debugCube.scale.set(1.5, 1.5, 1.5); // Чуть больше для лучшей видимости
    debugCube.castShadow = true;
    debugCube.receiveShadow = true;

    // Добавляем мини-оси для лучшей ориентации
    const axesHelper = new THREE.AxesHelper(size * 2);
    debugCube.add(axesHelper);
    
    debugCubeInstanceRef.current = debugCube;
    console.log('✅ DebugCube created directly with axes:', debugCube);
  };

  useEffect(() => {
    let cancelled = false;
    const initAlva = async () => {
      try {
        const instance = await loadAlva(window.innerWidth || 640, window.innerHeight || 480);
        if (!cancelled) {
          alvaRef.current = instance;
          console.log('✅ AlvaAR initialized');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('❌ Ошибка инициализации AlvaAR:', err);
        }
      }
    };
    initAlva();
    return () => { cancelled = true; };
  }, []);

  // init renderer + scene once
  useEffect(() => {
    const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    gl.domElement.style.display = "none"; // offscreen
    document.body.appendChild(gl.domElement);
    glCanvasRef.current = gl.domElement;

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1.2));

    // Anchor group is populated once detection delivers a scene transform
    const anchorGroup = new THREE.Group();
    anchorGroup.name = 'AnchorRoot';
    anchorGroup.visible = false;

    const debugGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const debugColors = [];
    const debugPalette = [
      new THREE.Color('#ff4d4f'),
      new THREE.Color('#36cfc9'),
      new THREE.Color('#40a9ff'),
      new THREE.Color('#fadb14'),
      new THREE.Color('#9254de'),
      new THREE.Color('#73d13d')
    ];
    const vertexCount = debugGeometry.getAttribute('position').count;
    for (let i = 0; i < vertexCount; i += 1) {
      const faceColor = debugPalette[Math.floor(i / 6) % debugPalette.length];
      debugColors.push(faceColor.r, faceColor.g, faceColor.b);
    }
    debugGeometry.setAttribute('color', new THREE.Float32BufferAttribute(debugColors, 3));
    const debugMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.45 });
    const debugCube = new THREE.Mesh(debugGeometry, debugMaterial);
    debugCube.name = 'SceneDebugCube';
    const debugEdges = new THREE.LineSegments(new THREE.EdgesGeometry(debugGeometry), new THREE.LineBasicMaterial({ color: 0x111111 }));
    debugCube.add(debugEdges);
    debugCube.visible = false;
    anchorGroup.add(debugCube);
    debugCubeRef.current = debugCube;

    scene.add(anchorGroup);
    cubeRef.current = anchorGroup;

    // Pyramid debug geometry (a 4-sided cone) and material
    const pyramidGeo = new THREE.ConeGeometry(0.08, 0.12, 4);
    // rotate so flat base aligns with tag plane if needed (adjust by -Math.PI/4 to align square)
    pyramidGeo.rotateY(-Math.PI / 4);
    const pyramidMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.2, roughness: 0.6, transparent: true, opacity: 0.95 });
    pyramidGeoRef.current = pyramidGeo;
    pyramidMatRef.current = pyramidMat;

    rendererRef.current = gl;
    sceneRef.current = scene;
    cameraRef.current = cam;

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

    // Диагностика модели поезда
    const checkTrainModel = async () => {
      try {
        const response = await fetch('./models/Train-transformed.glb');
        console.log('🚂 Train model file check:', {
          status: response.status,
          size: response.headers.get('content-length'),
          type: response.headers.get('content-type')
        });
      } catch (error) {
        console.error('❌ Train model file not accessible:', error);
      }
    };
    checkTrainModel();

    // Создаем DebugCube для AR-сцены
    createDebugCube();

    // Запускаем анимацию поезда
    const stopAnimation = startTrainAnimation(trainInstanceRef);

    return () => {
      stopAnimation && stopAnimation();
      try { anchorGroup.removeFromParent(); } catch {}
      try { gl.dispose(); } catch {}
      try { gl.domElement.remove(); } catch {}
      try { procRef.current?.remove(); } catch {}
    };
  }, []);

  /**
   * @brief Сохраняет префаб поезда для последующего клонирования под каждый тег.
   * @param node Экземпляр модели поезда.
   */
  const captureTrainPrefab = (node) => {
    console.log('🚂 captureTrainPrefab called with:', node);
    if (!node) {
      console.warn('⚠️ Train prefab node is null');
      return;
    }
    trainPrefabRef.current = node;
    node.visible = false;
    // Отладочная информация о модели
    let meshCount = 0;
    let materialCount = 0;
    node.traverse((obj) => {
      if (obj.isMesh) {
        meshCount++;
        if (obj.material) materialCount++;
      }
    });
    
    console.log('✅ Train prefab captured:', {
      meshes: meshCount,
      materials: materialCount,
      position: node.position.toArray(),
      scale: node.scale.toArray(),
      children: node.children.length
    });
  };

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

  const handleApiError = useCallback((error, fallbackMessage) => {
    if (!error) {
      setApiError(fallbackMessage);
      return;
    }
    const message = error.message || fallbackMessage || 'API error';
    setApiError(message);
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const stats = await apiGetStats();
      setStatsState(stats);
    } catch (error) {
      handleApiError(error, 'Не удалось получить статистику');
    }
  }, [handleApiError]);

  const refreshPromo = useCallback(async (sid, userId) => {
    try {
      if (userId) {
        const promo = await getPromoByUser(userId);
        setPromoState(promo);
        return;
      }
      const promo = await getPromoBySession(sid);
      setPromoState(promo);
    } catch (error) {
      if (error?.status === 404) {
        setPromoState(null);
        return;
      }
      handleApiError(error, 'Не удалось получить промокод');
    }
  }, [handleApiError]);

  const refreshProgress = useCallback(async (sid) => {
    const sessionKey = sid || sessionIdRef.current;
    if (!sessionKey) return;
    try {
      const progress = await getSessionProgress(sessionKey);
      setProgressState(progress);
      if (progress?.remaining_assets === 0 && (progress?.viewed_assets ?? 0) > 0) {
        await refreshPromo(sessionKey);
      }
    } catch (error) {
      handleApiError(error, 'Не удалось получить прогресс');
    }
  }, [handleApiError, refreshPromo]);

  const fetchHealthStatus = useCallback(async () => {
    try {
      const result = await apiGetHealth();
      setHealthState(result);
    } catch (error) {
      handleApiError(error, 'Сервис недоступен');
    }
  }, [handleApiError]);

  const createSession = useCallback(async () => {
    setSessionLoading(true);
    setApiError(null);
    try {
      const response = await apiStartSession();
      const newSessionId = response?.session_id;
      if (newSessionId) {
        sessionIdRef.current = newSessionId;
        setSessionId(newSessionId);
        if (typeof window !== 'undefined') {
          window.localStorage?.setItem('lctar_session_id', newSessionId);
        }
        detectedAssetsRef.current = new Set();
        pendingAssetsRef.current = new Set();
        submittedAssetsRef.current = new Set();
        setProgressState(null);
        setPromoState(null);
        setUserState(null);
        setLastViewEvent(null);
        await refreshProgress(newSessionId);
      }
    } catch (error) {
      handleApiError(error, 'Не удалось создать сессию');
    } finally {
      setSessionLoading(false);
    }
  }, [handleApiError, refreshProgress]);

  const resetSession = useCallback(async () => {
    if (typeof window !== 'undefined') {
      window.localStorage?.removeItem('lctar_session_id');
    }
    sessionIdRef.current = null;
    setSessionId(null);
    detectedAssetsRef.current = new Set();
    pendingAssetsRef.current = new Set();
    submittedAssetsRef.current = new Set();
    setProgressState(null);
    setPromoState(null);
    setUserState(null);
    setLastViewEvent(null);
    await createSession();
  }, [createSession]);

  const ensureSession = useCallback(async () => {
    if (sessionIdRef.current) {
      await refreshProgress(sessionIdRef.current);
      return;
    }
    if (typeof window !== 'undefined') {
      const saved = window.localStorage?.getItem('lctar_session_id');
      if (saved) {
        sessionIdRef.current = saved;
        setSessionId(saved);
        await refreshProgress(saved);
        return;
      }
    }
    await createSession();
  }, [createSession, refreshProgress]);

  const submitAssetView = useCallback(
    async (assetSlug) => {
      const currentSession = sessionIdRef.current;
      if (!currentSession || !assetSlug) return;
      if (submittedAssetsRef.current.has(assetSlug)) return;
      try {
        const result = await sendViewEvent(currentSession, assetSlug);
        submittedAssetsRef.current.add(assetSlug);
        setLastViewEvent({ slug: assetSlug, result, ts: Date.now() });
        await refreshProgress(currentSession);
        await refreshStats();
        if (result?.promo_code) {
          setPromoState({ promo_code: result.promo_code });
        }
        setApiError(null);
      } catch (error) {
        handleApiError(error, `Не удалось отправить событие для ${assetSlug}`);
      }
    },
    [handleApiError, refreshProgress, refreshStats],
  );

  const flushPendingAssets = useCallback(async () => {
    if (!pendingAssetsRef.current.size) return;
    const assets = Array.from(pendingAssetsRef.current);
    pendingAssetsRef.current.clear();
    for (const slug of assets) {
      // eslint-disable-next-line no-await-in-loop
      await submitAssetView(slug);
    }
  }, [submitAssetView]);
  const handleEmailSubmit = useCallback(
    async (event) => {
      event?.preventDefault?.();
      const trimmed = emailInput.trim();
      const currentSession = sessionIdRef.current;
      if (!currentSession || !trimmed) return;
      setEmailSubmitting(true);
      setApiError(null);
      try {
        const response = await apiSubmitEmail(currentSession, trimmed);
        setUserState(response);
        setEmailInput('');
        await refreshProgress(currentSession);
        if (response?.user_id) {
          await refreshPromo(currentSession, response.user_id);
        }
      } catch (error) {
        handleApiError(error, 'Не удалось привязать email');
      } finally {
        setEmailSubmitting(false);
      }
    },
    [emailInput, handleApiError, refreshProgress, refreshPromo],
  );

  useEffect(() => {
    ensureSession();
    fetchHealthStatus();
    refreshStats();
  }, [ensureSession, fetchHealthStatus, refreshStats]);

  /**
   * @brief Подгоняет размеры канвасов под текущие габариты видео и окна.
   * @returns {void}
   */
  const sizeAll = useCallback(() => {
    const video = camRef.current;
    const mix = mixRef.current;
    const gl = rendererRef.current;
    const cam = cameraRef.current;
    if (!video || !video.videoWidth || !gl || !cam || !mix) return;

    // контейнер = окно * DPR
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const contW = Math.floor(window.innerWidth * dpr);
    const contH = Math.floor(window.innerHeight * dpr);

    // внутренний буфер канваса = размер контейнера
    mix.width = contW;
    mix.height = contH;
    mix.style.width = "100%";
    mix.style.height = "100%";

    // исходное видео
    const srcW = video.videoWidth;
    const srcH = video.videoHeight;

    // масштаб "contain" без апскейла (<=1), чтобы не портить качество
    const scale = Math.min(contW / srcW, contH / srcH);
    const drawW = Math.round(srcW * scale);
    const drawH = Math.round(srcH * scale);
    const drawX = Math.floor((contW - drawW) / 2);
    const drawY = Math.floor((contH - drawH) / 2);

    // сохраним прямоугольник вывода
    drawRectRef.current = { x: drawX, y: drawY, w: drawW, h: drawH };

    // WebGL-канвас рендерим в том же размере, что и видимая область видео
    gl.setSize(drawW, drawH, false);
    cam.aspect = srcW / srcH; // аспект видео
    cam.updateProjectionMatrix();
  }, []);

  /**
   * @brief Объединяет детекции AprilTag в стабилизированные якоря сцены.
   * @param detections Последний набор детекций из пайплайна AprilTag.
   * @returns {Map<string, Array<object>>|null} Детекции, сгруппированные по сценам.
   */
  const updateSceneAnchors = useCallback((detections) => {
    const grouped = new Map();
    cameraRef.current?.updateMatrixWorld?.();
    const cameraRotationMatrix3 = cameraRef.current
      ? new THREE.Matrix3().setFromMatrix4(cameraRef.current.matrixWorld)
      : null;
    detections.forEach(det => {
      if (!det || !det.sceneId) return;
      if (!grouped.has(det.sceneId)) {
        grouped.set(det.sceneId, []);
      }
      grouped.get(det.sceneId).push(det);
    });

    const anchors = sceneAnchorsRef.current;
    const now = performance.now();

    grouped.forEach((list, sceneId) => {
      let state = anchors.get(sceneId);
      if (!state) {
        state = {
          position: null,
          rotation: null,
          targetPosition: null,
          targetRotation: null,
          fallback: new THREE.Vector3(0, 0, -0.6),
          radius: 0.25,
          lastSeen: 0,
          visible: false,
          rays: [],
          lastDetections: []
        };
        anchors.set(sceneId, state);
      }

      const pipeline = aprilTagPipelineRef.current;
      const sceneConfig = pipeline?.getSceneConfig(sceneId) || null;
      const radius = typeof sceneConfig?.diameter === 'number' ? sceneConfig.diameter / 2 : 0.25;

      let fallbackVector = state.fallback ? state.fallback.clone() : new THREE.Vector3(0, 0, -0.6);
      const anchorCenters = [];
      const planeNormals = [];
      const rays = list.map(det => {
        const fallback = toVector3(det?.fallbackCenter, fallbackVector);
        fallbackVector = fallback.clone();
        const origin = toVector3(det.position, fallback);
        let direction = null;
        if (det?.normalCamera && cameraRotationMatrix3) {
          const camNormal = toVector3(det.normalCamera, new THREE.Vector3(0, 0, 1));
          if (camNormal.lengthSq() > 1e-6) {
            const glNormal = camNormal.clone().applyMatrix3(CV_TO_GL_MATRIX3).normalize();
            direction = glNormal.applyMatrix3(cameraRotationMatrix3).normalize();
          }
        }
        if (!direction) {
          direction = toVector3(det.normal, new THREE.Vector3(0, 1, 0));
          if (direction.lengthSq() < 1e-6) direction.set(0, 1, 0);
          direction.normalize();
        }
        if (direction.lengthSq() < 1e-6) direction.set(0, 1, 0);
        planeNormals.push(direction.clone());
        const length = typeof det.normalLength === 'number' ? det.normalLength : 0;
        const anchor = toVector3(det.anchorPoint, origin.clone().addScaledVector(direction, length));
        anchorCenters.push(anchor.clone());
        return { origin, direction, anchor, length, tagId: det.id };
      });

      const unionCenter = anchorCenters.length
        ? anchorCenters.reduce((acc, vec) => acc.add(vec), new THREE.Vector3()).multiplyScalar(1 / anchorCenters.length)
        : null;

      let targetPosition = null;
      if (rays.length >= 2) {
        const solution = bestFitPointFromRays(rays.map(ray => ({ origin: ray.origin, direction: ray.direction })));
        if (solution) targetPosition = solution;
      }
      if (!targetPosition && rays.length > 0) {
        const sum = rays.reduce((acc, ray) => acc.add(ray.anchor.clone()), new THREE.Vector3());
        targetPosition = sum.multiplyScalar(1 / rays.length);
      }
      if (!targetPosition) {
        targetPosition = unionCenter ? unionCenter.clone() : fallbackVector.clone();
      }

      const quaternions = list.map(det => {
        const matrixArray = det.rotationMatrix || det.matrixBase || det.matrix;
        const matrix = new THREE.Matrix4();
        if (Array.isArray(matrixArray) && matrixArray.length === 16) {
          matrix.fromArray(matrixArray);
        } else {
          matrix.identity();
        }
        const quat = new THREE.Quaternion().setFromRotationMatrix(matrix);
        return clampQuaternion(quat);
      });
      let targetRotation = quaternions.length ? averageQuaternion(quaternions) : null;
      if (!targetRotation) {
        targetRotation = state.targetRotation ? state.targetRotation.clone() : new THREE.Quaternion();
      }
      clampQuaternion(targetRotation);
      targetRotation = softenSmallAngleQuaternion(targetRotation, SMALL_ANGLE_DEADZONE, SMALL_ANGLE_SOFT_ZONE);

      if (planeNormals.length) {
              const normalAvg = planeNormals.reduce((acc, vec) => acc.add(vec), new THREE.Vector3()).normalize();
              const up = new THREE.Vector3(0, 1, 0);
              let tangent = new THREE.Vector3().crossVectors(up, normalAvg);
              if (tangent.lengthSq() < 1e-6) {
                tangent = new THREE.Vector3(1, 0, 0);
              }
              tangent.normalize();
              const bitangent = new THREE.Vector3().crossVectors(normalAvg, tangent).normalize();
              const rotationMatrix = new THREE.Matrix4().makeBasis(tangent, bitangent, normalAvg);
              targetRotation = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
            }

      const planeInfo = scenePlaneRef.current.get(sceneId);
      if (planeInfo) {
        const planeNormal = planeInfo.normal.clone();
        const planePoint = planeInfo.position.clone();
        if (unionCenter) {
          const toPoint = unionCenter.clone().sub(planePoint);
          const distance = planeNormal.dot(toPoint);
          const projected = unionCenter.clone().sub(planeNormal.clone().multiplyScalar(distance));
          targetPosition = projected;
        } else {
          targetPosition = planePoint;
        }
        if (!planeNormals.length) {
          const up = new THREE.Vector3(0, 1, 0);
          let tangent = new THREE.Vector3().crossVectors(up, planeNormal);
          if (tangent.lengthSq() < 1e-6) tangent = new THREE.Vector3(1, 0, 0);
          tangent.normalize();
          const bitangent = new THREE.Vector3().crossVectors(planeNormal, tangent).normalize();
          const rotationMatrix = new THREE.Matrix4().makeBasis(tangent, bitangent, planeNormal);
          targetRotation = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
        }
      }

      state.fallback = fallbackVector.clone();
      state.radius = radius;
      state.targetPosition = targetPosition.clone();
      state.targetRotation = targetRotation.clone();
      state.lastSeen = now;
      state.visible = true;
      state.rays = rays;
      state.lastDetections = list;
      state.plane = planeInfo || null;

      if (!state.position) state.position = targetPosition.clone();
      if (!state.rotation) state.rotation = targetRotation.clone();

      anchors.set(sceneId, state);
    });

    anchors.forEach((state, sceneId) => {
      const timeSinceSeen = now - (state.lastSeen || 0);
      const withinHold = timeSinceSeen <= APRILTAG_VISIBILITY_HOLD_MS;
      if (!grouped.has(sceneId)) {
        if (!state.targetPosition) {
          state.targetPosition = state.position ? state.position.clone() : state.fallback.clone();
        }
        if (!state.targetRotation) {
          state.targetRotation = state.rotation ? state.rotation.clone() : new THREE.Quaternion();
        }
        state.visible = withinHold;
      } else {
        state.visible = true;
      }

      if (state.targetPosition && state.position) {
        state.position.lerp(state.targetPosition, ANCHOR_POSITION_LERP);
      }
      if (state.targetRotation && state.rotation) {
        state.rotation.slerp(state.targetRotation, ANCHOR_ROTATION_SLERP);
        clampQuaternion(state.rotation);
        const softenedRotation = softenSmallAngleQuaternion(state.rotation, SMALL_ANGLE_DEADZONE, SMALL_ANGLE_SOFT_ZONE);
        state.rotation.copy(softenedRotation);
      }
    });

    if (grouped.size > 0) {
      const previous = activeSceneIdRef.current;
      if (!previous || !grouped.has(previous)) {
        const nextId = grouped.keys().next().value;
        if (activeSceneIdRef.current !== nextId) {
          activeSceneIdRef.current = nextId;
          setActiveSceneId(nextId);
        }
      }
    } else if (!activeSceneIdRef.current && anchors.size > 0) {
      const fallbackId = anchors.keys().next().value;
      activeSceneIdRef.current = fallbackId;
      setActiveSceneId(fallbackId);
    }

    return grouped;
  }, [setActiveSceneId]);

  /**
   * @brief Синхронизирует линии-лучи от тегов с текущими состояниями якорей.
   * @param sceneAnchors Карта сцен и их состояниями якорей.
   * @returns {void}
   */
  const updateRayHelpers = useCallback((sceneAnchors) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const map = anchorDebugMapRef.current;
    const activeKeys = new Set();

    sceneAnchors.forEach((state, sceneId) => {
      const rays = state?.rays || [];
      rays.forEach((ray, index) => {
        const key = `${sceneId || 'default'}-${ray.tagId ?? index}`;
        activeKeys.add(key);
        let line = map.get(key);
        if (!line) {
          const geometry = new THREE.BufferGeometry();
          const positions = new Float32Array(6);
          geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          const material = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.8 });
          line = new THREE.Line(geometry, material);
          line.frustumCulled = false;
          map.set(key, line);
          scene.add(line);
        }
        const color = getRayColor(ray.tagId);
        line.material.color.copy(color);
        line.material.needsUpdate = true;
        const arr = line.geometry.attributes.position.array;
        arr[0] = ray.origin.x;
        arr[1] = ray.origin.y;
        arr[2] = ray.origin.z;
        arr[3] = ray.anchor.x;
        arr[4] = ray.anchor.y;
        arr[5] = ray.anchor.z;
        line.geometry.attributes.position.needsUpdate = true;
      });
    });

    map.forEach((line, key) => {
      if (!activeKeys.has(key)) {
        scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
        map.delete(key);
      }
    });
  }, []);

  const assignAlvaPoints = useCallback((rawPoints) => {
    const normalizedPoints = [];

    const pushPoint = (p) => {
      if (!p) return;
      if (typeof p.x === 'number' && typeof p.y === 'number') {
        normalizedPoints.push({ x: p.x, y: p.y });
        return;
      }
      if (Array.isArray(p) && p.length >= 2) {
        const nx = Number(p[0]);
        const ny = Number(p[1]);
        if (Number.isFinite(nx) && Number.isFinite(ny)) {
          normalizedPoints.push({ x: nx, y: ny });
        }
        return;
      }
      if (typeof p === 'object' && p) {
        const nx = Number(p.x ?? p[0]);
        const ny = Number(p.y ?? p[1]);
        if (Number.isFinite(nx) && Number.isFinite(ny)) {
          normalizedPoints.push({ x: nx, y: ny });
        }
      }
    };

    if (rawPoints && typeof rawPoints.length === 'number') {
      for (let i = 0; i < rawPoints.length; i += 1) {
        pushPoint(rawPoints[i]);
      }
    } else if (rawPoints && typeof rawPoints[Symbol.iterator] === 'function') {
      for (const p of rawPoints) {
        pushPoint(p);
      }
    }

    alvaPointsRef.current = normalizedPoints;
    alvaRef.current?.__debugPoints?.clear?.();
    return normalizedPoints;
  }, []);

  useEffect(() => {
    const currentSlugs = new Set();
    aprilTagTransforms.forEach((det) => {
      const asset = getAssetByDetection(det.sceneId, det.id);
      if (!asset) return;
      currentSlugs.add(asset.slug);
      if (recOn && !submittedAssetsRef.current.has(asset.slug)) {
        pendingAssetsRef.current.add(asset.slug);
      }
    });
    detectedAssetsRef.current = currentSlugs;
  }, [aprilTagTransforms, recOn]);

  const extractPlaneState = useCallback((matrixArray, cameraMatrixWorld) => {
    if (!matrixArray || matrixArray.length !== 16) return null;

    const planeMatrixCam = new THREE.Matrix4().fromArray(matrixArray);
    let planeMatrixWorld = planeMatrixCam;
    if (cameraMatrixWorld) {
      planeMatrixWorld = cameraMatrixWorld.clone().multiply(planeMatrixCam);
    }

    const position = new THREE.Vector3().setFromMatrixPosition(planeMatrixWorld);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(planeMatrixWorld);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize();

    return { matrix: planeMatrixWorld, position, quaternion, normal };
  }, []);

  /**
   * @brief Передаёт подготовленные детекции в AlvaAR для поддержания трекинга плоскости.
   * @param sceneId Активный идентификатор сцены.
   * @param detectionList Детекции, дополненные данными о якорях.
   * @returns {void}
   */
  const updateAlvaTracking = useCallback((sceneId, detectionList) => {
    const alva = alvaRef.current;
    const pipeline = aprilTagPipelineRef.current;
    if (!alva || !pipeline || !Array.isArray(detectionList) || detectionList.length === 0) return;

    const now = performance.now();
    if (now - lastAlvaUpdateRef.current < 100) return;
    lastAlvaUpdateRef.current = now;

    try {
      const tagSizePlain = {};
      const sizeMap = pipeline.getTagSizeById();
      if (sizeMap && typeof sizeMap.forEach === 'function') {
        sizeMap.forEach((value, key) => {
          if (typeof value === 'number') {
            tagSizePlain[key] = value;
          }
        });
      }

      const adjustedDetections = [];
      detectionList.forEach(det => {
        if (!det?.rawDetection) return;
        const clone = { ...det.rawDetection };
        if (clone.pose && Array.isArray(clone.pose.t) && det.anchorCamera) {
          clone.pose = { ...clone.pose, t: det.anchorCamera.slice(0, 3) };
        }
        adjustedDetections.push(clone);
      });

      if (adjustedDetections.length === 0) return;

      alva.estimatePlaneFromTags({ detections: adjustedDetections, tagSizeById: tagSizePlain });

      if (adjustedDetections.length >= 2) {
        const tagLayout = {};
        detectionList.forEach(det => {
          if (det && typeof det.id === 'number' && typeof det.config?.size === 'number') {
            tagLayout[det.id] = { size: det.config.size };
          }
        });
        try {
          alva.estimateAnchorFromMultiTags({ detections: adjustedDetections, tagLayout, K: alva.intrinsics });
        } catch (multiErr) {
          console.debug('Multi-tag anchor estimation skipped', multiErr);
        }
      }
      assignAlvaPoints(alva.getFramePoints());
    } catch (err) {
      console.warn('⚠️ Ошибка обновления AlvaAR:', err);
    }
  }, []);

  // main render loop
  /**
   * @brief Основной цикл отрисовки: видеофон, детекции и вывод трёхмерной сцены.
   * @returns {void}
   */
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

    // 1) фон: видео без растяжения (letterbox)
    const mix = mixRef.current;
    const r = drawRectRef.current;
    ctx.clearRect(0, 0, mix.width, mix.height);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, mix.width, mix.height);
    if (r.w > 0 && r.h > 0) {
      ctx.drawImage(
        video,
        0, 0, video.videoWidth, video.videoHeight,
        r.x, r.y, r.w, r.h
      );
    }

    // Also draw into fixed-size processing canvas (640x480) for OpenCV/AprilTag
    try {
      const proc = procRef.current;
      const pctx = pctxRef.current || (proc && proc.getContext && proc.getContext("2d"));
      if (proc && pctx && video.videoWidth && video.videoHeight) {
        if (typeof createImageBitmap === "function") {
          try {
            (async () => {
              try {
                const bitmap = await createImageBitmap(video, { resizeWidth: proc.width, resizeHeight: proc.height, resizeQuality: 'high' });
                pctx.clearRect(0, 0, proc.width, proc.height);
                pctx.drawImage(bitmap, 0, 0);
                bitmap.close?.();
              } catch (e) {
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
    let latestTransforms = [];
    let imageDataForAlva = null;
    try {
      if (pipeline && video.videoWidth > 0 && video.videoHeight > 0) {
        const proc = procRef.current;
        const pctx = pctxRef.current || (proc && proc.getContext && proc.getContext("2d"));
        if (pctx) {
          try { pctx.imageSmoothingEnabled = true; pctx.imageSmoothingQuality = 'high'; } catch (e) {}
        }
        try {
          imageDataForAlva = pctx ? pctx.getImageData(0, 0, proc.width, proc.height) : ctx.getImageData(0, 0, video.videoWidth, video.videoHeight);
          const detected = pipeline.detect(imageDataForAlva);
          latestTransforms = Array.isArray(detected) ? detected : [];
          
          // Отладочное логирование детекций
          if (latestTransforms.length !== aprilTagTransforms.length) {
            console.log(`🔍 AprilTag detections changed: ${aprilTagTransforms.length} → ${latestTransforms.length}`);
            if (latestTransforms.length > 0) {
              console.log('✅ Detected tags:', latestTransforms.map(t => `ID:${t.id} Scene:${t.sceneId}`));
            }
          }
          
          setAprilTagTransforms(latestTransforms);
        } catch (err) {
          console.error('Error reading imageData for detection', err);
        }
      }
    } catch (error) {
      console.error("AprilTag detection error:", error);
    }

    const alvaInstance = alvaRef.current;
    if (alvaInstance && imageDataForAlva) {
      try {
        alvaInstance.findCameraPose(imageDataForAlva);
      } catch (err) {
        console.debug('AlvaAR findCameraPose failed', err);
      }
      let currentPoints = [];
      try {
        currentPoints = assignAlvaPoints(alvaInstance.getFramePoints()) || [];
      } catch (err) {
        console.debug('AlvaAR getFramePoints failed', err);
        currentPoints = [];
        assignAlvaPoints(null);
      }
      try {
        cameraRef.current?.updateMatrixWorld?.();
        const planeRaw = alvaInstance.findPlane(180);
        const cameraMatrixWorld = cameraRef.current?.matrixWorld;
        const planeState = extractPlaneState(planeRaw, cameraMatrixWorld);
        const activeSceneKey = activeSceneIdRef.current ?? 'default';
        if (planeState) {
          scenePlaneRef.current.set(activeSceneKey, planeState);
        }
      } catch (err) {
        console.debug('AlvaAR findPlane failed', err);
      }

      try {
        const activeSceneKey = activeSceneIdRef.current ?? 'default';
        const anchorState = sceneAnchorsRef.current.get(activeSceneKey);
        const collisionSpheres = [];
        if (anchorState?.lastDetections?.length) {
          anchorState.lastDetections.forEach(det => {
            const center = toVector3(det.anchorPoint, new THREE.Vector3(0, 0, -0.6));
            let radius = typeof det.normalLength === 'number' ? det.normalLength : 0;
            const configRadius = typeof det.config?.normalOffsetMm === 'number'
              ? det.config.normalOffsetMm / 1000
              : null;
            if (configRadius && configRadius > radius) radius = configRadius;
            if (radius <= 0) radius = anchorState.radius || 0.25;
            collisionSpheres.push({ center, radius });
          });
        }

        const video = camRef.current;
        const mixRect = drawRectRef.current;
        const mixWidth = mixRect.w || 1;
        const mixHeight = mixRect.h || 1;
        const videoWidth = video?.videoWidth || 1;
        const videoHeight = video?.videoHeight || 1;
        const scaleX = mixWidth / videoWidth;
        const scaleY = mixHeight / videoHeight;

        const hitPoints = [];
        currentPoints.forEach(point => {
          const px = point.x;
          const py = point.y;
          if (!Number.isFinite(px) || !Number.isFinite(py)) return;
          const videoPoint = new THREE.Vector3(px, py, 0);
          const cameraMatrix = cameraRef.current?.matrixWorld;
          if (!cameraMatrix) return;

          const cameraPosition = cameraRef.current.position.clone();
          const planeState = scenePlaneRef.current.get(activeSceneKey);
          if (!planeState) return;

          const planeNormal = planeState.normal.clone();
          const planePoint = planeState.position.clone();

          const clipX = (px / videoWidth) * 2 - 1;
          const clipY = -((py / videoHeight) * 2 - 1);
          const clip = new THREE.Vector3(clipX, clipY, 0.5);

          const invProjection = cameraRef.current.projectionMatrixInverse;
          const worldDir = clip.clone().applyMatrix4(invProjection).applyMatrix4(cameraMatrix).sub(cameraPosition).normalize();
          const denom = planeNormal.dot(worldDir);
          if (Math.abs(denom) < 1e-6) return;
          const t = planeNormal.clone().dot(planePoint.clone().sub(cameraPosition)) / denom;
          if (t < 0) return;
          const hitPoint = cameraPosition.clone().add(worldDir.clone().multiplyScalar(t));

          collisionSpheres.forEach(sphere => {
            const dist = sphere.center.distanceTo(hitPoint);
            if (dist <= sphere.radius + 0.01) {
              hitPoints.push({ point, mixX: mixRect.x + px * scaleX, mixY: mixRect.y + py * scaleY });
            }
          });
        });

        alvaRef.current.__debugHitPoints = hitPoints;
      } catch (err) {
        console.debug('AlvaAR point highlighting failed', err);
        alvaRef.current.__debugHitPoints = null;
      }
    } else if (!alvaInstance) {
      assignAlvaPoints(null);
    }

    const groupedDetections = updateSceneAnchors(latestTransforms);
    const currentSceneId = activeSceneIdRef.current;
    const anchorState = currentSceneId ? sceneAnchorsRef.current.get(currentSceneId) : null;
    const now = performance.now();
    const activeDetections = currentSceneId && groupedDetections ? (groupedDetections.get(currentSceneId) || []) : [];
    const detectionActive = Array.isArray(activeDetections) && activeDetections.length > 0;
    const lastSeen = anchorState?.lastSeen ?? 0;
    const holding = anchorState ? (now - lastSeen <= APRILTAG_VISIBILITY_HOLD_MS) : false;
    const hasDetections = Boolean(anchorState && (detectionActive || holding));
    
    // Сброс инициализации при длительной потере детекции (>hold)
    if (detectionActive) {
      lastDetectionTime.current = now;
    } else if (trainInitialized.current && (now - lastDetectionTime.current > APRILTAG_VISIBILITY_HOLD_MS)) {
      trainInitialized.current = false;
      console.log(`🚂 Train initialization reset (detection lost for >${APRILTAG_VISIBILITY_HOLD_MS}ms)`);
    }
    
    // Отладочное логирование состояния детекции
    if (detectionActive && !hasDetections) {
      console.warn(`⚠️ Tags detected (${activeDetections.length}) but hasDetections=false. Scene:${currentSceneId}, AnchorVisible:${anchorState?.visible}`);
    }

    if (cube) {
      cube.visible = hasDetections;
      if (debugCubeRef.current) {
        debugCubeRef.current.visible = hasDetections;
      }
      if (hasDetections && trainPrefabRef.current && !trainInstanceRef.current) {
        console.log('🚂 Creating train instance...', {
          hasDetections,
          prefabExists: !!trainPrefabRef.current,
          instanceExists: !!trainInstanceRef.current
        });
        try {
          const instance = SkeletonUtils.clone(trainPrefabRef.current);
          instance.name = 'TrainSceneInstance';
          
          // Улучшенное позиционирование и масштабирование поезда
          instance.position.set(0, 0.1, 0); // Поднимаем поезд над плоскостью
          instance.quaternion.identity();
          instance.scale.set(0.3, 0.3, 0.3); // Делаем поезд более заметным
          
          // Убеждаемся что все объекты видимы и правильно настроены
          instance.traverse(obj => {
            if (obj && 'matrixAutoUpdate' in obj) {
              obj.matrixAutoUpdate = true;
            }
            if (obj.isMesh) {
              obj.castShadow = true;
              obj.receiveShadow = true;
              // Делаем материалы более яркими
              if (obj.material) {
                obj.material.metalness = 0.1;
                obj.material.roughness = 0.8;
                if (obj.material.color) {
                  obj.material.color.multiplyScalar(1.2); // Увеличиваем яркость
                }
              }
            }
          });
          
          cube.add(instance);
          trainInstanceRef.current = instance;
          
          // Инициализируем данные для анимации
          instance.userData.lastTime = performance.now() * 0.001;
          console.log('✅ Train instance created and added to scene with animation ready');
        } catch (cloneErr) {
          console.warn('Failed to clone Train prefab', cloneErr);
        }
      }
      
      if (trainInstanceRef.current) {
        const wasVisible = trainInstanceRef.current.visible;
        trainInstanceRef.current.visible = hasDetections;
        
        if (wasVisible !== hasDetections) {
          console.log(`🚂 Train visibility changed: ${wasVisible} → ${hasDetections}`);
        }
        
        if (hasDetections && !trainInstanceRef.current.parent) {
          console.log('🚂 Adding train to scene');
          cube.add(trainInstanceRef.current);
        }
        
        // Убрана анимация покачивания для уменьшения тряски
      }
      
      // Добавление/управление DebugCube в центре сцены
      if (debugCubeInstanceRef.current) {
        const debugCube = debugCubeInstanceRef.current;
        const wasVisible = debugCube.visible;
        debugCube.visible = hasDetections;
        
        if (wasVisible !== hasDetections) {
          console.log(`🎯 DebugCube visibility changed: ${wasVisible} → ${hasDetections}`);
        }
        
        if (hasDetections && !debugCube.parent) {
          console.log('🎯 Adding DebugCube to scene center', {
            position: debugCube.position,
            scale: debugCube.scale,
            parent: cube.name
          });
          cube.add(debugCube);
        }
      } else if (hasDetections) {
        console.warn('⚠️ DebugCube instance is null but detections are active');
      }
    }

    if (cube && anchorState?.position && anchorState?.rotation) {
      cube.matrixAutoUpdate = true;
      // Дополнительное сглаживание для поезда
      const TRAIN_SMOOTH_FACTOR = 0.08;
      const POSITION_THRESHOLD = 0.001; // минимальное движение в метрах для обновления
      
      // При первой детекции сразу устанавливаем правильные значения без интерполяции
      if (!trainInitialized.current) {
        trainSmoothPosition.current.copy(anchorState.position);
        trainSmoothQuaternion.current.copy(anchorState.rotation);
        trainInitialized.current = true;
        console.log('🚂 Train initialized with correct position and rotation');
      } else {
        // Фильтрация мелких движений
        const positionDistance = trainSmoothPosition.current.distanceTo(anchorState.position);
        if (positionDistance > POSITION_THRESHOLD) {
          trainSmoothPosition.current.lerp(anchorState.position, TRAIN_SMOOTH_FACTOR);
        }
        
        trainSmoothQuaternion.current.slerp(anchorState.rotation, TRAIN_SMOOTH_FACTOR);
      }
      
      cube.position.copy(trainSmoothPosition.current);
      cube.quaternion.copy(trainSmoothQuaternion.current);
    }

    updateRayHelpers(sceneAnchorsRef.current);

    if (groupedDetections && currentSceneId) {
      const activeDetections = groupedDetections.get(currentSceneId) || [];
      if (activeDetections.length) {
        updateAlvaTracking(currentSceneId, activeDetections);
      }
    }

    // 3) three.js
    gl.render(scene, cam);
    // 4) композит
    if (r.w > 0 && r.h > 0) {
      ctx.drawImage(
        glCanvas,
        0, 0, glCanvas.width, glCanvas.height,
        r.x, r.y, r.w, r.h
      );
    }

    const debugPoints = alvaPointsRef.current;
    if (Array.isArray(debugPoints) && debugPoints.length > 0 && video.videoWidth && video.videoHeight) {
      console.debug('AlvaAR points count:', debugPoints.length);
      const scaleX = r.w / video.videoWidth;
      const scaleY = r.h / video.videoHeight;
      ctx.save();
      ctx.fillStyle = "#ff3bff";
      debugPoints.forEach(point => {
        if (!point) return;
        const px = r.x + point.x * scaleX;
        const py = r.y + point.y * scaleY;
        if (!Number.isFinite(px) || !Number.isFinite(py)) return;
        ctx.fillRect(px - 2, py - 2, 4, 4);
      });
      const hitPoints = alvaRef.current?.__debugHitPoints;
      if (Array.isArray(hitPoints) && hitPoints.length > 0) {
        ctx.fillStyle = "#00ff88";
        hitPoints.forEach(hit => {
          if (!hit) return;
          const px = hit.mixX ?? (r.x + hit.point.x * scaleX);
          const py = hit.mixY ?? (r.y + hit.point.y * scaleY);
          if (!Number.isFinite(px) || !Number.isFinite(py)) return;
          ctx.fillRect(px - 3, py - 3, 6, 6);
        });
      }
      ctx.restore();

    }

    rafIdRef.current = requestAnimationFrame(renderLoop);
  }, [updateSceneAnchors, updateRayHelpers, updateAlvaTracking, assignAlvaPoints, extractPlaneState]);

  // camera control
  /**
   * @brief Запрашивает доступ к камере и настраивает поток для AprilTag.
   * @returns {Promise<void>}
   */
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
      await camRef.current.play();
      sizeAll();

      let effectiveWidth = 640;
      let effectiveHeight = 480;

      // Configure AprilTag pipeline with camera info
      if (aprilTagPipelineRef.current) {
        const videoTrack = camStream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        const width = settings.width || 640;
        const height = settings.height || 480;
        effectiveWidth = width;
        effectiveHeight = height;

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

      try {
        const currentAlva = alvaRef.current;
        const currentWidth = currentAlva?.intrinsics?.width;
        const currentHeight = currentAlva?.intrinsics?.height;
        if (!currentAlva || currentWidth !== effectiveWidth || currentHeight !== effectiveHeight) {
          console.log(`Reinitializing AlvaAR with ${effectiveWidth}x${effectiveHeight}`);
          const newAlva = await loadAlva(effectiveWidth, effectiveHeight);
          alvaRef.current = newAlva;
          lastAlvaUpdateRef.current = 0;
          assignAlvaPoints(null);
        }
      } catch (err) {
        console.error('Failed to initialize AlvaAR with camera dimensions:', err);
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
  }, [renderLoop, sizeAll, withMic, assignAlvaPoints]);

  /**
   * @brief Останавливает все активные медиа-потоки и очищает состояние детекции.
   * @returns {void}
   */
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
  /**
   * @brief Запускает запись композитного AR-канваса через MediaRecorder.
   * @returns {void}
   */
  const startRecording = useCallback(() => {
    const canvas = mixRef.current;
    if (!canvas) return;
    const stream = canvas.captureStream(30);
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
    pendingAssetsRef.current.clear();
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
      flushPendingAssets().catch((err) => {
        console.error('Failed to submit pending assets', err);
      });
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
  }, [withMic, flushPendingAssets]);

  /**
   * @brief Останавливает текущую сессию записи и формирует итоговый видео-blob.
   * @returns {void}
   */
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

  useEffect(() => {
    const onResize = () => sizeAll();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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

      {onShowLanding && (
        <button
          type="button"
          onClick={onShowLanding}
          style={{
            position: 'fixed',
            top: 18,
            right: 18,
            zIndex: 15,
            background: '#1b1f29',
            color: '#f6f7fb',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Landing
        </button>
      )}

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

            {/* Train Status Indicator */}
            <div style={{
              padding: "4px 8px",
              borderRadius: "8px",
              background: (aprilTagTransforms.length > 0 && trainInstanceRef.current)
                ? "rgba(255, 165, 0, 0.2)"
                : "rgba(255, 255, 255, 0.1)",
              border: (aprilTagTransforms.length > 0 && trainInstanceRef.current)
                ? "1px solid rgba(255, 165, 0, 0.4)"
                : "1px solid rgba(255, 255, 255, 0.2)",
              fontSize: "11px",
              fontWeight: "600",
              color: (aprilTagTransforms.length > 0 && trainInstanceRef.current) ? "#ffa500" : "#e0e0e0",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}>
              <div style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: (aprilTagTransforms.length > 0 && trainInstanceRef.current) ? "#ffa500" : "#666",
                animation: (aprilTagTransforms.length > 0 && trainInstanceRef.current) ? "blink 1.5s ease-in-out infinite" : "none"
              }} />
              🚂 Train: {trainInstanceRef.current ? (aprilTagTransforms.length > 0 ? 'Active' : 'Loaded') : 'Loading...'}
            </div>

            {/* DebugCube Status Indicator */}
            <div style={{
              padding: "4px 8px",
              borderRadius: "8px",
              background: (aprilTagTransforms.length > 0 && debugCubeInstanceRef.current)
                ? "rgba(0, 255, 255, 0.2)"
                : "rgba(255, 255, 255, 0.1)",
              border: (aprilTagTransforms.length > 0 && debugCubeInstanceRef.current)
                ? "1px solid rgba(0, 255, 255, 0.4)"
                : "1px solid rgba(255, 255, 255, 0.2)",
              fontSize: "11px",
              fontWeight: "600",
              color: (aprilTagTransforms.length > 0 && debugCubeInstanceRef.current) ? "#00ffff" : "#e0e0e0",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}>
              <div style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: (aprilTagTransforms.length > 0 && debugCubeInstanceRef.current) ? "#00ffff" : "#666",
                animation: (aprilTagTransforms.length > 0 && debugCubeInstanceRef.current) ? "blink 1s ease-in-out infinite" : "none"
              }} />
              🎯 Debug: {debugCubeInstanceRef.current ? (aprilTagTransforms.length > 0 ? 'Center' : 'Ready') : 'Loading...'}
            </div>

            <div style={{
              padding: "4px 8px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              fontSize: "11px",
              fontWeight: "600",
              color: "#e0e0e0",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              textTransform: "uppercase",
              letterSpacing: "0.6px"
            }}>
              <span style={{ opacity: 0.7 }}>Scene</span>
              <span>{activeSceneId || '—'}</span>
            </div>

            {sessionId && (
              <div style={{
                padding: "4px 8px",
                borderRadius: "8px",
                background: "rgba(85, 20, 219, 0.12)",
                border: "1px solid rgba(85, 20, 219, 0.25)",
                fontSize: "11px",
                fontWeight: "600",
                color: "#d6c7ff",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}>
                <span style={{ opacity: 0.7 }}>Session</span>
                <span>{`${sessionId.slice(0, 8)}…`}</span>
              </div>
            )}

            {progressState?.total_score !== undefined && (
              <div style={{
                padding: "4px 8px",
                borderRadius: "8px",
                background: "rgba(0, 0, 0, 0.35)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                fontSize: "11px",
                fontWeight: "600",
                color: "#ffd966",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}>
                <span style={{ opacity: 0.7 }}>Score</span>
                <span>{progressState.total_score}</span>
              </div>
            )}

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

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '16px',
          marginTop: '8px'
        }}>
          <div style={{
            minWidth: '220px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '12px',
            color: '#e0e0e0',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <strong style={{ fontSize: '12px', opacity: 0.7 }}>Сессия</strong>
            <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
              {sessionId ? sessionId : '—'}
            </span>
            <button
              type="button"
              onClick={resetSession}
              disabled={sessionLoading}
              style={{
                marginTop: '6px',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: sessionLoading ? 'rgba(255,255,255,0.1)' : '#3a2bd9',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 600,
                cursor: sessionLoading ? 'not-allowed' : 'pointer',
                opacity: sessionLoading ? 0.6 : 1
              }}
            >
              {sessionLoading ? 'Создание…' : 'Новая сессия'}
            </button>
            {healthState && (
              <span style={{ fontSize: '11px', opacity: 0.7 }}>{String(healthState)}</span>
            )}
          </div>

          <div style={{
            minWidth: '220px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '12px',
            color: '#e0e0e0',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <strong style={{ fontSize: '12px', opacity: 0.7 }}>Прогресс</strong>
            {progressState ? (
              <>
                <span style={{ fontSize: '12px' }}>
                  {progressState.viewed_assets} / {progressState.total_assets} активов
                </span>
                <span style={{ fontSize: '12px' }}>
                  Осталось: {progressState.remaining_assets}
                </span>
                <span style={{ fontSize: '12px' }}>
                  Очки: {progressState.total_score}
                </span>
              </>
            ) : (
              <span style={{ fontSize: '12px', opacity: 0.7 }}>Нет данных</span>
            )}
            {lastViewEvent && (
              <span style={{ fontSize: '11px', opacity: 0.7 }}>
                Последний: {lastViewEvent.slug} (+{lastViewEvent.result?.awarded_points ?? 0})
              </span>
            )}
          </div>

          <div style={{
            minWidth: '220px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '12px',
            color: '#e0e0e0',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <strong style={{ fontSize: '12px', opacity: 0.7 }}>Промокод</strong>
            {promoState?.promo_code ? (
              <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                {promoState.promo_code}
              </span>
            ) : (
              <span style={{ fontSize: '12px', opacity: 0.7 }}>Недоступен</span>
            )}
          </div>

          <div style={{
            minWidth: '220px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '12px',
            color: '#e0e0e0',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <strong style={{ fontSize: '12px', opacity: 0.7 }}>Статистика</strong>
            {statsState ? (
              <>
                <span style={{ fontSize: '12px' }}>Сегодня: {statsState.views_today}</span>
                <span style={{ fontSize: '12px' }}>Всего: {statsState.views_all_time}</span>
                <span style={{ fontSize: '12px', opacity: 0.8 }}>
                  Лучший: {statsState.best_asset?.name || statsState.best_asset?.slug || '—'}
                </span>
              </>
            ) : (
              <span style={{ fontSize: '12px', opacity: 0.7 }}>Нет данных</span>
            )}
          </div>

          <form
            onSubmit={handleEmailSubmit}
            style={{
              minWidth: '220px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '12px',
              color: '#e0e0e0',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <strong style={{ fontSize: '12px', opacity: 0.7 }}>Email</strong>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="you@example.com"
              style={{
                padding: '6px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(0,0,0,0.4)',
                color: '#fff',
                fontSize: '12px'
              }}
            />
            <button
              type="submit"
              disabled={!emailInput.trim() || emailSubmitting}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: emailSubmitting ? 'rgba(255,255,255,0.1)' : '#00a878',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 600,
                cursor: (!emailInput.trim() || emailSubmitting) ? 'not-allowed' : 'pointer',
                opacity: (!emailInput.trim() || emailSubmitting) ? 0.6 : 1
              }}
            >
              {emailSubmitting ? 'Отправка…' : 'Сохранить'}
            </button>
            {userState?.email && (
              <span style={{ fontSize: '11px', opacity: 0.7 }}>
                Привязан: {userState.email}
              </span>
            )}
          </form>
        </div>

        {apiError && (
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(255, 85, 85, 0.2)',
            border: '1px solid rgba(255, 85, 85, 0.3)',
            color: '#ff9595',
            fontSize: '12px'
          }}>
            {apiError}
          </div>
        )}
      </div>

      {/* Enhanced Canvas */}
      {/* Hidden R3F Canvas: captures TrainModel prefab for cloning */}
      <div style={{ position: 'absolute', top: '-1000px', left: '-1000px', width: '100px', height: '100px', pointerEvents: 'none' }} aria-hidden>
        <Canvas>
          <ambientLight intensity={0.5} />
          <TrainModel ref={captureTrainPrefab} />
        </Canvas>
      </div>
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
      <style>{`
        select:focus { border-color: #5514db !important; }
      `}</style>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('camera');

  if (view === 'landing') {
    return (
      <Landing
        onSwitchToApp={() => setView('camera')}
        onOpenEditor={() => setView('editor')}
      />
    );
  }

  if (view === 'editor') {
    return <AprilTagLayoutEditor onExit={() => setView('landing')} />;
  }

  return <ARRecorder onShowLanding={() => setView('landing')} />;
}

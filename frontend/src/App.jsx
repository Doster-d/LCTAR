// src/App.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import ApriltagPipeline from "./apriltagPipeline";
import { Canvas } from '@react-three/fiber';
import { Model as TestModel } from './models/Testmodel';
import { Model as TrainModel } from './models/Train';
import { SkeletonUtils } from 'three-stdlib'
import { averageQuaternion, bestFitPointFromRays, toVector3, clampQuaternion, softenSmallAngleQuaternion } from './lib/anchorMath';
import { loadAlva } from './alvaBridge';

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
const ANCHOR_POSITION_LERP = 0.18;
/**
 * @brief Коэффициент интерполяции ориентации якоря между кадрами.
 */
const ANCHOR_ROTATION_SLERP = 0.18;
/**
 * @brief Dead zone (радианы), в пределах которой якорь считается без поворота.
 */
const SMALL_ANGLE_DEADZONE = 0.08;
/**
 * @brief Угол (радианы), при превышении которого демпфирование не применяется.
 */
const SMALL_ANGLE_SOFT_ZONE = 0.24;
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
export default function ARRecorder() {
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
  const cubeRef = useRef(null); // now points to always-visible TestModel instance
  const pyramidMapRef = useRef(new Map());
  const pyramidGeoRef = useRef(null);
  const pyramidMatRef = useRef(null);
  const trainPrefabRef = useRef(null); // Train model prefab for AprilTag spawning
  const trainMapRef = useRef(new Map());
  const mainModelPrefabRef = useRef(null); // TestModel prefab for initial always-visible instance
  const sceneAnchorsRef = useRef(new Map());
  const anchorDebugMapRef = useRef(new Map());
  const scenePlaneRef = useRef(new Map());
  const activeSceneIdRef = useRef(null);
  const [activeSceneId, setActiveSceneId] = useState(null);
  const alvaRef = useRef(null);
  const lastAlvaUpdateRef = useRef(0);
  const alvaPointsRef = useRef([]);
  const fallbackCubeRef = useRef(null);

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

    // Always-visible main model (TestModel) will be attached once its prefab ref becomes available.
    // For now create a temporary placeholder group to avoid null checks in interaction logic.
    const placeholder = new THREE.Group();
    placeholder.position.set(0, 0, -0.6);

    const fallbackGeometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const colorArray = [];
    const facePalette = [
      new THREE.Color('#ff4d4f'),
      new THREE.Color('#36cfc9'),
      new THREE.Color('#40a9ff'),
      new THREE.Color('#fadb14'),
      new THREE.Color('#9254de'),
      new THREE.Color('#73d13d')
    ];
    const positionCount = fallbackGeometry.getAttribute('position').count;
    for (let i = 0; i < positionCount; i += 1) {
      const faceColor = facePalette[Math.floor(i / 6) % facePalette.length];
      colorArray.push(faceColor.r, faceColor.g, faceColor.b);
    }
    fallbackGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colorArray, 3));
    const fallbackMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.5, emissiveIntensity: 0.1 });
    const fallbackCube = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
    fallbackCube.name = 'AnchorDebugCube';
    const edgeHelper = new THREE.LineSegments(new THREE.EdgesGeometry(fallbackGeometry), new THREE.LineBasicMaterial({ color: 0x111111 }));
    fallbackCube.add(edgeHelper);
    placeholder.add(fallbackCube);
    fallbackCubeRef.current = fallbackCube;

    scene.add(placeholder);
    cubeRef.current = placeholder;

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

    return () => {
      try { gl.dispose(); } catch {}
      try { gl.domElement.remove(); } catch {}
      try { procRef.current?.remove(); } catch {}
    };
  }, []);

  /**
   * @brief Сохраняет основной префаб модели и добавляет его в сцену.
   * @param node Клон модели, полученный из React Three Fiber.
   */
  const attachTestModel = (node) => {
    if (!node || !sceneRef.current) return;
    node.position.set(0, 0, -0.6);
    sceneRef.current.add(node);
    cubeRef.current = node;
    mainModelPrefabRef.current = node;
    if (fallbackCubeRef.current) {
      fallbackCubeRef.current.parent?.remove(fallbackCubeRef.current);
      fallbackCubeRef.current.scale.set(0.25, 0.25, 0.25);
      fallbackCubeRef.current.position.set(0, 0, 0);
      fallbackCubeRef.current.visible = true;
      node.add(fallbackCubeRef.current);
    }
    console.log('✅ TestModel attached as main visible model');
  };

  /**
   * @brief Сохраняет префаб поезда для последующего клонирования под каждый тег.
   * @param node Экземпляр модели поезда.
   */
  const captureTrainPrefab = (node) => {
    if (!node) return;
    trainPrefabRef.current = node;
    console.log('✅ Train prefab captured');
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
      const rays = list.map(det => {
        const fallback = toVector3(det?.fallbackCenter, fallbackVector);
        fallbackVector = fallback.clone();
        const origin = toVector3(det.position, fallback);
        const direction = toVector3(det.normal, new THREE.Vector3(0, 0, 1));
        if (direction.lengthSq() < 1e-6) direction.set(0, 0, 1);
        direction.normalize();
        const length = typeof det.normalLength === 'number' ? det.normalLength : 0;
        const anchor = toVector3(det.anchorPoint, origin.clone().addScaledVector(direction, length));
        return { origin, direction, anchor, length, tagId: det.id };
      });

      const anchorCenters = [];
      list.forEach(det => {
        if (det?.anchorCamera) {
          anchorCenters.push(toVector3(det.anchorCamera, new THREE.Vector3(0, 0, 0)));
        }
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

      const planeInfo = scenePlaneRef.current.get(sceneId);
      if (planeInfo) {
        const planePosition = planeInfo.position.clone();
        if (unionCenter && radius > 0) {
          const distance = planePosition.distanceTo(unionCenter);
          if (distance > radius) {
            planePosition.copy(unionCenter);
          }
        }
        targetPosition = planePosition;
        targetRotation = planeInfo.quaternion.clone();
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
      if (!grouped.has(sceneId)) {
        state.visible = false;
        if (!state.targetPosition) {
          state.targetPosition = state.position ? state.position.clone() : state.fallback.clone();
        }
        if (!state.targetRotation) {
          state.targetRotation = state.rotation ? state.rotation.clone() : new THREE.Quaternion();
        }
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
    return normalizedPoints;
  }, []);

  const extractPlaneState = useCallback((matrixArray) => {
    if (!matrixArray || matrixArray.length !== 16) return null;

    const planeMatrix = new THREE.Matrix4().set(
      matrixArray[0], matrixArray[1], matrixArray[2], matrixArray[12] ?? 0,
      matrixArray[4], matrixArray[5], matrixArray[6], matrixArray[13] ?? 0,
      matrixArray[8], matrixArray[9], matrixArray[10], matrixArray[14] ?? 0,
      0, 0, 0, 1
    );

    const position = new THREE.Vector3(
      matrixArray[12] ?? 0,
      matrixArray[13] ?? 0,
      matrixArray[14] ?? 0
    );
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(planeMatrix);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize();

    return { matrix: planeMatrix, position, quaternion, normal };
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
          setAprilTagTransforms(latestTransforms);

          try {
            const modelMap = trainMapRef.current;
            const prefab = trainPrefabRef.current;
            const seenIds = new Set();

            latestTransforms.forEach(t => {
              const id = t.id;
              seenIds.add(id);
              let obj = modelMap.get(id);
              if (!obj) {
                if (prefab) {
                  obj = SkeletonUtils.clone(prefab);
                  obj.matrixAutoUpdate = false;
                  scene.add(obj);
                  modelMap.set(id, obj);
                } else {
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
              const up = new THREE.Matrix4().makeTranslation(0, 0.06, 0);
              m.multiply(up);
              obj.matrix.copy(m);
            });

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

    const alvaInstance = alvaRef.current;
    if (alvaInstance && imageDataForAlva) {
      try {
        alvaInstance.findCameraPose(imageDataForAlva);
      } catch (err) {
        console.debug('AlvaAR findCameraPose failed', err);
      }
      try {
        assignAlvaPoints(alvaInstance.getFramePoints());
      } catch (err) {
        console.debug('AlvaAR getFramePoints failed', err);
        assignAlvaPoints(null);
      }
      try {
        const planeRaw = alvaInstance.findPlane(180);
        const planeState = extractPlaneState(planeRaw);
        const activeSceneKey = activeSceneIdRef.current ?? 'default';
        if (planeState) {
          scenePlaneRef.current.set(activeSceneKey, planeState);
        }
      } catch (err) {
        console.debug('AlvaAR findPlane failed', err);
      }
    } else if (!alvaInstance) {
      assignAlvaPoints(null);
    }

    const groupedDetections = updateSceneAnchors(latestTransforms);
    const currentSceneId = activeSceneIdRef.current;
    const anchorState = currentSceneId ? sceneAnchorsRef.current.get(currentSceneId) : null;

    if (cube && anchorState?.position && anchorState?.rotation) {
      cube.matrixAutoUpdate = true;
      cube.position.copy(anchorState.position);
      cube.quaternion.copy(anchorState.rotation);
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
      {/* Hidden R3F Canvas: mounts TestModel (instanced) and TrainModel (prefab for tags) */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden>
        <Canvas>
          <TestModel ref={attachTestModel} />
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

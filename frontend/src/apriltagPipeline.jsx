import { Matrix4, Vector3, Quaternion } from 'three';
import cv from '@techstark/opencv-js';
import { CoordinateTransformer } from './CoordinateTransformer.jsx';

/**
 * @brief Загружает конфигурацию пайплайна AprilTag с диска.
 * @returns {Promise<object>} Объект с описанием сцен и тегов.
 */
const loadConfig = async () => {
  try {
    const response = await fetch('./apriltag-config.json');
    console.log(`[DEBUG] Fetch apriltag-config.json response status: ${response.status}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('[DEBUG] Apriltag-config data:', data);
    return data;
  } catch (error) {
    console.error('❌ Ошибка загрузки конфигурации AprilTag:', error);
    // Fallback к встроенной конфигурации
    return {
      scenes: {
        cheburashka_company: {
          diameter: 0.5
        }
      },
      tags: [
        {
          id: 0,
          sceneId: 'cheburashka_company',
          size: 0.15,
          normalOffsetMm: 10,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          sphereOffset: [0, 0, 0.1],
          fallbackCenter: [0, 0, -0.6]
        }
      ]
    };
  }
};

/**
 * @brief Предоставляет обнаружение AprilTag, управление конфигурацией и утилиты позы.
 */
class ApriltagPipeline {
  /**
   * @brief Создаёт новый экземпляр пайплайна с контейнерами состояния по умолчанию.
   */
  constructor() {
    this.config = null;
    this.detector = null;
    this.cameraMatrix = null;
    this.distCoeffs = null;
    this.opencvReady = false;
    this.apriltagReady = false;
    this.frameCount = 0;
    this.lastDetectionTime = 0;
    this._Module = null;
    this._init = null;
    this._destroy = null;
    this._set_detector_options = null;
    this._set_pose_info = null;
    this._set_img_buffer = null;
    this._set_tag_size = null;
    this._detect = null;
    this.tagConfigById = new Map();
    this.scenesById = new Map();
    this.tagSizeById = new Map();
    this.displayOrientationInfo = { type: null, angle: 0, isPortrait: false };

    // Координатный трансформатор для стабилизации
    this.coordinateTransformer = new CoordinateTransformer({
      positionDeadZone: 0.001, // 1мм в метрах
      rotationDeadZone: 0.0017, // 0.1° в радианах
      maxLerpSpeed: 0.3,
      minLerpSpeed: 0.05,
      predictionWindow: 10,
      stabilizationEnabled: true
    });

    // Конфигурация множественных маркеров
    this.multiTagConfig = {
      enabled: false,
      minTagsForMultiMode: 2,
      confidenceThreshold: 0.5,
      layoutMode: 'dynamic' // 'static' или 'dynamic'
    };

    // Стратегии восстановления при потере детекции
    this.recoveryStrategies = {
      predictionEnabled: true,
      fallbackToLastKnown: true,
      maxPredictionTime: 2000, // 2 секунды максимум предикции
      lastKnownTransforms: new Map()
    };
  }

  /**
   * @brief Инициализирует конфигурацию, OpenCV и ядро AprilTag WASM.
   * @returns {Promise<void>}
   */
  async init() {
    try {
      // Загружаем конфигурацию
      this.config = await loadConfig();
      this.applyConfig(this.config);

      // Проверяем доступность OpenCV
      if (typeof cv === 'undefined') {
        console.error('❌ OpenCV.js не доступен');
        throw new Error('OpenCV.js not available');
      }
      this.opencvReady = true;
      console.log('✅ OpenCV.js загружен и готов к использованию');

      // Инициализируем AprilTag WASM
      await this.initAprilTag();
    } catch (error) {
      console.error('❌ Ошибка при инициализации AprilTag pipeline:', error);
      throw error;
    }
  }

  /**
   * @brief Кэширует метаданные сцен и тегов для быстрого доступа при детекции.
   * @param config Загруженный объект конфигурации.
   * @returns {void}
   */
  applyConfig(config) {
    const scenes = config?.scenes ?? {};
    this.scenesById = new Map(Object.entries(scenes));

    this.tagConfigById = new Map();
    this.tagSizeById = new Map();
    const tags = Array.isArray(config?.tags) ? config.tags : [];
    tags.forEach(tag => {
      if (typeof tag?.id !== 'number') {
        return;
      }
      const prepared = {
        id: tag.id,
        sceneId: tag.sceneId || null,
        size: typeof tag.size === 'number' ? tag.size : null,
        normalOffsetMm: typeof tag.normalOffsetMm === 'number' ? tag.normalOffsetMm : null,
        sphereOffset: Array.isArray(tag.sphereOffset) ? tag.sphereOffset.slice(0, 3) : [0, 0, 0],
        position: Array.isArray(tag.position) ? tag.position.slice(0, 3) : [0, 0, 0],
        rotation: Array.isArray(tag.rotation) ? tag.rotation.slice(0, 3) : [0, 0, 0]
      };
      this.tagConfigById.set(tag.id, prepared);
      if (prepared.size) {
        this.tagSizeById.set(tag.id, prepared.size);
      }
    });
  }

  /**
   * @brief Загружает WASM-ресурсы AprilTag и подготавливает детектор.
   * @returns {Promise<void>}
   */
  async initAprilTag() {
    try {
      // Load AprilTag WASM script
      await this.loadAprilTagScript();
      console.log('✅ AprilTag WASM скрипт загружен');

      // Initialize AprilTag detector
      await this.initializeAprilTagDetector();
      console.log('✅ AprilTag детектор инициализирован');

      this.apriltagReady = true;
    } catch (error) {
      console.error('Failed to initialize AprilTag:', error);
      throw error;
    }
  }

  /**
   * @brief Возвращает закэшированную конфигурацию конкретной сцены.
   * @param sceneId Идентификатор сцены из конфигурационного файла.
   * @returns {object|null} Конфигурация сцены либо null.
   */
  getSceneConfig(sceneId) {
    if (!sceneId) return null;
    return this.scenesById.get(sceneId) || null;
  }

  /**
   * @brief Предоставляет отображение идентификаторов тегов на их физический размер.
   * @returns {Map<number, number>} Карта с размерами тегов в метрах.
   */
  getTagSizeById() {
    return this.tagSizeById;
  }

  /**
   * @brief Получает подготовленную запись конфигурации тега.
   * @param id Идентификатор AprilTag.
   * @returns {object|null} Конфигурация тега либо null при отсутствии.
   */
  getTagConfig(id) {
    return this.tagConfigById.get(id) || null;
  }

  /**
   * @brief Встраивает скрипт загрузчика AprilTag WASM в документ.
   * @returns {Promise<void>} Завершается после готовности глобального модуля.
   */
  async loadAprilTagScript() {
    return new Promise((resolve, reject) => {
      try {
        // Проверяем, не загружен ли уже скрипт
        const existingScript = document.querySelector('script[src="./apriltag_wasm.js"]');
        if (existingScript) {
          // Ждем доступности AprilTagWasm
          const waitForAprilTagWasm = () => {
            if (typeof window.AprilTagWasm === 'function') {
              resolve();
            } else {
              setTimeout(waitForAprilTagWasm, 100);
            }
          };
          waitForAprilTagWasm();
          return;
        }

        // Создаем script элемент для загрузки AprilTag WASM
        const script = document.createElement('script');
        script.src = './apriltag_wasm.js';
        script.onload = () => {
          console.log('[DEBUG] Apriltag_wasm.js loaded successfully');
          // Ждем доступности AprilTagWasm
          const waitForAprilTagWasm = () => {
            if (typeof window.AprilTagWasm === 'function') {
              resolve();
            } else {
              setTimeout(waitForAprilTagWasm, 100);
            }
          };
          waitForAprilTagWasm();
        };
        script.onerror = (event) => {
          console.log('[DEBUG] Failed to load apriltag_wasm.js:', event);
          console.error('❌ Ошибка загрузки AprilTag WASM скрипта:', event);
          reject(new Error('Failed to load AprilTag WASM script'));
        };

        document.head.appendChild(script);
      } catch (error) {
        console.error('❌ Ошибка в loadAprilTagScript:', error);
        reject(error);
      }
    });
  }

  /**
   * @brief Настраивает привязки WASM и инициализирует параметры детектора.
   * @returns {Promise<void>}
   */
  async initializeAprilTagDetector() {
    try {
      if (typeof window.AprilTagWasm !== 'function') {
        console.error('❌ window.AprilTagWasm не доступен');
        throw new Error('AprilTagWasm not available');
      }

      // Инициализируем WASM модуль
      const Module = await window.AprilTagWasm({
        locateFile: (path) => {
          if (path.endsWith('.wasm')) {
            return './apriltag_wasm.wasm';
          }
          return path;
        }
      });
      console.log('[DEBUG] AprilTagWasm initialized:', Module);

      // Сохраняем модуль и обертываем функции
      this._Module = Module;

      this._init = Module.cwrap('atagjs_init', 'number', []);
      this._destroy = Module.cwrap('atagjs_destroy', 'number', []);
      this._set_detector_options = Module.cwrap('atagjs_set_detector_options', 'number', ['number', 'number', 'number', 'number', 'number', 'number', 'number']);
      this._set_pose_info = Module.cwrap('atagjs_set_pose_info', 'number', ['number', 'number', 'number', 'number']);
      this._set_img_buffer = Module.cwrap('atagjs_set_img_buffer', 'number', ['number', 'number', 'number']);
      this._set_tag_size = Module.cwrap('atagjs_set_tag_size', null, ['number', 'number']);
      this._detect = Module.cwrap('atagjs_detect', 'number', []);

      // Инициализируем детектор
      this._init();
      console.log('[DEBUG] WASM detector initialized');

      this._set_detector_options(2.0, 0.0, 1, 1, 0, 1, 1);

      // Устанавливаем информацию о камере
      this.set_camera_info(800, 800, 320, 240);

      // Устанавливаем размеры тегов
      this.tagSizeById.forEach((size, tagId) => {
        if (typeof size === 'number' && !Number.isNaN(size)) {
          this.set_tag_size(tagId, size);
        }
      });

    } catch (error) {
      console.error('❌ Ошибка при инициализации AprilTag детектора:', error);
      throw error;
    }
  }

  /**
   * @brief Оценивает качество детекции множественных маркеров
   * @param detections Массив детекций маркеров
   * @returns {object} Оценка качества с режимом детекции
   */
  evaluateMultiTagQuality(detections) {
    if (!detections || detections.length === 0) {
      return { quality: 0, mode: 'none', confidence: 0 };
    }

    const confidences = detections.map(d => this.calculateDetectionConfidence(d));
    const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;

    // Определяем режим на основе количества маркеров и уверенности
    let mode = 'single';
    if (detections.length >= this.multiTagConfig.minTagsForMultiMode &&
      avgConfidence >= this.multiTagConfig.confidenceThreshold) {
      mode = 'multi';
    }

    return {
      quality: detections.length,
      mode: mode,
      confidence: avgConfidence,
      individualConfidences: confidences
    };
  }

  /**
   * @brief Вычисляет уверенность детекции маркера
   * @param detection Детекция маркера
   * @returns {number} Уверенность от 0 до 1
   */
  calculateDetectionConfidence(detection) {
    // Базовая уверенность
    const baseConfidence = detection.rawDetection ? 0.8 : 0.5;

    // Модификатор на основе расстояния до маркера
    const distance = Math.sqrt(
      detection.position[0] ** 2 +
      detection.position[1] ** 2 +
      detection.position[2] ** 2
    );

    const distanceModifier = Math.max(0.1, Math.min(1.0, 1.0 / (1.0 + distance * 2)));

    return baseConfidence * distanceModifier;
  }

  /**
   * @brief Применяет стратегии восстановления при потере детекции
   * @param currentDetections Текущие детекции
   * @param timestamp Временная метка
   * @returns {Array<object>} Детекции с восстановлением
   */
  applyRecoveryStrategies(currentDetections, timestamp) {
    const timeSinceLastDetection = timestamp - this.lastDetectionTime;

    // Если есть текущие детекции, сохраняем их для будущего восстановления
    if (currentDetections.length > 0) {
      currentDetections.forEach(detection => {
        this.recoveryStrategies.lastKnownTransforms.set(detection.id, {
          ...detection,
          lastSeen: timestamp
        });
      });
      return currentDetections;
    }

    // Если нет детекций, применяем стратегии восстановления
    const recoveredDetections = [];

    if (this.recoveryStrategies.fallbackToLastKnown) {
      // Fallback к последним известным трансформациям
      this.recoveryStrategies.lastKnownTransforms.forEach((lastKnown, id) => {
        const timeSinceLastSeen = timestamp - lastKnown.lastSeen;

        // Не используем трансформации старше максимального времени предикции
        if (timeSinceLastSeen < this.recoveryStrategies.maxPredictionTime) {
          const decayFactor = 1.0 - (timeSinceLastSeen / this.recoveryStrategies.maxPredictionTime);

          recoveredDetections.push({
            ...lastKnown,
            confidence: lastKnown.confidence * decayFactor * 0.5, // Уменьшаем уверенность
            recovered: true,
            recoveryMethod: 'fallback'
          });
        }
      });
    }

    return recoveredDetections;
  }

  /**
   * @brief Конфигурирует поддержку множественных маркеров
   * @param config Конфигурация множественных маркеров
   */
  configureMultiTag(config) {
    this.multiTagConfig = { ...this.multiTagConfig, ...config };
  }

  /**
   * @brief Конфигурирует стратегии восстановления
   * @param strategies Стратегии восстановления
   */
  configureRecoveryStrategies(strategies) {
    this.recoveryStrategies = { ...this.recoveryStrategies, ...strategies };
  }

  /**
   * @brief Сообщает пайплайну текущую ориентацию экрана/кадра
   * @param {{type?:string, angle?:number, isPortrait?:boolean}} info
   */
  setDisplayOrientation(info = {}) {
    const type = typeof info.type === 'string' ? info.type : this.displayOrientationInfo.type;
    const angle = Number.isFinite(info.angle) ? info.angle : this.displayOrientationInfo.angle;
    const isPortrait = typeof info.isPortrait === 'boolean'
      ? info.isPortrait
      : (type ? type.startsWith('portrait') : this.displayOrientationInfo.isPortrait);

    this.displayOrientationInfo = {
      type,
      angle,
      isPortrait
    };
  }

  /**
   * @brief Возвращает кватернион коррекции ориентации для портретного режима
   * @returns {Quaternion|null}
   */
  getOrientationCorrectionQuaternion() {
    const info = this.displayOrientationInfo;
    if (!info) return null;

    let radians = 0;
    if (typeof info.type === 'string') {
      if (info.type.startsWith('portrait')) {
        radians = -Math.PI / 2;
        if (info.type === 'portrait-secondary') {
          radians = Math.PI / 2;
        }
      } else if (info.type === 'landscape-secondary') {
        radians = Math.PI;
      }
    }

    if (radians === 0 && Number.isFinite(info.angle)) {
      const normalized = ((info.angle % 360) + 360) % 360;
      if (normalized === 90) radians = Math.PI / 2;
      else if (normalized === 180) radians = Math.PI;
      else if (normalized === 270) radians = -Math.PI / 2;
    }

    if (radians === 0 && info.isPortrait === true) {
      radians = -Math.PI / 2;
    }

    if (Math.abs(radians) < 1e-4) {
      return null;
    }

    return new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), radians);
  }

  /**
   * @brief Выполняет детекцию тегов по переданному RGBA-буферу изображения.
   * @param imageData Объект ImageData, подготовленный для анализа AprilTag.
   * @returns {Array<object>} Обработанные детекции с данными о позе.
   */
  detect(imageData) {
    this.frameCount++;
    const now = Date.now();

    // Проверяем инициализацию
    if (!this.apriltagReady || !this._Module) {
      console.warn('⚠️ [detect] AprilTag не готов или модуль не инициализирован');
      return this.applyRecoveryStrategies([], now);
    }

    // Проверяем, что все WASM функции инициализированы
    if (!this._init || !this._destroy || !this._set_detector_options ||
      !this._set_pose_info || !this._set_img_buffer || !this._set_tag_size || !this._detect) {
      console.error('❌ [detect] WASM функции не инициализированы');
      return this.applyRecoveryStrategies([], now);
    }

    // Проверяем валидность imageData
    if (!imageData || !imageData.data || !imageData.width || !imageData.height) {
      console.error('❌ [detect] Неверные данные изображения');
      return this.applyRecoveryStrategies([], now);
    }

    try {
      // Конвертируем imageData в grayscale буфер для AprilTag
      const width = imageData.width;
      const height = imageData.height;

      const grayscaleBuffer = this.convertImageDataToGrayscale(imageData);

      // Устанавливаем буфер изображения и обнаруживаем
      const imgBuffer = this._set_img_buffer(width, height, width);
      if (width * height < grayscaleBuffer.length) {
        console.error('❌ Размер данных изображения слишком большой');
        return [];
      }

      // Копируем данные изображения в память WASM
      this._Module.HEAPU8.set(grayscaleBuffer, imgBuffer);

      // Обнаруживаем теги
      const strJsonPtr = this._detect();
      const strJsonLen = this._Module.getValue(strJsonPtr, "i32");

      if (strJsonLen === 0) {
        return []; // Нет обнаружений
      }

      const strJsonStrPtr = this._Module.getValue(strJsonPtr + 4, "i32");
      const strJsonView = new Uint8Array(this._Module.HEAP8.buffer, strJsonStrPtr, strJsonLen);
      let detectionsJson = '';

      for (let i = 0; i < strJsonLen; i++) {
        detectionsJson += String.fromCharCode(strJsonView[i]);
      }

      const detections = JSON.parse(detectionsJson);
      if (detections.length > 0) {
        console.debug('[DEBUG apriltag] Parsed detections:', detections);
      }

      const transforms = [];

      detections.forEach((detection) => {
        const tagConfig = this.tagConfigById.get(detection.id);
        if (!tagConfig || !detection.pose) {
          console.warn(`⚠️ [detect] Конфигурация или поза не найдена для ID=${detection.id}`);
          return;
        }

        const { R, t } = detection.pose;

        if (!R || !t || !Array.isArray(R) || !Array.isArray(t)) {
          console.error(`❌ [detect] Неверные данные позы для ID=${detection.id}: R=${R}, t=${t}`);
          return;
        }

        let R_flat;
        if (Array.isArray(R[0])) {
          R_flat = R.flat();
        } else {
          R_flat = R;
        }

        if (R_flat.length !== 9 || t.length !== 3) {
          console.error(`❌ [detect] Неверная длина позы для ID=${detection.id}`);
          return;
        }

        const hasInvalidR = R_flat.some(val => val === null || val === undefined || Number.isNaN(val));
        const hasInvalidT = t.some(val => val === null || val === undefined || Number.isNaN(val));
        if (hasInvalidR || hasInvalidT) {
          console.error(`❌ [detect] Обнаружены некорректные значения для ID=${detection.id}: R=${R_flat}, t=${t}`);
          return;
        }

        const Mcv = new Matrix4().set(
          R_flat[0], R_flat[1], R_flat[2], t[0],
          R_flat[3], R_flat[4], R_flat[5], t[1],
          R_flat[6], R_flat[7], R_flat[8], t[2],
          0, 0, 0, 1
        );

        const Cv2Gl = new Matrix4().makeScale(1, -1, -1);
        const matrixBase = Cv2Gl.clone().multiply(Mcv);

        const sphereOffset = Array.isArray(tagConfig.sphereOffset) ? tagConfig.sphereOffset : [0, 0, 0];
        const matrixWithSphereOffset = matrixBase.clone().multiply(new Matrix4().makeTranslation(
          sphereOffset[0] || 0,
          sphereOffset[1] || 0,
          sphereOffset[2] || 0
        ));

        const orientationMatrix = matrixBase.clone();
        orientationMatrix.setPosition(0, 0, 0);

        const originVec = new Vector3().setFromMatrixPosition(matrixBase);
        const normalVec = new Vector3(0, 0, 1).applyMatrix4(orientationMatrix).normalize();

        const offsetMeters = typeof tagConfig.normalOffsetMm === 'number'
          ? tagConfig.normalOffsetMm / 1000
          : (sphereOffset[2] || 0);
        const anchorVec = originVec.clone().addScaledVector(normalVec, offsetMeters);

        const normalCamVec = new Vector3(R_flat[2], R_flat[5], R_flat[8]).normalize();
        if (normalCamVec.z < 0) {
          normalCamVec.multiplyScalar(-1);
        }
        const originCamVec = new Vector3(t[0], t[1], t[2]);
        const anchorCamVec = originCamVec.clone().addScaledVector(normalCamVec, offsetMeters);
        const cameraDistance = originCamVec.length();
        const anchorDistance = anchorCamVec.length();

        const sceneConfig = this.getSceneConfig(tagConfig.sceneId);

        transforms.push({
          id: detection.id,
          sceneId: tagConfig.sceneId || null,
          matrix: matrixWithSphereOffset.toArray(),
          matrixBase: matrixBase.toArray(),
          rotationMatrix: orientationMatrix.toArray(),
          position: originVec.toArray(),
          normal: normalVec.toArray(),
          anchorPoint: anchorVec.toArray(),
          normalLength: offsetMeters,
          ray: {
            origin: originVec.toArray(),
            direction: normalVec.toArray(),
            end: anchorVec.toArray(),
            length: offsetMeters
          },
          config: {
            size: tagConfig.size ?? null,
            normalOffsetMm: tagConfig.normalOffsetMm ?? null,
            sphereOffset: sphereOffset.slice(0, 3),
            fallbackCenter: Array.isArray(tagConfig?.fallbackCenter)
              ? tagConfig.fallbackCenter.slice(0, 3)
              : null,
            diameter: typeof sceneConfig?.diameter === 'number' ? sceneConfig.diameter : null
          },
          anchorCamera: anchorCamVec.toArray(),
          normalCamera: normalCamVec.toArray(),
          distanceCamera: cameraDistance,
          distanceMeters: anchorDistance,
          pose: {
            R: R_flat.slice(),
            t: [t[0], t[1], t[2]],
            distance: cameraDistance
          },
          rawDetection: detection
        });
      });

      if (transforms.length > 0) {
        this.lastDetectionTime = now;
        console.debug('[detect] Transforms prepared:', transforms);
      }

      // Применяем стратегии восстановления при потере детекции
      const transformsWithRecovery = this.applyRecoveryStrategies(transforms, now);

      // Оцениваем качество множественных маркеров
      const qualityAssessment = this.evaluateMultiTagQuality(transformsWithRecovery);

      console.debug('[detect] Quality assessment:', qualityAssessment);

      // Добавляем метаданные качества к трансформациям
      const enhancedTransforms = transformsWithRecovery.map(transform => ({
        ...transform,
        qualityInfo: {
          overall: qualityAssessment,
          individual: this.calculateDetectionConfidence(transform)
        },
        stabilized: true,
        timestamp: now,
        frameCount: this.frameCount
      }));

      // Применяем стабилизацию координат через CoordinateTransformer
      if (enhancedTransforms.length > 0 && this.coordinateTransformer) {
        try {
          // Подготавливаем данные для трансформатора координат
          const cameraPose = this.extractCameraPoseFromTransforms(enhancedTransforms);
          const aprilTagDetections = enhancedTransforms.map(transform => ({
            id: transform.id,
            anchorPoint: transform.anchorPoint,
            normal: transform.normal,
            position: transform.position,
            confidence: transform.qualityInfo.individual
          }));

          // Применяем трансформацию координат
          const stabilizedMatrix = this.coordinateTransformer.transformCameraToWorld(
            cameraPose,
            aprilTagDetections
          );

          // Преобразуем детекции из камеры в мир с сохранением индивидуальной ориентации
          let cameraWorldMatrix = stabilizedMatrix.clone();
          const cameraWorldPosition = new Vector3().setFromMatrixPosition(cameraWorldMatrix);
          let cameraWorldQuaternion = new Quaternion().setFromRotationMatrix(cameraWorldMatrix);

          const orientationCorrection = this.getOrientationCorrectionQuaternion();
          if (orientationCorrection) {
            cameraWorldQuaternion = cameraWorldQuaternion.multiply(orientationCorrection);
            cameraWorldMatrix = new Matrix4().compose(
              cameraWorldPosition.clone(),
              cameraWorldQuaternion.clone(),
              new Vector3(1, 1, 1)
            );
          }

          enhancedTransforms.forEach(transform => {
            // Сохраняем камерыное представление для отладки
            const cameraSpaceSnapshot = {
              matrix: Array.isArray(transform.matrix) ? transform.matrix.slice() : null,
              matrixBase: Array.isArray(transform.matrixBase) ? transform.matrixBase.slice() : null,
              rotationMatrix: Array.isArray(transform.rotationMatrix) ? transform.rotationMatrix.slice() : null,
              position: Array.isArray(transform.position) ? transform.position.slice() : null,
              normal: Array.isArray(transform.normal) ? transform.normal.slice() : null,
              anchorPoint: Array.isArray(transform.anchorPoint) ? transform.anchorPoint.slice() : null,
              ray: transform.ray ? {
                origin: Array.isArray(transform.ray.origin) ? transform.ray.origin.slice() : null,
                direction: Array.isArray(transform.ray.direction) ? transform.ray.direction.slice() : null,
                end: Array.isArray(transform.ray.end) ? transform.ray.end.slice() : null,
                length: transform.ray.length
              } : null
            };

            transform.cameraSpace = cameraSpaceSnapshot;

            const matrixWithOffsetCamera = (cameraSpaceSnapshot.matrix && cameraSpaceSnapshot.matrix.length === 16)
              ? new Matrix4().fromArray(cameraSpaceSnapshot.matrix)
              : new Matrix4();
            const matrixBaseCamera = (cameraSpaceSnapshot.matrixBase && cameraSpaceSnapshot.matrixBase.length === 16)
              ? new Matrix4().fromArray(cameraSpaceSnapshot.matrixBase)
              : new Matrix4();
            const rotationMatrixCamera = (cameraSpaceSnapshot.rotationMatrix && cameraSpaceSnapshot.rotationMatrix.length === 16)
              ? new Matrix4().fromArray(cameraSpaceSnapshot.rotationMatrix)
              : new Matrix4();

            const tagScale = new Vector3();
            const tagPositionCamera = new Vector3();
            const tagQuaternionCamera = new Quaternion();
            matrixWithOffsetCamera.decompose(tagPositionCamera, tagQuaternionCamera, tagScale);

            const normalizeScale = (scaleVec) => {
              if (!scaleVec) return 1;
              const avg = (Math.abs(scaleVec.x) + Math.abs(scaleVec.y) + Math.abs(scaleVec.z)) / 3;
              const safe = Number.isFinite(avg) && avg > 1e-6 ? avg : 1;
              scaleVec.setScalar(safe);
              return scaleVec;
            };

            normalizeScale(tagScale);

            const baseScale = new Vector3();
            const basePositionCamera = new Vector3();
            const baseQuaternionCamera = new Quaternion();
            matrixBaseCamera.decompose(basePositionCamera, baseQuaternionCamera, baseScale);
            normalizeScale(baseScale);

            const worldPosition = tagPositionCamera.clone().applyQuaternion(cameraWorldQuaternion).add(cameraWorldPosition);
            const worldBasePosition = basePositionCamera.clone().applyQuaternion(cameraWorldQuaternion).add(cameraWorldPosition);

            const worldQuaternion = cameraWorldQuaternion.clone().multiply(tagQuaternionCamera);
            const worldBaseQuaternion = cameraWorldQuaternion.clone().multiply(baseQuaternionCamera);

            const worldMatrix = new Matrix4().compose(worldPosition, worldQuaternion, tagScale);
            const worldMatrixBase = new Matrix4().compose(worldBasePosition, worldBaseQuaternion, baseScale);
            const worldRotationMatrix = new Matrix4().makeRotationFromQuaternion(worldBaseQuaternion);

            const normalCamera = new Vector3().fromArray(cameraSpaceSnapshot.normal || [0, 1, 0]);
            const worldNormal = normalCamera.clone().applyQuaternion(cameraWorldQuaternion).normalize();

            const anchorCamera = new Vector3().fromArray(cameraSpaceSnapshot.anchorPoint || [0, 0, 0]);
            const anchorWorld = anchorCamera.clone().applyQuaternion(cameraWorldQuaternion).add(cameraWorldPosition);

            const rayOriginCamera = new Vector3().fromArray(cameraSpaceSnapshot.ray?.origin || [0, 0, 0]);
            const rayEndCamera = new Vector3().fromArray(cameraSpaceSnapshot.ray?.end || [0, 0, 0]);
            const rayDirectionCamera = new Vector3().fromArray(cameraSpaceSnapshot.ray?.direction || [0, 0, 1]);

            const rayOriginWorld = rayOriginCamera.clone().applyQuaternion(cameraWorldQuaternion).add(cameraWorldPosition);
            const rayEndWorld = rayEndCamera.clone().applyQuaternion(cameraWorldQuaternion).add(cameraWorldPosition);
            const rayDirectionWorld = rayDirectionCamera.clone().applyQuaternion(cameraWorldQuaternion).normalize();

            transform.matrix = worldMatrix.toArray();
            transform.matrixBase = worldMatrixBase.toArray();
            transform.rotationMatrix = worldRotationMatrix.toArray();
            transform.position = worldBasePosition.toArray();
            transform.normal = worldNormal.toArray();
            transform.anchorPoint = anchorWorld.toArray();
            transform.ray = {
              origin: rayOriginWorld.toArray(),
              end: rayEndWorld.toArray(),
              direction: rayDirectionWorld.toArray(),
              length: cameraSpaceSnapshot.ray?.length ?? null
            };

            transform.anchorWorld = anchorWorld.toArray();
            transform.cameraPose = {
              matrix: cameraWorldMatrix.toArray(),
              position: cameraWorldPosition.toArray(),
              quaternion: [
                cameraWorldQuaternion.x,
                cameraWorldQuaternion.y,
                cameraWorldQuaternion.z,
                cameraWorldQuaternion.w
              ]
            };

            transform.stabilizedMatrix = worldMatrixBase.toArray();
            transform.stabilizedPosition = worldBasePosition.toArray();
          });

          console.debug('[detect] Coordinate stabilization applied');
        } catch (stabilizationError) {
          console.warn('⚠️ [detect] Error applying coordinate stabilization:', stabilizationError);
        }
      }

      return enhancedTransforms;
    } catch (error) {
      console.error(`❌ [Кадр ${this.frameCount}] Ошибка в методе detect:`, error);
      return this.applyRecoveryStrategies([], now);
    }
  }

  /**
   * @brief Извлекает позу камеры из трансформаций маркеров
   * @param transforms Массив трансформаций маркеров
   * @returns {object} Поза камеры в формате {R, t}
   */
  extractCameraPoseFromTransforms(transforms) {
    if (!transforms || transforms.length === 0) {
      return { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
    }

    // Используем первую трансформацию для извлечения позы камеры
    const firstTransform = transforms[0];
    const { R, t } = firstTransform.pose;

    return {
      R: Array.isArray(R) ? R : [1, 0, 0, 0, 1, 0, 0, 0, 1],
      t: Array.isArray(t) && t.length >= 3 ? t : [0, 0, 0]
    };
  }

  /**
   * @brief Сбрасывает состояние трансформатора координат
   */
  resetCoordinateTransformer() {
    if (this.coordinateTransformer) {
      this.coordinateTransformer.reset();
    }
  }

  /**
   * @brief Получает текущее состояние трансформатора координат
   * @returns {object} Состояние трансформатора
   */
  getCoordinateTransformerState() {
    if (this.coordinateTransformer) {
      return this.coordinateTransformer.getCurrentTransform();
    }
    return null;
  }

  /**
   * @brief Преобразует RGBA-данные изображения в ожидаемый детектором градационный буфер.
   * @param imageData Источник ImageData.
   * @returns {Uint8Array} Буфер яркости в оттенках серого.
   */
  convertImageDataToGrayscale(imageData) {
    const data = imageData.data;
    const grayscale = new Uint8Array(data.length / 4);

    for (let i = 0; i < data.length; i += 4) {
      // Convert RGB to grayscale using standard formula
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      grayscale[i / 4] = gray;
    }

    return grayscale;
  }

  /**
   * @brief Обновляет детектор параметрами внутренней калибровки камеры.
   * @param fx Горизонтальное фокусное расстояние в пикселях.
   * @param fy Вертикальное фокусное расстояние в пикселях.
   * @param cx Координата X главной точки.
   * @param cy Координата Y главной точки.
   * @returns {number|undefined} Код результата от WASM-обёртки.
   */
  set_camera_info(fx, fy, cx, cy) {
    if (!this._Module || typeof this._set_pose_info !== 'function') {
      console.error('AprilTag not properly initialized');
      return;
    }

    // Сохраняем текущие intrinsics
    this.currentIntrinsics = { fx, fy, cx, cy };

    try {
      return this._set_pose_info(fx, fy, cx, cy);
    } catch (error) {
      console.error('Error setting camera info:', error);
      throw error;
    }
  }

  /**
   * @brief Возвращает последние параметры внутренней калибровки, переданные детектору.
   * @returns {{fx:number, fy:number, cx:number, cy:number}} Текущие intrinsics.
   */
  getCameraInfo() {
    return this.currentIntrinsics || { fx: 800, fy: 800, cx: 320, cy: 240 };
  }

  /**
   * @brief Сообщает детектору физический размер тега.
   * @param tagid Идентификатор тега.
   * @param size Длина стороны тега в метрах.
   * @returns {number|undefined} Код результата от WASM-обёртки.
   */
  set_tag_size(tagid, size) {
    if (!this._Module || typeof this._set_tag_size !== 'function') {
      console.error('AprilTag not properly initialized');
      return;
    }

    try {
      return this._set_tag_size(tagid, size);
    } catch (error) {
      console.error('Error setting tag size:', error);
      throw error;
    }
  }
}

export default ApriltagPipeline;
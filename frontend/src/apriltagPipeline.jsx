import { Matrix4, Vector3 } from 'three';
import cv from '@techstark/opencv-js';

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
          normalOffsetMm: 120,
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
      return [];
    }

    // Проверяем, что все WASM функции инициализированы
    if (!this._init || !this._destroy || !this._set_detector_options ||
        !this._set_pose_info || !this._set_img_buffer || !this._set_tag_size || !this._detect) {
      console.error('❌ [detect] WASM функции не инициализированы');
      return [];
    }

    // Проверяем валидность imageData
    if (!imageData || !imageData.data || !imageData.width || !imageData.height) {
      console.error('❌ [detect] Неверные данные изображения');
      return [];
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
          0,         0,         0,         1
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
          pose: {
            R: R_flat.slice(),
            t: [t[0], t[1], t[2]]
          },
          rawDetection: detection
        });
      });

      if (transforms.length > 0) {
        this.lastDetectionTime = now;
        console.debug('[detect] Transforms prepared:', transforms);
      }

      return transforms;
    } catch (error) {
      console.error(`❌ [Кадр ${this.frameCount}] Ошибка в методе detect:`, error);
      return [];
    }
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
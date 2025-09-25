import { Matrix4 } from 'three';
import cv from '@techstark/opencv-js';

// Загружаем конфигурацию AprilTag
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
    return [
      {
        "id": 0,
        "size": 0.15,
        "position": [0, 0, 0],
        "rotation": [0, 0, 0],
        "sphereOffset": [0, 0, 0.1]
      },
      {
        "id": 1,
        "size": 0.15,
        "position": [1, 0, 0],
        "rotation": [0, 0, 0],
        "sphereOffset": [0, 0, 0.1]
      },
      {
        "id": 2,
        "size": 0.15,
        "position": [2, 0, 0],
        "rotation": [0, 0, 0],
        "sphereOffset": [0, 0, 0.1]
      }
    ];
  }
};

class ApriltagPipeline {
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
  }

  async init() {
    try {
      // Загружаем конфигурацию
      this.config = await loadConfig();

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
      for (const tag of this.config) {
        this.set_tag_size(tag.id, tag.size);
      }

    } catch (error) {
      console.error('❌ Ошибка при инициализации AprilTag детектора:', error);
      throw error;
    }
  }

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
        console.error('[DEBUG apriltag] Parsed detections:', detections);
      }

      const transforms = [];

      detections.forEach((detection, index) => {
        const tagConfig = this.config.find(tag => tag.id === detection.id);
        if (!tagConfig || !detection.pose) {
          console.warn(`⚠️ [detect] Конфигурация или поза не найдена для ID=${detection.id}`);
          return;
        }

        const { R, t } = detection.pose;

        // Проверяем валидность данных R и t
        if (!R || !t || !Array.isArray(R) || !Array.isArray(t)) {
          console.error(`❌ [detect] Неверные данные позы для ID=${detection.id}: R=${R}, t=${t}`);
          return;
        }

        // Обрабатываем R как 2D массив (3x3 матрица)
        let R_flat;
        if (Array.isArray(R[0])) {
          // R - 2D массив, преобразуем в плоский
          R_flat = R.flat();
        } else {
          // R уже плоский массив
          R_flat = R;
        }

        // Проверяем, что R содержит 9 элементов
        if (R_flat.length !== 9) {
          console.error(`❌ [detect] Неверная длина массива R для ID=${detection.id}: ${R_flat.length} элементов вместо 9`);
          return;
        }

        // Проверяем t на 3 элемента
        if (t.length !== 3) {
          console.error(`❌ [detect] Неверная длина массива t для ID=${detection.id}: ${t.length} элементов вместо 3`);
          return;
        }

        // Проверяем на null/undefined значения
        const hasInvalidR = R_flat.some(val => val === null || val === undefined || isNaN(val));
        const hasInvalidT = t.some(val => val === null || val === undefined || isNaN(val));

        if (hasInvalidR || hasInvalidT) {
          console.error(`❌ [detect] Обнаружены null/undefined/NaN значения для ID=${detection.id}: R=${R_flat}, t=${t}`);
          return;
        }

        // Правильная сборка в row-major порядке
        const Mcv = new Matrix4().set(
          R_flat[0], R_flat[1], R_flat[2], t[0],
          R_flat[3], R_flat[4], R_flat[5], t[1],
          R_flat[6], R_flat[7], R_flat[8], t[2],
          0,         0,         0,         1
        );

        // Офсет над центром тега
        const offset = tagConfig.sphereOffset;
        const Moffset = new Matrix4().makeTranslation(offset[0], offset[1], offset[2]);
        const Mtag_cv = Mcv.clone().multiply(Moffset);

        // Конвертация OpenCV → WebGL
        const Cv2Gl = new Matrix4().makeScale(1, -1, -1);
        const Mtag_gl = Cv2Gl.clone().multiply(Mtag_cv);

        // Инвертируем матрицу для корректной AR трансформации
        // Mtag_gl.invert();

        // Отладка: проверка офсета и конвертации координат
        console.error(`❌ [detect] После офсета и конвертации для ID=${detection.id}: offset=${offset}, Mtag_gl=`, Mtag_gl.toArray());

        // Проверяем, что матрица создана корректно
        if (!Mtag_gl || !Mtag_gl.isMatrix4) {
          console.error(`❌ [detect] Не удалось создать корректную матрицу для ID=${detection.id}`);
          return;
        }

        const matrix = Mtag_gl;

        // Проверяем, что матрица корректна
        const matrixArray = matrix.toArray();

        // Отладка: проверка расчета матриц
        console.error(`❌ [detect] Матрица рассчитана для ID=${detection.id}:`, matrixArray);

        transforms.push({
          id: detection.id,
          matrix: matrixArray
        });
      });

      if (transforms.length > 0) {
        this.lastDetectionTime = now;
        // Отладка: проверка получения трансформаций из pipeline
        console.error(`❌ [detect] Получены трансформации из pipeline:`, transforms);
      }

      return transforms;
    } catch (error) {
      console.error(`❌ [Кадр ${this.frameCount}] Ошибка в методе detect:`, error);
      return [];
    }
  }

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

  getCameraInfo() {
    return this.currentIntrinsics || { fx: 800, fy: 800, cx: 320, cy: 240 };
  }

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
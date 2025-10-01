import { Matrix4, Vector3, Quaternion } from 'three';

/**
 * @brief Система мировых координат для AprilTag с механизмами стабилизации
 */
export class AprilTagWorldReference {
  constructor() {
    this.origin = new Vector3(); // Начало координат мира
    this.rotation = new Quaternion(); // Вращение системы координат мира
    this.anchors = new Map(); // Якоря для определения мировых координат
    this.worldMatrix = new Matrix4(); // Матрица трансформации в мировые координаты
  }

  /**
   * @brief Обновляет мировую систему координат на основе якорей
   * @param anchors Массив якорей с позициями и нормалями
   */
  updateFromAnchors(anchors) {
    if (!anchors || anchors.length === 0) return;

    this.anchors.clear();
    anchors.forEach(anchor => {
      this.anchors.set(anchor.id, {
        position: new Vector3().fromArray(anchor.position),
        normal: new Vector3().fromArray(anchor.normal),
        confidence: anchor.confidence || 1.0
      });
    });

    this.calculateOptimalOrigin();
    this.calculateWorldRotation();
    this.updateWorldMatrix();
  }

  /**
   * @brief Вычисляет оптимальное начало координат
   */
  calculateOptimalOrigin() {
    if (this.anchors.size === 0) return;

    let weightedSum = new Vector3();
    let totalWeight = 0;

    this.anchors.forEach((anchor, id) => {
      const weight = anchor.confidence || 1.0;
      weightedSum.add(anchor.position.clone().multiplyScalar(weight));
      totalWeight += weight;
    });

    if (totalWeight > 0) {
      this.origin.copy(weightedSum.divideScalar(totalWeight));
    }
  }

  /**
   * @brief Вычисляет вращение системы координат мира
   */
  calculateWorldRotation() {
    if (this.anchors.size === 0) return;

    // Используем первую якорь как основу для вычисления вращения
    const firstAnchor = this.anchors.values().next().value;
    if (!firstAnchor) return;

    // Создаем систему координат где Z направлена по нормали якоря
    const zAxis = firstAnchor.normal.clone().normalize();
    const xAxis = new Vector3(1, 0, 0);
    const yAxis = new Vector3().crossVectors(zAxis, xAxis).normalize();
    xAxis.crossVectors(yAxis, zAxis).normalize();

    this.rotation.setFromRotationMatrix(
      new Matrix4().makeBasis(xAxis, yAxis, zAxis)
    );
  }

  /**
   * @brief Обновляет матрицу трансформации мира
   */
  updateWorldMatrix() {
    this.worldMatrix.makeRotationFromQuaternion(this.rotation);
    this.worldMatrix.setPosition(this.origin);
  }
}

/**
 * @brief Фильтры для шумоподавления координатных данных
 */
export class StabilizationFilter {
  constructor(type = 'exponential', config = {}) {
    this.type = type;
    this.config = {
      alpha: 0.1, // Коэффициент сглаживания для экспоненциального фильтра
      kalmanProcessNoise: 0.01, // Процессный шум для Калмана
      kalmanMeasurementNoise: 0.1, // Измерительный шум для Калмана
      medianWindowSize: 5, // Размер окна для медианного фильтра
      ...config
    };

    this.reset();
  }

  /**
   * @brief Сбрасывает состояние фильтра
   */
  reset() {
    this.history = [];
    this.previousValue = null;

    // Сбрасываем кэш медианного фильтра
    if (this.medianSortCache) {
      this.medianSortCache.fill(0);
    }

    // Состояние Калмановского фильтра
    this.kalman = {
      x: 0, // Предсказанное значение
      P: 1, // Ковариация ошибки предсказания
      K: 0  // Коэффициент усиления Калмана
    };
  }

  /**
   * @brief Применяет фильтр к входному значению
   * @param value Текущее значение для фильтрации
   * @returns Отфильтрованное значение
   */
  apply(value) {
    if (this.previousValue === null) {
      this.previousValue = value;
      return value;
    }

    switch (this.type) {
      case 'kalman':
        return this.applyKalmanFilter(value);
      case 'median':
        return this.applyMedianFilter(value);
      case 'exponential':
      default:
        return this.applyExponentialFilter(value);
    }
  }

  /**
   * @brief Экспоненциальное сглаживание
   */
  applyExponentialFilter(value) {
    const alpha = this.config.alpha;
    const filtered = alpha * value + (1 - alpha) * this.previousValue;
    this.previousValue = filtered;
    return filtered;
  }

  /**
   * @brief Калмановский фильтр
   */
  applyKalmanFilter(value) {
    const { kalmanProcessNoise, kalmanMeasurementNoise } = this.config;

    // Предсказание
    const P_pred = this.kalman.P + kalmanProcessNoise;

    // Обновление
    this.kalman.K = P_pred / (P_pred + kalmanMeasurementNoise);
    this.kalman.x = this.kalman.x + this.kalman.K * (value - this.kalman.x);
    this.kalman.P = (1 - this.kalman.K) * P_pred;

    this.previousValue = this.kalman.x;
    return this.kalman.x;
  }

  /**
   * @brief Медианный фильтр (оптимизированный)
   */
  applyMedianFilter(value) {
    const startTime = performance.now();

    this.history.push(value);
    if (this.history.length > this.config.medianWindowSize) {
      this.history.shift();
    }

    if (this.history.length < 3) {
      this.previousValue = value;
      this.recordPerformance(startTime, 'filter');
      return value;
    }

    // Используем кэшированный массив для сортировки вместо создания нового
    if (!this.medianSortCache) {
      this.medianSortCache = new Float32Array(this.config.medianWindowSize);
    }

    // Копируем данные в кэшированный массив
    const len = this.history.length;
    for (let i = 0; i < len; i++) {
      this.medianSortCache[i] = this.history[i];
    }

    // Сортируем кэшированный массив
    this.medianSortCache.sort((a, b) => a - b);

    const mid = Math.floor(len / 2);
    const filtered = len % 2 === 0
      ? (this.medianSortCache[mid - 1] + this.medianSortCache[mid]) / 2
      : this.medianSortCache[mid];

    this.previousValue = filtered;
    this.recordPerformance(startTime, 'filter');
    return filtered;
  }
}

/**
 * @brief Основной координатный трансформатор с механизмами стабилизации
 */
export class CoordinateTransformer {
  constructor(config = {}) {
    // Временные метки для профилирования
    this.performanceMetrics = {
      lastFrameTime: 0,
      frameCount: 0,
      totalTransformTime: 0,
      totalFilterTime: 0,
      totalMatrixTime: 0,
      memoryUsage: 0
    };

    this.config = {
      positionDeadZone: 0.001, // 1мм в метрах
      rotationDeadZone: 0.0017, // 0.1° в радианах
      maxLerpSpeed: 0.3, // Максимальная скорость интерполяции
      minLerpSpeed: 0.05, // Минимальная скорость интерполяции
      predictionWindow: 10, // Окно для предиктивной стабилизации
      stabilizationEnabled: true,
      enablePerformanceLogging: false, // Флаг для включения детального логирования производительности
      // Настройки периодического перезацепления
      periodicReanchorEnabled: true, // Включить периодическое перезацепление
      periodicReanchorInterval: 5000, // Интервал перезацепления в миллисекундах (5 секунд)
      minDetectionConfidence: 0.3, // Минимальная уверенность детекции для перезацепления
      minDetectionCount: 1, // Минимальное количество детекций для перезацепления
      ...config
    };

    // Пул объектов для повторного использования
    this.objectPool = {
      vectors: [],
      quaternions: [],
      matrices: []
    };

    // Инициализация систем
    this.worldReference = new AprilTagWorldReference();
    this.stabilizationHistory = [];

    // Фильтры для разных компонентов
    this.positionFilters = {
      x: new StabilizationFilter('exponential', { alpha: 0.15 }),
      y: new StabilizationFilter('exponential', { alpha: 0.15 }),
      z: new StabilizationFilter('exponential', { alpha: 0.15 })
    };

    this.rotationFilters = {
      x: new StabilizationFilter('exponential', { alpha: 0.1 }),
      y: new StabilizationFilter('exponential', { alpha: 0.1 }),
      z: new StabilizationFilter('exponential', { alpha: 0.1 }),
      w: new StabilizationFilter('exponential', { alpha: 0.1 })
    };

    // Текущее состояние трансформации
    this.currentTransform = {
      position: new Vector3(),
      rotation: new Quaternion(),
      matrix: new Matrix4(),
      confidence: 0,
      timestamp: 0
    };

    // Целевое состояние (до стабилизации)
    this.targetTransform = {
      position: new Vector3(),
      rotation: new Quaternion(),
      matrix: new Matrix4(),
      confidence: 0,
      timestamp: 0
    };


    // Кэшированные матрицы для избежания пересоздания
    this.cachedMatrices = {
      cvToGl: new Matrix4().makeScale(1, -1, -1),
      tempMatrix1: new Matrix4(),
      tempMatrix2: new Matrix4(),
      tempVector1: new Vector3(),
      tempVector2: new Vector3(),
      tempQuaternion: new Quaternion()
    };

    // Механизм периодического перезацепления
    this.periodicReanchorTimer = null; // Таймер для периодического перезацепления
    this.lastReanchorTime = 0; // Время последнего перезацепления
    this.reanchorCallbacks = []; // Коллбэки для уведомления о перезацеплении

    console.log('[PERF] CoordinateTransformer инициализирован с профилированием');
  }

  /**
   * @brief Получает Vector3 из пула или создает новый
   */
  getVector3(x = 0, y = 0, z = 0) {
    if (this.objectPool.vectors.length > 0) {
      const vec = this.objectPool.vectors.pop();
      vec.set(x, y, z);
      return vec;
    }
    return new Vector3(x, y, z);
  }

  /**
   * @brief Возвращает Vector3 в пул
   */
  returnVector3(vec) {
    if (vec && this.objectPool.vectors.length < 50) { // Ограничение размера пула
      this.objectPool.vectors.push(vec);
    }
  }

  /**
   * @brief Получает Matrix4 из пула или создает новый
   */
  getMatrix4() {
    if (this.objectPool.matrices.length > 0) {
      return this.objectPool.matrices.pop();
    }
    return new Matrix4();
  }

  /**
   * @brief Возвращает Matrix4 в пул
   */
  returnMatrix4(mat) {
    if (mat && this.objectPool.matrices.length < 20) { // Ограничение размера пула
      this.objectPool.matrices.push(mat);
    }
  }

  /**
   * @brief Получает Quaternion из пула или создает новый
   */
  getQuaternion(x = 0, y = 0, z = 0, w = 1) {
    if (this.objectPool.quaternions.length > 0) {
      const quat = this.objectPool.quaternions.pop();
      quat.set(x, y, z, w);
      return quat;
    }
    return new Quaternion(x, y, z, w);
  }

  /**
   * @brief Возвращает Quaternion в пул
   */
  returnQuaternion(quat) {
    if (quat && this.objectPool.quaternions.length < 20) { // Ограничение размера пула
      this.objectPool.quaternions.push(quat);
    }
  }

  /**
   * @brief Записывает метрики производительности
   */
  recordPerformance(startTime, operation) {
    if (!this.config.enablePerformanceLogging) return;

    const duration = performance.now() - startTime;

    switch (operation) {
      case 'transform':
        this.performanceMetrics.totalTransformTime += duration;
        break;
      case 'filter':
        this.performanceMetrics.totalFilterTime += duration;
        break;
      case 'matrix':
        this.performanceMetrics.totalMatrixTime += duration;
        break;
    }

    this.performanceMetrics.frameCount++;

    // Логируем каждые 60 кадров
    if (this.performanceMetrics.frameCount % 60 === 0) {
      this.logPerformanceMetrics();
    }
  }

  /**
    * @brief Запускает периодическое перезацепление
    */
   startPeriodicReanchor() {
     if (!this.config.periodicReanchorEnabled || this.periodicReanchorTimer) {
       return;
     }

     this.periodicReanchorTimer = setInterval(() => {
       this.performPeriodicReanchor();
     }, this.config.periodicReanchorInterval);

     console.log(`[REANCHOR] Периодическое перезацепление запущено с интервалом ${this.config.periodicReanchorInterval}мс`);
   }

  /**
    * @brief Останавливает периодическое перезацепление
    */
   stopPeriodicReanchor() {
     if (this.periodicReanchorTimer) {
       clearInterval(this.periodicReanchorTimer);
       this.periodicReanchorTimer = null;
       console.log('[REANCHOR] Периодическое перезацепление остановлено');
     }
   }

  /**
    * @brief Выполняет периодическое перезацепление с проверками
    */
   performPeriodicReanchor() {
     const now = Date.now();

     // Проверяем минимальный интервал между перезацеплениями
     if (now - this.lastReanchorTime < this.config.periodicReanchorInterval) {
       return;
     }

     // Проверяем наличие активных детекций (реализуем в следующем шаге)
     if (!this.hasValidDetections()) {
       console.log('[REANCHOR] Пропуск перезацепления - нет валидных детекций');
       return;
     }

     // Выполняем перезацепление
     this.executeReanchor();

     this.lastReanchorTime = now;
   }

  /**
    * @brief Проверяет наличие валидных детекций для перезацепления
    */
   hasValidDetections() {
     // Проверяем, что у нас есть якоря в мировой системе координат
     if (this.worldReference.anchors.size < this.config.minDetectionCount) {
       return false;
     }

     // Проверяем уверенность детекций
     let totalConfidence = 0;
     let validAnchors = 0;

     this.worldReference.anchors.forEach((anchor) => {
       if (anchor.confidence >= this.config.minDetectionConfidence) {
         totalConfidence += anchor.confidence;
         validAnchors++;
       }
     });

     // Требуем минимум одну валидную детекцию с достаточной уверенностью
     return validAnchors >= this.config.minDetectionCount &&
            (validAnchors > 0 ? totalConfidence / validAnchors : 0) >= this.config.minDetectionConfidence;
   }

  /**
    * @brief Выполняет перезацепление с плавным переходом
    */
   executeReanchor() {
     console.log('[REANCHOR] Выполнение перезацепления...');

     // Сохраняем текущее состояние для плавного перехода
     const previousTransform = {
       position: this.currentTransform.position.clone(),
       rotation: this.currentTransform.rotation.clone(),
       confidence: this.currentTransform.confidence
     };

     // Сбрасываем стабилизацию
     this.resetStabilization();

     // Восстанавливаем позицию и вращение для плавности
     this.currentTransform.position.copy(previousTransform.position);
     this.currentTransform.rotation.copy(previousTransform.rotation);
     this.currentTransform.confidence = previousTransform.confidence;

     // Обновляем матрицу трансформации
     this.updateTransformMatrix();

     // Уведомляем подписчиков о перезацеплении
     this.notifyReanchorCallbacks();

     console.log('[REANCHOR] Перезацепление выполнено');
   }

  /**
    * @brief Добавляет коллбэк для уведомления о перезацеплении
    * @param callback Функция обратного вызова
    */
   addReanchorCallback(callback) {
     if (typeof callback === 'function') {
       this.reanchorCallbacks.push(callback);
     }
   }

  /**
    * @brief Удаляет коллбэк перезацепления
    * @param callback Функция обратного вызова для удаления
    */
   removeReanchorCallback(callback) {
     const index = this.reanchorCallbacks.indexOf(callback);
     if (index > -1) {
       this.reanchorCallbacks.splice(index, 1);
     }
   }

  /**
    * @brief Уведомляет все коллбэки о перезацеплении
    */
   notifyReanchorCallbacks() {
     this.reanchorCallbacks.forEach(callback => {
       try {
         callback(this.getCurrentTransform());
       } catch (error) {
         console.error('[REANCHOR] Ошибка в коллбэке перезацепления:', error);
       }
     });
   }

  /**
    * @brief Логирует метрики производительности
    */
   logPerformanceMetrics() {
    if (!this.config.enablePerformanceLogging) return;

    const avgTransformTime = this.performanceMetrics.totalTransformTime / this.performanceMetrics.frameCount;
    const avgFilterTime = this.performanceMetrics.totalFilterTime / this.performanceMetrics.frameCount;
    const avgMatrixTime = this.performanceMetrics.totalMatrixTime / this.performanceMetrics.frameCount;

    console.log(`[PERF] Метрики производительности (${this.performanceMetrics.frameCount} кадров):`, {
      avgTransformTime: `${avgTransformTime.toFixed(2)}ms`,
      avgFilterTime: `${avgFilterTime.toFixed(2)}ms`,
      avgMatrixTime: `${avgMatrixTime.toFixed(2)}ms`,
      memoryUsage: `${this.performanceMetrics.memoryUsage}MB`,
      pooledObjects: {
        vectors: this.objectPool.vectors.length,
        matrices: this.objectPool.matrices.length,
        quaternions: this.objectPool.quaternions.length
      }
    });
  }

  /**
    * @brief Основной метод трансформации позы камеры в мировые координаты (оптимизированный)
    * @param cameraPose Поза камеры {R, t}
    * @param aprilTagDetections Детекции AprilTag
    * @returns Стабилизированная матрица трансформации
    */
   transformCameraToWorld(cameraPose, aprilTagDetections) {
     const startTime = performance.now();


     if (!cameraPose || !aprilTagDetections || aprilTagDetections.length === 0) {
       console.warn('[WARN] transformCameraToWorld: отсутствуют cameraPose или aprilTagDetections');
       this.recordPerformance(startTime, 'transform');
       return this.currentTransform.matrix.clone();
     }

    const timestamp = Date.now();

    // Вычисляем целевую трансформацию
    this.calculateTargetTransform(cameraPose, aprilTagDetections);

    // Применяем стабилизацию если включена
    if (this.config.stabilizationEnabled) {
      this.applyStabilization(timestamp);
    } else {
      this.currentTransform.position.copy(this.targetTransform.position);
      this.currentTransform.rotation.copy(this.targetTransform.rotation);
      this.currentTransform.confidence = this.targetTransform.confidence;
      this.currentTransform.timestamp = timestamp;
    }

    // Гарантируем что confidence всегда актуален после трансформации
    // Всегда копируем confidence из targetTransform, даже если он равен 0
    this.currentTransform.confidence = this.targetTransform.confidence;

    // Обновляем матрицу трансформации
    this.updateTransformMatrix();

    this.recordPerformance(startTime, 'transform');
    return this.currentTransform.matrix.clone();
  }

  /**
   * @brief Вычисляет целевую трансформацию на основе детекций
   */
  calculateTargetTransform(cameraPose, detections) {

    if (!detections || detections.length === 0) {
      console.warn('[WARN] calculateTargetTransform: detections пуст или undefined');
      return;
    }

    // Извлекаем якоря из детекций
    const anchors = detections.map(detection => ({
      id: detection.id,
      position: detection.anchorPoint,
      normal: detection.normal,
      confidence: this.calculateDetectionConfidence(detection)
    }));

    // Обновляем мировую систему координат
    this.worldReference.updateFromAnchors(anchors);

    // Вычисляем трансформацию камеры относительно мира
    this.calculateCameraToWorldTransform(cameraPose, detections);

    this.targetTransform.timestamp = Date.now();
  }

  /**
   * @brief Вычисляет трансформацию из системы координат камеры в мировую (оптимизированный)
   * @param cameraPose Поза камеры {R, t}
   * @param detections Детекции AprilTag для расчета уверенности
   */
  calculateCameraToWorldTransform(cameraPose, detections) {
    const startTime = performance.now();

    if (!detections || detections.length === 0) {
      console.error('[ERROR] calculateCameraToWorldTransform: detections пуст или undefined!');
      return;
    }

    const { R, t } = cameraPose;

    // Используем кэшированные матрицы вместо создания новых
    const cameraMatrix = this.cachedMatrices.tempMatrix1;
    cameraMatrix.set(
      R[0], R[1], R[2], t[0],
      R[3], R[4], R[5], t[1],
      R[6], R[7], R[8], t[2],
      0,    0,    0,    1
    );

    // Используем кэшированную матрицу преобразования координат
    const glCameraMatrix = this.cachedMatrices.tempMatrix2;
    glCameraMatrix.multiplyMatrices(this.cachedMatrices.cvToGl, cameraMatrix);

    // Трансформируем в мировые координаты
    const worldMatrix = this.cachedMatrices.tempMatrix1; // Переиспользуем временную матрицу
    worldMatrix.copy(this.worldReference.worldMatrix).invert();

    const worldCameraMatrix = this.cachedMatrices.tempMatrix2; // Переиспользуем для результата
    worldCameraMatrix.multiplyMatrices(worldMatrix, glCameraMatrix);

    // Извлекаем позицию и вращение с использованием кэшированных векторов
    this.targetTransform.position.copy(this.cachedMatrices.tempVector1.setFromMatrixPosition(worldCameraMatrix));
    this.targetTransform.rotation.copy(this.cachedMatrices.tempQuaternion.setFromRotationMatrix(worldCameraMatrix));

    // Вычисляем уверенность трансформации
    this.targetTransform.confidence = this.calculateTransformConfidence(detections);

    this.recordPerformance(startTime, 'matrix');
  }

  /**
   * @brief Вычисляет уверенность детекции AprilTag
   */
  calculateDetectionConfidence(detection) {
    // Уверенность на основе качества детекции
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
   * @brief Вычисляет общую уверенность трансформации
   */
  calculateTransformConfidence(detections) {

    if (!detections || detections.length === 0) {
      console.warn('[WARN] calculateTransformConfidence: detections пуст или undefined');
      return 0;
    }

    const confidences = detections.map(d => this.calculateDetectionConfidence(d));
    const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;

    // Бонус за количество детекций
    const countBonus = Math.min(0.3, detections.length * 0.1);
    const result = Math.min(1.0, avgConfidence + countBonus);


    return result;
  }

  /**
   * @brief Применяет стабилизацию к трансформации
   */
  applyStabilization(timestamp) {

    const deltaTime = (timestamp - this.currentTransform.timestamp) / 1000.0; // в секундах
    if (deltaTime <= 0) {
      return;
    }

    // Вычисляем адаптивную скорость лерпинга
    const lerpSpeed = this.calculateAdaptiveLerpSpeed(deltaTime);

    // Проверяем dead zone для позиции
    const positionDiff = this.targetTransform.position.distanceTo(this.currentTransform.position);
    if (positionDiff > this.config.positionDeadZone) {
      const filteredPosition = this.applyPositionFiltering(this.targetTransform.position);
      this.currentTransform.position.lerp(filteredPosition, lerpSpeed);
    }

    // Проверяем dead zone для вращения
    const rotationDiff = this.targetTransform.rotation.angleTo(this.currentTransform.rotation);
    if (rotationDiff > this.config.rotationDeadZone) {
      const filteredRotation = this.applyRotationFiltering(this.targetTransform.rotation);
      this.currentTransform.rotation.slerp(filteredRotation, lerpSpeed);
    }

    const oldConfidence = this.currentTransform.confidence;
    this.currentTransform.confidence = this.targetTransform.confidence;
    this.currentTransform.timestamp = timestamp;


    // Добавляем в историю для предиктивной стабилизации
    this.addToHistory(this.currentTransform);
  }

  /**
   * @brief Вычисляет адаптивную скорость интерполяции на основе уверенности
   */
  calculateAdaptiveLerpSpeed(deltaTime) {
    const confidenceFactor = this.targetTransform.confidence;

    // Базовая скорость на основе уверенности
    const baseSpeed = this.config.minLerpSpeed +
      (this.config.maxLerpSpeed - this.config.minLerpSpeed) * confidenceFactor;

    // Модификатор на основе времени кадра
    const timeFactor = Math.min(1.0, deltaTime * 60); // Предполагаем 60 FPS как норму

    return Math.min(this.config.maxLerpSpeed, baseSpeed * timeFactor);
  }

  /**
   * @brief Применяет фильтрацию к позиции
   */
  applyPositionFiltering(targetPosition) {
    return new Vector3(
      this.positionFilters.x.apply(targetPosition.x),
      this.positionFilters.y.apply(targetPosition.y),
      this.positionFilters.z.apply(targetPosition.z)
    );
  }

  /**
   * @brief Применяет фильтрацию к вращению
   */
  applyRotationFiltering(targetRotation) {
    const targetArray = [targetRotation.x, targetRotation.y, targetRotation.z, targetRotation.w];
    const filteredArray = targetArray.map((val, i) => {
      const filterKeys = ['x', 'y', 'z', 'w'];
      return this.rotationFilters[filterKeys[i]].apply(val);
    });

    const filteredRotation = new Quaternion(
      filteredArray[0],
      filteredArray[1],
      filteredArray[2],
      filteredArray[3]
    );

    return filteredRotation.normalize();
  }

  /**
   * @brief Добавляет текущее состояние в историю для предиктивной стабилизации (оптимизированный)
   */
  addToHistory(transform) {
    // Используем пул объектов для создания записей истории
    const historyEntry = {
      position: this.getVector3(transform.position.x, transform.position.y, transform.position.z),
      rotation: this.getQuaternion(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w),
      confidence: transform.confidence,
      timestamp: transform.timestamp
    };

    this.stabilizationHistory.push(historyEntry);

    // Ограничиваем размер истории и возвращаем старые объекты в пул
    if (this.stabilizationHistory.length > this.config.predictionWindow) {
      const oldEntry = this.stabilizationHistory.shift();
      this.returnVector3(oldEntry.position);
      this.returnQuaternion(oldEntry.rotation);
    }
  }

  /**
   * @brief Обновляет матрицу трансформации на основе текущего состояния
   */
  updateTransformMatrix() {
    this.currentTransform.matrix.makeRotationFromQuaternion(this.currentTransform.rotation);
    this.currentTransform.matrix.setPosition(this.currentTransform.position);
  }

  /**
    * @brief Сбрасывает стабилизацию координат без полной потери состояния
    */
   resetStabilization() {
     const startTime = performance.now();

     // Сохраняем текущее состояние трансформации для плавного перехода
     const preservedTransform = {
       position: this.currentTransform.position.clone(),
       rotation: this.currentTransform.rotation.clone(),
       confidence: this.currentTransform.confidence,
       timestamp: Date.now()
     };

     // Сбрасываем историю стабилизации и возвращаем объекты в пул
     this.stabilizationHistory.forEach(entry => {
       this.returnVector3(entry.position);
       this.returnQuaternion(entry.rotation);
     });
     this.stabilizationHistory.length = 0;

     // Сбрасываем фильтры стабилизации для пересчета
     Object.values(this.positionFilters).forEach(filter => filter.reset());
     Object.values(this.rotationFilters).forEach(filter => filter.reset());

     // Восстанавливаем базовое состояние трансформации
     this.currentTransform.position.copy(preservedTransform.position);
     this.currentTransform.rotation.copy(preservedTransform.rotation);
     this.currentTransform.confidence = preservedTransform.confidence;
     this.currentTransform.timestamp = preservedTransform.timestamp;

     // Сбрасываем целевое состояние для пересчета
     this.targetTransform.position.set(0, 0, 0);
     this.targetTransform.rotation.set(0, 0, 0, 1);
     this.targetTransform.confidence = 0;
     this.targetTransform.timestamp = 0;

     // Сбрасываем метрики фильтрации в производительности
     this.performanceMetrics.totalFilterTime = 0;

     this.recordPerformance(startTime, 'transform');
     console.log('[STABILIZATION] Стабилизация сброшена для перезацепления');
   }

  /**
    * @brief Сбрасывает состояние трансформатора (оптимизированный)
    */
   reset() {
     // Останавливаем периодическое перезацепление
     this.stopPeriodicReanchor();

     // Очищаем коллбэки перезацепления
     this.reanchorCallbacks.length = 0;

     // Очищаем историю стабилизации и возвращаем объекты в пул
     this.stabilizationHistory.forEach(entry => {
       this.returnVector3(entry.position);
       this.returnQuaternion(entry.rotation);
     });
     this.stabilizationHistory.length = 0;

     // Сбрасываем текущее состояние
     this.currentTransform.position.set(0, 0, 0);
     this.currentTransform.rotation.set(0, 0, 0, 1);
     this.currentTransform.confidence = 0;
     this.currentTransform.timestamp = 0;

     // Сбрасываем целевое состояние
     this.targetTransform.position.set(0, 0, 0);
     this.targetTransform.rotation.set(0, 0, 0, 1);
     this.targetTransform.confidence = 0;
     this.targetTransform.timestamp = 0;

     // Сбрасываем фильтры
     Object.values(this.positionFilters).forEach(filter => filter.reset());
     Object.values(this.rotationFilters).forEach(filter => filter.reset());

     // Сбрасываем метрики производительности
     this.performanceMetrics = {
       lastFrameTime: 0,
       frameCount: 0,
       totalTransformTime: 0,
       totalFilterTime: 0,
       totalMatrixTime: 0,
       memoryUsage: 0
     };

     console.log('[PERF] CoordinateTransformer сброшен');
   }

  /**
   * @brief Возвращает текущее состояние трансформации
   */
  getCurrentTransform() {

    return {
      position: this.currentTransform.position.clone(),
      rotation: this.currentTransform.rotation.clone(),
      matrix: this.currentTransform.matrix.clone(),
      confidence: this.currentTransform.confidence,
      timestamp: this.currentTransform.timestamp
    };
  }

  /**
   * @brief Возвращает мировую систему координат
   */
  getWorldReference() {
    return this.worldReference;
  }

  /**
   * @brief Возвращает текущие метрики производительности
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      avgTransformTime: this.performanceMetrics.frameCount > 0 ?
        this.performanceMetrics.totalTransformTime / this.performanceMetrics.frameCount : 0,
      avgFilterTime: this.performanceMetrics.frameCount > 0 ?
        this.performanceMetrics.totalFilterTime / this.performanceMetrics.frameCount : 0,
      avgMatrixTime: this.performanceMetrics.frameCount > 0 ?
        this.performanceMetrics.totalMatrixTime / this.performanceMetrics.frameCount : 0,
      pooledObjectsCount: this.objectPool.vectors.length + this.objectPool.matrices.length + this.objectPool.quaternions.length
    };
  }

  /**
   * @brief Возвращает диагностическую информацию о состоянии системы
   */
  getDiagnostics() {
    return {
      config: this.config,
      performance: this.getPerformanceMetrics(),
      filters: {
        positionFiltersActive: Object.keys(this.positionFilters).length,
        rotationFiltersActive: Object.keys(this.rotationFilters).length,
        medianCacheSize: this.medianSortCache ? this.medianSortCache.length : 0
      },
      memory: {
        historySize: this.stabilizationHistory.length,
        pooledVectors: this.objectPool.vectors.length,
        pooledMatrices: this.objectPool.matrices.length,
        pooledQuaternions: this.objectPool.quaternions.length,
        totalPooled: this.objectPool.vectors.length + this.objectPool.matrices.length + this.objectPool.quaternions.length
      },
      worldReference: {
        anchorsCount: this.worldReference.anchors.size,
        hasWorldMatrix: !!this.worldReference.worldMatrix
      }
    };
  }
}

// Экспорт вспомогательных функций для совместимости с существующей архитектурой
export { Matrix4, Vector3, Quaternion } from 'three';
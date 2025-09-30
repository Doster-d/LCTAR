import * as THREE from 'three';

/**
 * Математические функции для работы с якорями AprilTag
 */

/**
 * Конвертирует значение в THREE.Vector3
 * @param {Array|Object|THREE.Vector3} value - Значение для конвертации
 * @param {THREE.Vector3} fallback - Fallback значение при ошибке
 * @returns {THREE.Vector3}
 */
export function toVector3(value, fallback = new THREE.Vector3()) {
  if (value instanceof THREE.Vector3) {
    return value.clone();
  }

  if (Array.isArray(value) && value.length >= 3) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }

  if (typeof value === 'object' && value !== null) {
    const { x = 0, y = 0, z = 0 } = value;
    return new THREE.Vector3(x, y, z);
  }

  if (fallback instanceof THREE.Vector3) {
    return fallback.clone();
  }

  return new THREE.Vector3();
}

/**
 * Вычисляет средний кватернион из массива кватернионов
 * @param {THREE.Quaternion[]} quaternions - Массив кватернионов
 * @returns {THREE.Quaternion}
 */
export function averageQuaternion(quaternions) {
  if (!Array.isArray(quaternions) || quaternions.length === 0) {
    return new THREE.Quaternion();
  }

  if (quaternions.length === 1) {
    return quaternions[0].clone();
  }

  // Используем алгоритм усреднения кватернионов
  // Находим кватернион, наиболее близкий к остальным
  let bestQuaternion = quaternions[0].clone();
  let maxDot = -1;

  for (let i = 0; i < quaternions.length; i++) {
    let dot = 0;
    for (let j = 0; j < quaternions.length; j++) {
      if (i !== j) {
        dot += quaternions[i].dot(quaternions[j]);
      }
    }
    if (dot > maxDot) {
      maxDot = dot;
      bestQuaternion = quaternions[i].clone();
    }
  }

  return bestQuaternion.normalize();
}

/**
 * Находит лучшую точку пересечения из массива лучей
 * @param {Array<{origin: THREE.Vector3, direction: THREE.Vector3}>} rays - Массив лучей
 * @returns {THREE.Vector3|null}
 */
export function bestFitPointFromRays(rays) {
  if (!Array.isArray(rays) || rays.length === 0) {
    return null;
  }

  if (rays.length === 1) {
    // Для одного луча возвращаем точку на расстоянии 1 от origin
    return rays[0].origin.clone().add(
      rays[0].direction.clone().normalize()
    );
  }

  // Метод наименьших квадратов для нахождения точки, минимизирующей сумму расстояний до всех лучей
  const origins = rays.map(ray => ray.origin);
  const directions = rays.map(ray => ray.direction.clone().normalize());

  // Вычисляем центр масс начал лучей
  const centroid = new THREE.Vector3();
  origins.forEach(origin => centroid.add(origin));
  centroid.divideScalar(origins.length);

  // Итеративное уточнение точки пересечения
  let bestPoint = centroid.clone();
  const maxIterations = 100;
  const tolerance = 1e-6;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let totalDirection = new THREE.Vector3();
    let totalWeight = 0;

    for (let i = 0; i < rays.length; i++) {
      const origin = origins[i];
      const direction = directions[i];

      // Вектор от начала луча к текущей точке
      const toPoint = bestPoint.clone().sub(origin);

      // Проекция вектора на направление луча
      const projection = toPoint.dot(direction);

      // Направление коррекции
      const correction = toPoint.clone().sub(
        direction.clone().multiplyScalar(projection)
      );

      // Взвешиваем коррекцию
      const weight = 1.0 / (1.0 + correction.lengthSq());
      totalDirection.add(correction.multiplyScalar(weight));
      totalWeight += weight;
    }

    if (totalWeight > 0) {
      totalDirection.divideScalar(totalWeight);
      bestPoint.sub(totalDirection);

      // Проверяем сходимость
      if (totalDirection.lengthSq() < tolerance * tolerance) {
        break;
      }
    }
  }

  return bestPoint;
}

/**
 * Нормализует кватернион и обеспечивает корректный диапазон значений
 * @param {THREE.Quaternion} quaternion - Исходный кватернион
 * @returns {THREE.Quaternion}
 */
export function clampQuaternion(quaternion) {
  // Проверяем тип входного параметра и создаем корректный кватернион при необходимости
  let quat;
  if (quaternion instanceof THREE.Quaternion) {
    quat = quaternion;
  } else if (typeof quaternion === 'object' && quaternion !== null && 'w' in quaternion && 'x' in quaternion && 'y' in quaternion && 'z' in quaternion) {
    // Создаем кватернион из объекта с компонентами
    quat = new THREE.Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  } else {
    return new THREE.Quaternion();
  }

  // Выполняем операции clone и normalize с проверкой результата
  let normalized;
  try {
    const cloned = quat.clone();
    if (typeof cloned.normalize === 'function') {
      normalized = cloned.normalize();
    } else {
      normalized = cloned;
    }
  } catch (error) {
    return new THREE.Quaternion();
  }

  // Проверяем, что normalized является корректным THREE.Quaternion объектом
  if (!(normalized instanceof THREE.Quaternion)) {
    return new THREE.Quaternion();
  }

  // Убеждаемся, что кватернион в правильном диапазоне
  // Избегаем кватернионов с отрицательной скалярной частью для непрерывности
  if (normalized.w < 0 && typeof normalized.multiplyScalar === 'function') {
    normalized.multiplyScalar(-1);
  }

  return normalized;
}

/**
 * Применяет фильтрацию малых углов для предотвращения дрожания
 * @param {THREE.Quaternion} quaternion - Исходный кватернион
 * @param {number} deadZone - Зона мертвого угла в радианах
 * @param {number} softZone - Зона мягкого перехода в радианах
 * @returns {THREE.Quaternion}
 */
export function softenSmallAngleQuaternion(quaternion, deadZone = 0.01, softZone = 0.05) {
  if (!(quaternion instanceof THREE.Quaternion)) {
    return new THREE.Quaternion();
  }

  // Преобразуем кватернион в углы Эйлера для анализа
  const euler = new THREE.Euler().setFromQuaternion(quaternion);

  // Применяем фильтрацию к каждому углу
  const filteredEuler = new THREE.Euler(
    softenAngle(euler.x, deadZone, softZone),
    softenAngle(euler.y, deadZone, softZone),
    softenAngle(euler.z, deadZone, softZone)
  );

  // Возвращаем отфильтрованный кватернион
  return new THREE.Quaternion().setFromEuler(filteredEuler);
}

/**
 * Вспомогательная функция для фильтрации отдельного угла
 * @param {number} angle - Угол в радианах
 * @param {number} deadZone - Зона мертвого угла
 * @param {number} softZone - Зона мягкого перехода
 * @returns {number}
 */
function softenAngle(angle, deadZone, softZone) {
  const absAngle = Math.abs(angle);

  if (absAngle <= deadZone) {
    // В зоне мертвого угла - обнуляем угол
    return 0;
  } else if (absAngle <= softZone) {
    // В зоне мягкого перехода - применяем нелинейную фильтрацию
    const normalizedAngle = (absAngle - deadZone) / (softZone - deadZone);
    const filteredAngle = Math.sin(normalizedAngle * Math.PI / 2) * (absAngle - deadZone);
    return Math.sign(angle) * (deadZone + filteredAngle);
  }

  // За пределами зоны - возвращаем угол без изменений
  return angle;
}

/**
 * Вычисляет матрицу трансформации из позиции и кватерниона
 * @param {THREE.Vector3} position - Позиция
 * @param {THREE.Quaternion} quaternion - Поворот
 * @returns {THREE.Matrix4}
 */
export function createTransformMatrix(position, quaternion) {
  const matrix = new THREE.Matrix4();
  matrix.compose(
    position instanceof THREE.Vector3 ? position : toVector3(position),
    quaternion instanceof THREE.Quaternion ? quaternion : new THREE.Quaternion(),
    new THREE.Vector3(1, 1, 1)
  );
  return matrix;
}

/**
 * Извлекает позицию и поворот из матрицы трансформации
 * @param {THREE.Matrix4} matrix - Матрица трансформации
 * @returns {{position: THREE.Vector3, quaternion: THREE.Quaternion}}
 */
export function decomposeTransformMatrix(matrix) {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  matrix.decompose(position, quaternion, scale);

  return { position, quaternion };
}

/**
 * Вычисляет расстояние между двумя трансформациями
 * @param {THREE.Matrix4} transform1 - Первая трансформация
 * @param {THREE.Matrix4} transform2 - Вторая трансформация
 * @returns {number}
 */
export function getTransformDistance(transform1, transform2) {
  const decomp1 = decomposeTransformMatrix(transform1);
  const decomp2 = decomposeTransformMatrix(transform2);

  const positionDistance = decomp1.position.distanceTo(decomp2.position);
  const quaternionDistance = decomp1.quaternion.angleTo(decomp2.quaternion);

  return positionDistance + quaternionDistance * 10; // Взвешиваем угловое расстояние
}

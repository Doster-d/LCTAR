import { Matrix3, Quaternion, Vector3 } from 'three';

const EPS = 1e-6;

/**
 * @brief Вычисляет точку пересечения набора лучей методом наименьших квадратов.
 * @param rays Набор лучей с заданными началом и направлением.
 * @returns {Vector3|null} Приближение точки пересечения либо null, если решение не найдено.
 */
export function bestFitPointFromRays(rays) {
  if (!Array.isArray(rays) || rays.length === 0) {
    return null;
  }

  const m = new Matrix3().set(0, 0, 0, 0, 0, 0, 0, 0, 0);
  const b = new Vector3();

  rays.forEach(ray => {
    if (!ray?.origin || !ray?.direction) {
      return;
    }
    const origin = Array.isArray(ray.origin) ? new Vector3().fromArray(ray.origin) : ray.origin.clone?.() ?? new Vector3();
    const direction = Array.isArray(ray.direction) ? new Vector3().fromArray(ray.direction) : ray.direction.clone?.() ?? new Vector3();
    if (direction.lengthSq() < EPS) {
      return;
    }
    const d = direction.clone().normalize();

    const proj = [
      1 - d.x * d.x, -d.x * d.y, -d.x * d.z,
      -d.y * d.x, 1 - d.y * d.y, -d.y * d.z,
      -d.z * d.x, -d.z * d.y, 1 - d.z * d.z
    ];

    const elem = m.elements;
    elem[0] += proj[0]; elem[1] += proj[1]; elem[2] += proj[2];
    elem[3] += proj[3]; elem[4] += proj[4]; elem[5] += proj[5];
    elem[6] += proj[6]; elem[7] += proj[7]; elem[8] += proj[8];

    const projected = new Vector3(
      proj[0] * origin.x + proj[1] * origin.y + proj[2] * origin.z,
      proj[3] * origin.x + proj[4] * origin.y + proj[5] * origin.z,
      proj[6] * origin.x + proj[7] * origin.y + proj[8] * origin.z
    );
    b.add(projected);
  });

  const mat = new Matrix3().fromArray(m.elements);
  const det = mat.determinant();
  if (Math.abs(det) < EPS) {
    return null;
  }

  const inv = mat.invert();
  const result = b.clone().applyMatrix3(inv);
  return result;
}

/**
 * @brief Усредняет несколько кватернионов с учётом выравнивания полусфер.
 * @param quaternions Массив экземпляров Quaternion для усреднения.
 * @returns {Quaternion|null} Нормализованный усреднённый кватернион либо null для пустого массива.
 */
export function averageQuaternion(quaternions) {
  if (!Array.isArray(quaternions) || quaternions.length === 0) {
    return null;
  }

  const reference = quaternions[0].clone();
  let sx = reference.x;
  let sy = reference.y;
  let sz = reference.z;
  let sw = reference.w;

  for (let i = 1; i < quaternions.length; i += 1) {
    const q = quaternions[i].clone();
    if (reference.dot(q) < 0) {
      q.x *= -1;
      q.y *= -1;
      q.z *= -1;
      q.w *= -1;
    }
    sx += q.x;
    sy += q.y;
    sz += q.z;
    sw += q.w;
  }

  const averaged = new Quaternion(sx, sy, sz, sw);
  if (averaged.lengthSq() < EPS) {
    return reference.clone();
  }
  averaged.normalize();
  return averaged;
}

/**
 * @brief Приводит произвольное вектороподобное значение к Vector3 из Three.js.
 * @param value Представление входного вектора.
 * @param fallback Вектор по умолчанию при некорректном значении.
 * @returns {Vector3} Полученный клон вектора.
 */
export function toVector3(value, fallback = new Vector3()) {
  if (value instanceof Vector3) {
    return value.clone();
  }
  if (Array.isArray(value) && value.length >= 3) {
    return new Vector3(value[0], value[1], value[2]);
  }
  if (value && typeof value === 'object' && 'x' in value && 'y' in value && 'z' in value) {
    return new Vector3(value.x, value.y, value.z);
  }
  return fallback.clone();
}

/**
 * @brief Гарантирует нормализацию кватерниона, возвращая единичный при некорректных данных.
 * @param quaternion Экземпляр Quaternion для нормализации.
 * @returns {Quaternion} Нормализованный кватернион.
 */
export function clampQuaternion(quaternion) {
  if (!(quaternion instanceof Quaternion)) {
    return new Quaternion();
  }
  if (quaternion.lengthSq() < EPS) {
    quaternion.set(0, 0, 0, 1);
  } else {
    quaternion.normalize();
  }
  return quaternion;
}

/**
 * @brief Применяет dead zone и сглаживание для малых углов вращения.
 * @param quaternion Экземпляр Quaternion для обработки.
 * @param deadZone Угол (радианы), в пределах которого ориентация приравнивается к единичной.
 * @param softZone Угол (радианы), начиная с которого поведение остаётся без изменений.
 * @returns {Quaternion} Новый кватернион с приглушённым малым углом.
 */
export function softenSmallAngleQuaternion(quaternion, deadZone = 0.08, softZone = 0.22) {
  if (!(quaternion instanceof Quaternion)) {
    return new Quaternion();
  }

  const q = quaternion.clone();
  if (q.lengthSq() < EPS) {
    q.set(0, 0, 0, 1);
    return q;
  }

  q.normalize();
  const w = Math.min(Math.max(q.w, -1), 1);
  const angle = 2 * Math.acos(w);
  if (!Number.isFinite(angle) || angle < EPS) {
    return q;
  }

  const dz = Math.max(deadZone, 0);
  const sz = Math.max(softZone, dz + EPS);

  if (angle <= dz) {
    q.set(0, 0, 0, 1);
    return q;
  }
  if (angle >= sz) {
    return q;
  }

  const axis = new Vector3(q.x, q.y, q.z);
  const axisLen = axis.length();
  if (axisLen < EPS) {
    return q;
  }
  axis.divideScalar(axisLen);

  const ratio = (angle - dz) / (sz - dz);
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const eased = clamped * clamped * (3 - 2 * clamped); // smoothstep
  const softenedAngle = eased * angle;
  const half = softenedAngle * 0.5;
  const sinHalf = Math.sin(half);

  q.set(
    axis.x * sinHalf,
    axis.y * sinHalf,
    axis.z * sinHalf,
    Math.cos(half)
  );

  if (q.lengthSq() < EPS) {
    q.set(0, 0, 0, 1);
  } else {
    q.normalize();
  }

  return q;
}

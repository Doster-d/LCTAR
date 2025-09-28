import { Matrix4 } from 'three';

/**
 * @brief Динамически загружает и инициализирует модуль AlvaAR WASM.
 * @param width Желаемая ширина рабочей области трекера.
 * @param height Желаемая высота рабочей области трекера.
 * @returns {Promise<object>} Готовый экземпляр AlvaAR.
 */
export async function loadAlva(width, height) {
  const mod = await import(/* webpackIgnore: true */ '/alva/alva_ar.js');
  console.log('[DEBUG] alva_ar.js imported:', mod);
  const alva = await mod.AlvaAR.Initialize(width, height);
  console.log('[DEBUG] AlvaAR initialized:', alva);
  return alva;
}

/**
 * @brief Конвертирует позу AlvaAR в матрицу Three.js.
 * @param pose Источник с матрицей вращения и вектором смещения.
 * @returns {Matrix4|null} Однородная матрица преобразования или null, если поза некорректна.
 */
export function poseToMatrix4(pose) {
  console.log('[DEBUG poseToMatrix4] Input pose:', pose);
  if (!pose) {
    console.log('[DEBUG poseToMatrix4] Pose is null or undefined');
    return null;
  }
  const { R, t } = pose;
  console.log('[DEBUG poseToMatrix4] R:', R, 't:', t);
  const rf = Array.isArray(R?.[0]) ? R.flat() : R;
  console.log('[DEBUG poseToMatrix4] rf:', rf);
  if (!rf || rf.length !== 9 || !t || t.length !== 3) {
    console.log('[DEBUG poseToMatrix4] Invalid R or t: rf.length=' + (rf ? rf.length : 'null') + ', t.length=' + (t ? t.length : 'null'));
    return null;
  }
  const M = new Matrix4().set(
    rf[0], rf[1], rf[2], t[0],
    rf[3], rf[4], rf[5], t[1],
    rf[6], rf[7], rf[8], t[2],
    0,     0,     0,     1
  );
  console.log('[DEBUG poseToMatrix4] Created matrix:', M.toArray());
  return M;
}

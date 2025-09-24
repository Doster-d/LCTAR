import { Matrix4 } from 'three';

export async function loadAlva(width, height) {
  const mod = await import(/* webpackIgnore: true */ '/alva/alva_ar.js');
  console.log('[DEBUG] alva_ar.js imported:', mod);
  const alva = await mod.AlvaAR.Initialize(width, height);
  console.log('[DEBUG] AlvaAR initialized:', alva);
  return alva;
}

export function poseToMatrix4(pose) {
  if (!pose) return null;
  const { R, t } = pose;
  const rf = Array.isArray(R?.[0]) ? R.flat() : R;
  if (!rf || rf.length !== 9 || !t || t.length !== 3) return null;
  const M = new Matrix4().set(
    rf[0], rf[1], rf[2], t[0],
    rf[3], rf[4], rf[5], t[1],
    rf[6], rf[7], rf[8], t[2],
    0,     0,     0,     1
  );
  return M;
}

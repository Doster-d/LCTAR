import { request } from './client';

export const startSession = () =>
  request('/session/start/', { method: 'POST', body: {} });

export const sendViewEvent = (sessionId, assetSlug, extra = {}) =>
  request('/view/', {
    method: 'POST',
    body: { session_id: sessionId, asset_slug: assetSlug, ...extra },
  });

export const submitEmail = (sessionId, email) =>
  request('/user/email/', {
    method: 'POST',
    body: { session_id: sessionId, email },
  });

export const getSessionProgress = (sessionId) =>
  request(`/progress/?session_id=${encodeURIComponent(sessionId)}`);

export const getPromoBySession = (sessionId) =>
  request(`/promo/?session_id=${encodeURIComponent(sessionId)}`);

export const getPromoByUser = (userId) =>
  request(`/promo/?user_id=${encodeURIComponent(userId)}`);

export const getPromoByEmail = (email) =>
  request(`/promo/?email=${encodeURIComponent(email)}`);

export const getStats = () => request('/stats/');

export const getHealth = () => request('/health/');

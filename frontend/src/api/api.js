// Интегрированные API функции для React приложения
// Объединяет функциональность client.js и backend.js

import { useState, useCallback } from 'react';

/**
 * Кастомный хук для управления состоянием API запросов
 * @param {Function} apiFunction - функция API для выполнения
 * @returns {Object} - объект с состоянием и функцией execute
 */
export const useApi = (apiFunction) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiFunction(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFunction]);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset
  };
};

/**
 * Кастомный хук для выполнения API запросов без сохранения состояния
 * @param {Function} apiFunction - функция API для выполнения
 * @returns {Function} - функция для выполнения запроса
 */
export const useApiCall = (apiFunction) => {
  return useCallback(async (...args) => {
    return await apiFunction(...args);
  }, [apiFunction]);
};

// Утилиты для работы с API

export const normalizeBaseUrl = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

let apiState = {
  baseUrl: '',
};

export const setApiBaseUrl = (value) => {
  apiState = {
    ...apiState,
    baseUrl: normalizeBaseUrl(value),
  };
};

export const getApiBaseUrl = () => apiState.baseUrl;

export const configureApi = ({ baseUrl } = {}) => {
  if (typeof baseUrl === 'string') {
    setApiBaseUrl(baseUrl);
  }
};

const buildUrl = (path, baseUrl) => {
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  if (!baseUrl) {
    return path;
  }
  return `${baseUrl}${path}`;
};

// Функция получения CSRF токена из cookies
const getCsrfToken = () => {
  const name = 'csrftoken';
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
};

const parseResponseBody = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  if (contentType.includes('text/')) {
    return response.text();
  }
  if (response.status === 204) {
    return null;
  }
  try {
    return await response.text();
  } catch (error) {
    return null;
  }
};

// Основная функция запроса
export async function request(path, { method = 'GET', body, headers, baseUrl, ...rest } = {}) {
  const init = {
    method,
    ...rest,
  };

  const resolvedBaseUrl = typeof baseUrl === 'string'
    ? normalizeBaseUrl(baseUrl)
    : apiState.baseUrl;

  // Создаем базовые заголовки
  const requestHeaders = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(headers || {}),
  };

  // Добавляем CSRF токен для не-GET методов
  if (method !== 'GET') {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      requestHeaders['X-CSRFToken'] = csrfToken;
    }
  }

  init.headers = requestHeaders;

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(buildUrl(path, resolvedBaseUrl), init);
  } catch (error) {
    const networkError = new Error('Network error');
    networkError.cause = error;
    throw networkError;
  }

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    const detail = payload?.detail || payload?.message || payload;
    const error = new Error(typeof detail === 'string' ? detail : 'Request failed');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

// API функции для взаимодействия с бэкендом

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
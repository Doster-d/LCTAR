const normalizeBaseUrl = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const API_BASE_URL = 'https://localhost:8089/api';

const baseUrl = normalizeBaseUrl(API_BASE_URL);

const buildUrl = (path) => {
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  if (!baseUrl) {
    return path;
  }
  return `${baseUrl}${path}`;
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

export async function request(path, { method = 'GET', body, headers, ...rest } = {}) {
  const init = {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
    ...rest,
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(buildUrl(path), init);
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

export { baseUrl as apiBaseUrl };

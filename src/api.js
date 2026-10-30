export const TOKEN_KEY = 'agromarket_jwt';
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch(path, { token, headers, body, ...options } = {}) {
  const requestHeaders = new Headers(headers);
  const jwt = token === undefined ? localStorage.getItem(TOKEN_KEY) : token;
  if (jwt) requestHeaders.set('Authorization', `Bearer ${jwt}`);
  const requestBody = body && typeof body === 'object' && !(body instanceof FormData)
    ? JSON.stringify(body) : body;
  if (requestBody && !(body instanceof FormData)) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: requestHeaders,
      body: requestBody,
    });
  } catch {
    throw new ApiError(0, 'Сервер недоступен. Проверьте подключение.');
  }

  if (response.status === 204) return null;
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(response.status, 'Сервер вернул некорректный ответ.');
  }
  if (!response.ok) {
    throw new ApiError(response.status, data?.error || `Ошибка HTTP ${response.status}`);
  }
  return data;
}

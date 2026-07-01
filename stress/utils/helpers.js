import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'https://backend-bapp.onrender.com/api/v1';

export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

/**
 * Realiza login y retorna el access token.
 * Usa credenciales de variables de entorno para evitar hardcodeo.
 */
export function getAuthToken(email, password) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ username: email, password }),
    { headers: DEFAULT_HEADERS },
  );
  check(res, { 'login OK': (r) => r.status === 200 });
  if (res.status !== 200) return null;
  return res.json('access_token');
}

export function authHeaders(token) {
  return { ...DEFAULT_HEADERS, Authorization: `Bearer ${token}` };
}

/** Genera un correo único por VU + iteración para evitar colisiones en registro */
export function uniqueEmail(prefix) {
  return `${prefix}+${__VU}_${__ITER}@stress-test.invalid`;
}

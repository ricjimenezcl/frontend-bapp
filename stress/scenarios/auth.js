import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_HEADERS, uniqueEmail } from '../utils/helpers.js';

/**
 * Escenario de autenticación:
 * - Login exitoso
 * - Login con credenciales inválidas (debe dar 401)
 * - Refresh de token
 */
export function authScenario(token) {
  // Login válido (token ya obtenido en setup, aquí verificamos el endpoint)
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: __ENV.TEST_CLIENT_EMAIL || 'test@bappsearch.com',
      password: __ENV.TEST_CLIENT_PASSWORD || 'Test1234',
    }),
    { headers: DEFAULT_HEADERS },
  );
  check(loginRes, {
    'login status 200': (r) => r.status === 200,
    'login tiene access_token': (r) => r.json('access_token') !== undefined,
  });
  sleep(0.5);

  // Login inválido
  const badLogin = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: 'noexiste@test.invalid', password: 'wrongpass' }),
    { headers: DEFAULT_HEADERS },
  );
  check(badLogin, { 'login inválido → 401': (r) => r.status === 401 });
  sleep(0.3);

  // /auth/me con token
  if (token) {
    const meRes = http.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, ...DEFAULT_HEADERS },
    });
    check(meRes, { '/auth/me status 200': (r) => r.status === 200 });
  }
  sleep(0.5);
}

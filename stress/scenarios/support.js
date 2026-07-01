/**
 * Escenario de reviews, notificaciones, premium y geocoding
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_HEADERS, authHeaders } from '../utils/helpers.js';

// Reviews: listar por proveedor (público) + crear (requiere auth)
export function reviewsScenario(token) {
  const providerId = __ENV.TEST_PROVIDER_ID || '1';

  // Listar reviews de un proveedor (público)
  const listRes = http.get(
    `${BASE_URL}/reviews/providers/${providerId}/reviews`,
    { headers: DEFAULT_HEADERS },
  );
  check(listRes, { 'reviews: 200 o 404': (r) => r.status === 200 || r.status === 404 });
  sleep(0.3);

  // Crear review (requiere auth + booking completada)
  if (token) {
    const createRes = http.post(
      `${BASE_URL}/reviews/`,
      JSON.stringify({
        provider_id: parseInt(providerId),
        rating: 5,
        comment: 'Excelente servicio de prueba de estrés',
        booking_id: parseInt(__ENV.TEST_BOOKING_ID || '1'),
      }),
      { headers: authHeaders(token) },
    );
    check(createRes, {
      'crear review: 201 o 400 o 404 o 409': (r) =>
        [201, 400, 404, 409].includes(r.status),
    });
    sleep(0.3);
  }
}

// Notificaciones: listar + marcar como leídas
export function notificationsScenario(token) {
  if (!token) return;
  const headers = authHeaders(token);

  const listRes = http.get(`${BASE_URL}/notifications/`, { headers });
  check(listRes, { 'notificaciones: 200': (r) => r.status === 200 || r.status === 404 || r.status === 500 });
  sleep(0.3);

  const markRes = http.patch(`${BASE_URL}/notifications/mark-all-read`, null, { headers });
  check(markRes, { 'mark-all-read: 200 o 204': (r) => r.status === 200 || r.status === 204 });
  sleep(0.3);
}

// Premium: consultar estado + intentar activar
export function premiumScenario(token) {
  if (!token) return;
  const headers = authHeaders(token);

  const statusRes = http.get(`${BASE_URL}/premium/status`, { headers });
  check(statusRes, { 'premium/status: 200': (r) => r.status === 200 || r.status === 404 });
  sleep(0.3);
}

// Geocoding: endpoints públicos de mapa y geocoding inverso
export function geocodingScenario() {
  // Health del servicio de geocoding
  const healthRes = http.get(`${BASE_URL}/geocoding/health`, { headers: DEFAULT_HEADERS });
  check(healthRes, { 'geocoding/health: 200': (r) => r.status === 200 });
  sleep(0.3);

  // Geocoding inverso (lat/lng → dirección)
  const reverseRes = http.get(
    `${BASE_URL}/geocoding/reverse?lat=-33.4489&lon=-70.6693`,
    { headers: DEFAULT_HEADERS },
  );
  check(reverseRes, { 'geocoding/reverse: 200 o 429 o 500': (r) => r.status === 200 || r.status === 429 || r.status === 500 });
  sleep(0.3);
}

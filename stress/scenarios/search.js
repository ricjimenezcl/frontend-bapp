import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_HEADERS, authHeaders } from '../utils/helpers.js';

/**
 * Escenario de búsqueda de proveedores:
 * - Listado de categorías principales (público)
 * - Búsqueda de proveedores cercanos por servicio
 * - Búsqueda con múltiples servicios (endpoint unificado)
 */
export function searchScenario(token) {
  const headers = token ? authHeaders(token) : DEFAULT_HEADERS;

  // Categorías principales (sin auth)
  const catsRes = http.get(`${BASE_URL}/categories/main-categories`, {
    headers: DEFAULT_HEADERS,
  });
  check(catsRes, {
    'categorías status 200': (r) => r.status === 200,
    'categorías es array': (r) => Array.isArray(r.json()),
  });
  sleep(0.5);

  // Servicios disponibles
  const servicesRes = http.get(`${BASE_URL}/categories/services`, {
    headers: DEFAULT_HEADERS,
  });
  check(servicesRes, { 'servicios status 200': (r) => r.status === 200 });
  sleep(0.3);

  // Búsqueda nearby (requiere lat/lng)
  const nearbyRes = http.get(
    `${BASE_URL}/providers/nearby?lat=-33.4489&lng=-70.6693&radius=10`,
    { headers },
  );
  check(nearbyRes, {
    'nearby status 200 o 403': (r) => r.status === 200 || r.status === 403,
  });
  sleep(0.5);

  // Búsqueda por múltiples servicios (endpoint unificado para no gastar búsquedas extra)
  if (token) {
    const multiRes = http.get(
      `${BASE_URL}/providers/nearby/services?lat=-33.4489&lng=-70.6693&radius=10&service_ids=1,2`,
      { headers },
    );
    check(multiRes, {
      'nearby/services status 200 o 403': (r) => r.status === 200 || r.status === 403,
    });
    sleep(0.5);
  }
}

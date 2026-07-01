/**
 * Escenario de proveedor autenticado:
 * - Perfil y estadísticas
 * - Horarios de trabajo (GET)
 * - Reportes
 * - Cambio de password (solo valida endpoint, no cambia realmente)
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, authHeaders } from '../utils/helpers.js';

export function providerManagementScenario(token) {
  if (!token) return;
  const headers = authHeaders(token);

  // Perfil del proveedor
  const meRes = http.get(`${BASE_URL}/providers/me`, { headers });
  check(meRes, { 'providers/me: 200 o 404 o 403': (r) => r.status === 200 || r.status === 404 || r.status === 403 });
  sleep(0.3);

  // Estadísticas
  const statsRes = http.get(`${BASE_URL}/providers/stats`, { headers });
  check(statsRes, { 'providers/stats: 200 o 403': (r) => r.status === 200 || r.status === 403 });
  sleep(0.3);

  // Horarios de trabajo
  const hoursRes = http.get(`${BASE_URL}/working-hours/me`, { headers });
  check(hoursRes, { 'working-hours: 200 o 404 o 403': (r) => r.status === 200 || r.status === 404 || r.status === 403 });
  sleep(0.3);

  // Estado de validación de identidad
  const validationRes = http.get(`${BASE_URL}/providers/validation/status`, { headers });
  check(validationRes, { 'validation/status: 200 o 403': (r) => r.status === 200 || r.status === 403 });
  sleep(0.3);
}

export function reportsScenario(token) {
  if (!token) return;
  const headers = authHeaders(token);

  // Mis reportes
  const myReportsRes = http.get(`${BASE_URL}/reports/me`, { headers });
  check(myReportsRes, { 'reports/me: 200 o 403': (r) => r.status === 200 || r.status === 403 });
  sleep(0.3);
}

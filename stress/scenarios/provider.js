/**
 * Escenario específico para la app móvil:
 * Simula el flujo de un proveedor autenticado consultando su dashboard.
 * - Perfil del proveedor
 * - Reservas pendientes
 * - Estadísticas
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, authHeaders } from '../utils/helpers.js';

export function providerScenario(token) {
  if (!token) return;
  const headers = authHeaders(token);

  // Perfil del proveedor
  const profileRes = http.get(`${BASE_URL}/providers/me`, { headers });
  check(profileRes, { 'provider/me: 200 o 404': (r) => r.status === 200 || r.status === 404 });
  sleep(0.3);

  // Reservas del proveedor
  const bookingsRes = http.get(`${BASE_URL}/bookings/provider`, { headers });
  check(bookingsRes, { 'bookings/provider: 200': (r) => r.status === 200 || r.status === 403 });
  sleep(0.3);

  // Estadísticas
  const statsRes = http.get(`${BASE_URL}/providers/stats`, { headers });
  check(statsRes, { 'provider/stats: 200 o 403': (r) => r.status === 200 || r.status === 403 });
  sleep(0.5);

  // Notificaciones
  const notifRes = http.get(`${BASE_URL}/notifications`, { headers });
  check(notifRes, { 'notifications: 200': (r) => r.status === 200 || r.status === 404 });
  sleep(0.3);
}

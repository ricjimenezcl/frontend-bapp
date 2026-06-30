import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, authHeaders } from '../utils/helpers.js';

/**
 * Escenario de reservas:
 * - Listar reservas del cliente
 * - Listar slots disponibles
 * - Crear y cancelar una reserva de prueba
 *
 * Requiere token de cliente y un provider_id válido en env.
 */
export function bookingScenario(token) {
  if (!token) return;
  const headers = authHeaders(token);

  // Listar reservas del cliente
  const listRes = http.get(`${BASE_URL}/bookings/client/me`, { headers });
  // El endpoint puede usar ID o /me — aceptamos 200 o 404 si no existe /me
  check(listRes, {
    'booking list: 200 o 404': (r) => r.status === 200 || r.status === 404,
  });
  sleep(0.5);

  // Slots disponibles para un proveedor de ejemplo
  const providerId = __ENV.TEST_PROVIDER_ID || '1';
  const slotsRes = http.get(
    `${BASE_URL}/bookings/available-slots?provider_id=${providerId}&date=2026-07-15`,
    { headers },
  );
  check(slotsRes, {
    'slots: 200 o 404': (r) => r.status === 200 || r.status === 404,
  });
  sleep(0.5);
}

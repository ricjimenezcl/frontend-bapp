import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, authHeaders } from '../utils/helpers.js';

export function bookingFullScenario(token) {
  if (!token) return;
  const headers = authHeaders(token);

  // Obtener ID del usuario desde /auth/me
  const meRes = http.get(`${BASE_URL}/auth/me`, { headers });
  if (meRes.status !== 200) return;
  const userId = meRes.json('id');

  // Listar reservas del cliente usando su ID real
  if (userId) {
    const listRes = http.get(`${BASE_URL}/bookings/client/${userId}`, { headers });
    check(listRes, { 'bookings/client: 200 o 404': (r) => r.status === 200 || r.status === 404 });
    sleep(0.3);
  }

  const providerId = __ENV.TEST_PROVIDER_ID;
  if (!providerId) return;

  // Slots disponibles
  const slotsRes = http.get(
    `${BASE_URL}/bookings/available-slots?provider_id=${providerId}&date=2026-07-20`,
    { headers },
  );
  check(slotsRes, { 'slots: 200 o 404': (r) => r.status === 200 || r.status === 404 });
  sleep(0.3);

  // Crear reserva → dispara email send_booking_created
  const createRes = http.post(
    `${BASE_URL}/bookings/`,
    JSON.stringify({
      provider_id: parseInt(providerId),
      service_id: parseInt(__ENV.TEST_SERVICE_ID || '1'),
      scheduled_date: '2026-07-20',
      scheduled_time: '10:00:00',
      duration: 60,
      total_price: 25000,
      notes: 'Reserva de prueba de estrés',
    }),
    { headers },
  );
  check(createRes, {
    'crear reserva: 201 o 400 o 404 o 409 o 422': (r) =>
      [201, 400, 404, 409, 422].includes(r.status),
  });

  // El booking queda creado → dispara email al proveedor
  // DELETE /bookings/{id} no está disponible en el entorno actual (405)
  sleep(0.5);
}

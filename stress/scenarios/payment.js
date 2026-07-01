/**
 * Escenario de pagos:
 * - Crear intención de pago (payment intent)
 * - Confirmar pago (sin ejecutar Transbank real — se espera 400/422 sin token válido)
 *
 * Los endpoints de webhook se omiten (requieren firma Transbank).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, authHeaders } from '../utils/helpers.js';

export function paymentScenario(token) {
  if (!token) return;
  const headers = authHeaders(token);

  // Crear intención de pago — booking_id y payment_method son query params
  const intentRes = http.post(
    `${BASE_URL}/payments/create-intent?booking_id=999999&payment_method=webpay`,
    null,
    { headers },
  );
  check(intentRes, {
    'payment intent: 200 o 400 o 404 o 422': (r) =>
      r.status === 200 || r.status === 400 || r.status === 404 || r.status === 422,
  });
  sleep(0.5);
}

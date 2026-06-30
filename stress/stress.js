/**
 * STRESS TEST (Rampa hasta punto de quiebre)
 * Objetivo: Encontrar el límite de carga del backend.
 * Escenario: Incremento continuo de VUs hasta 50, luego bajada.
 * Duración total: ~12 minutos.
 * Uso: k6 run stress/stress.js -e TEST_CLIENT_EMAIL=x -e TEST_CLIENT_PASSWORD=y
 *
 * ADVERTENCIA: Ejecutar solo contra entorno de staging, nunca producción sin autorización.
 */
import { sleep } from 'k6';
import { getAuthToken } from './utils/helpers.js';
import { searchScenario } from './scenarios/search.js';
import { bookingScenario } from './scenarios/bookings.js';

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Rampa inicial
    { duration: '2m', target: 20 },   // Carga moderada
    { duration: '2m', target: 35 },   // Alta carga
    { duration: '2m', target: 50 },   // Pico máximo
    { duration: '2m', target: 20 },   // Bajada gradual
    { duration: '2m', target: 0 },    // Cooldown
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'],        // Toleramos hasta 10% de errores en stress
    http_req_duration: ['p(95)<10000'],    // 95% < 10s en condición de estrés
  },
};

export function setup() {
  const email = __ENV.TEST_CLIENT_EMAIL;
  const password = __ENV.TEST_CLIENT_PASSWORD;
  if (!email || !password) return { token: null };
  return { token: getAuthToken(email, password) };
}

export default function (data) {
  // Mezcla 70% búsqueda anónima + 30% con auth (simula tráfico real)
  const useAuth = Math.random() < 0.3;
  searchScenario(useAuth ? data.token : null);
  if (useAuth) bookingScenario(data.token);
  sleep(1);
}

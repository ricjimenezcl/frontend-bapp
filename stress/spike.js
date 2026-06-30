/**
 * SPIKE TEST (Pico repentino de tráfico)
 * Objetivo: Verificar recuperación ante un spike súbito.
 * Simula: Un evento viral o campaña que trae 40 usuarios simultáneos de golpe.
 * Duración total: ~5 minutos.
 * Uso: k6 run stress/spike.js
 */
import { sleep } from 'k6';
import { getAuthToken } from './utils/helpers.js';
import { searchScenario } from './scenarios/search.js';
import { authScenario } from './scenarios/auth.js';

export const options = {
  stages: [
    { duration: '10s', target: 1 },    // Línea base
    { duration: '30s', target: 40 },   // SPIKE: 40 usuarios en 30s
    { duration: '1m', target: 40 },    // Mantener pico
    { duration: '30s', target: 1 },    // Bajada
    { duration: '2m', target: 1 },     // Recuperación
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.15'],         // Permitimos hasta 15% errores en spike
    http_req_duration: ['p(99)<15000'],     // 99% < 15s en el peor caso
  },
};

export function setup() {
  const email = __ENV.TEST_CLIENT_EMAIL;
  const password = __ENV.TEST_CLIENT_PASSWORD;
  if (!email || !password) return { token: null };
  return { token: getAuthToken(email, password) };
}

export default function (data) {
  // Spike de búsquedas anónimas (tráfico más probable en viral)
  searchScenario(null);
  sleep(0.5);
}

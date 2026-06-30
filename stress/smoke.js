/**
 * SMOKE TEST — frontend-bapp (app móvil)
 * Igual que web-bapp pero incluye el escenario de proveedor móvil.
 * Uso: k6 run stress/smoke.js -e TEST_CLIENT_EMAIL=x -e TEST_CLIENT_PASSWORD=y
 */
import { sleep } from 'k6';
import http from 'k6/http';
import { getAuthToken } from './utils/helpers.js';
import { authScenario } from './scenarios/auth.js';
import { searchScenario } from './scenarios/search.js';
import { bookingScenario } from './scenarios/bookings.js';
import { chatScenario } from './scenarios/chat.js';
import { providerScenario } from './scenarios/provider.js';

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }));

export const options = {
  vus: 1,
  duration: '1m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<5000'],
  },
};

export function setup() {
  const email = __ENV.TEST_CLIENT_EMAIL;
  const password = __ENV.TEST_CLIENT_PASSWORD;
  if (!email || !password) {
    console.warn('Variables TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD no definidas');
    return { token: null };
  }
  return { token: getAuthToken(email, password) };
}

export default function (data) {
  const { token } = data;
  authScenario(token);
  searchScenario(token);
  bookingScenario(token);
  chatScenario(token);
  providerScenario(token);
  sleep(1);
}

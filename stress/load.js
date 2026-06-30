/**
 * LOAD TEST — frontend-bapp (app móvil)
 * Añade escenario de proveedor además de los comunes.
 * Uso: k6 run stress/load.js -e TEST_CLIENT_EMAIL=x -e TEST_CLIENT_PASSWORD=y
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
  scenarios: {
    busqueda_anonima: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 10 },
        { duration: '3m', target: 10 },
        { duration: '1m', target: 0 },
      ],
      exec: 'scenarioBusqueda',
    },
    clientes_autenticados: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 5 },
        { duration: '3m', target: 5 },
        { duration: '1m', target: 0 },
      ],
      exec: 'scenarioCliente',
    },
    proveedores: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 3 },
        { duration: '3m', target: 3 },
        { duration: '1m', target: 0 },
      ],
      exec: 'scenarioProveedor',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(90)<3000', 'p(95)<5000'],
  },
};

export function setup() {
  const email = __ENV.TEST_CLIENT_EMAIL;
  const password = __ENV.TEST_CLIENT_PASSWORD;
  if (!email || !password) return { token: null };
  return { token: getAuthToken(email, password) };
}

export function scenarioBusqueda() {
  searchScenario(null);
  sleep(1);
}

export function scenarioCliente(data) {
  searchScenario(data?.token);
  bookingScenario(data?.token);
  chatScenario(data?.token);
  sleep(1);
}

export function scenarioProveedor(data) {
  providerScenario(data?.token);
  sleep(1);
}

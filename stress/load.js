/**
 * LOAD TEST — Cobertura completa de todos los flujos
 *
 * Escenarios paralelos:
 *   busqueda_anonima      — búsqueda + geocoding (mayor volumen, sin auth)
 *   clientes_autenticados — booking completo + chat + reviews + notificaciones
 *   registro_emails       — registro + reset-password (dispara emails)
 *   proveedores           — gestión proveedor + reportes + premium
 *   pagos                 — payment intent (requiere auth)
 *
 * Uso:
 *   npm run stress:load
 *   npm run stress:load -- -e TEST_CLIENT_EMAIL=x -e TEST_CLIENT_PASSWORD=y \
 *     -e TEST_PROVIDER_ID=1 -e TEST_SERVICE_ID=1
 */
import { sleep } from 'k6';
import http from 'k6/http';
import { getAuthToken } from './utils/helpers.js';
import { authScenario } from './scenarios/auth.js';
import { searchScenario } from './scenarios/search.js';
import { bookingFullScenario } from './scenarios/booking-full.js';
import { chatScenario } from './scenarios/chat.js';
import { registrationScenario, registrationProviderScenario } from './scenarios/registration.js';
import { paymentScenario } from './scenarios/payment.js';
import { reviewsScenario, notificationsScenario, premiumScenario, geocodingScenario } from './scenarios/support.js';
import { providerManagementScenario, reportsScenario } from './scenarios/provider-management.js';

// Solo contar 5xx como fallos
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
    registro_emails: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 3 },
        { duration: '3m', target: 3 },
        { duration: '1m', target: 0 },
      ],
      exec: 'scenarioRegistro',
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
    pagos: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 2 },
        { duration: '3m', target: 2 },
        { duration: '1m', target: 0 },
      ],
      exec: 'scenarioPago',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(90)<5000', 'p(95)<8000'],
    'http_req_duration{scenario:busqueda_anonima}': ['p(95)<5000'],
    'http_req_duration{scenario:registro_emails}': ['p(95)<10000'],
    'http_req_duration{scenario:clientes_autenticados}': ['p(95)<8000'],
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
  geocodingScenario();
  sleep(1);
}

export function scenarioCliente(data) {
  const token = data?.token;
  searchScenario(token);
  bookingFullScenario(token);
  chatScenario(token);
  reviewsScenario(token);
  notificationsScenario(token);
  sleep(1);
}

export function scenarioRegistro() {
  registrationScenario();
  registrationProviderScenario();
  sleep(2);
}

export function scenarioProveedor(data) {
  const token = data?.token;
  providerManagementScenario(token);
  reportsScenario(token);
  premiumScenario(token);
  authScenario(token);
  sleep(1);
}

export function scenarioPago(data) {
  paymentScenario(data?.token);
  sleep(2);
}

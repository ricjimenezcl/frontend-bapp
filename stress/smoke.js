/**
 * SMOKE TEST — Cobertura completa, 1 VU, 2 minutos
 * Verifica que TODOS los endpoints responden correctamente.
 * Incluye flujos de email (registro, reset-password).
 *
 * Uso: npm run stress:smoke
 *   Con auth: npm run stress:smoke -- -e TEST_CLIENT_EMAIL=x -e TEST_CLIENT_PASSWORD=y
 */
import { sleep } from 'k6';
import http from 'k6/http';
import { getAuthToken } from './utils/helpers.js';
import { authScenario } from './scenarios/auth.js';
import { searchScenario } from './scenarios/search.js';
import { bookingFullScenario } from './scenarios/booking-full.js';
import { chatScenario } from './scenarios/chat.js';
import { registrationScenario } from './scenarios/registration.js';
import { paymentScenario } from './scenarios/payment.js';
import { reviewsScenario, notificationsScenario, premiumScenario, geocodingScenario } from './scenarios/support.js';
import { providerManagementScenario, reportsScenario } from './scenarios/provider-management.js';

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }));

export const options = {
  vus: 1,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<8000'],
  },
};

export function setup() {
  const email = __ENV.TEST_CLIENT_EMAIL;
  const password = __ENV.TEST_CLIENT_PASSWORD;
  if (!email || !password) {
    console.warn('Sin TEST_CLIENT_EMAIL/PASSWORD — flujos autenticados se saltarán');
    return { token: null };
  }
  return { token: getAuthToken(email, password) };
}

export default function (data) {
  const { token } = data;

  // Públicos
  searchScenario(null);
  geocodingScenario();

  // Emails: registro + reset password
  registrationScenario();

  // Autenticados
  authScenario(token);
  bookingFullScenario(token);
  chatScenario(token);
  reviewsScenario(token);
  notificationsScenario(token);
  premiumScenario(token);
  providerManagementScenario(token);
  reportsScenario(token);
  paymentScenario(token);

  sleep(1);
}

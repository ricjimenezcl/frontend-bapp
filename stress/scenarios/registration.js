import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_HEADERS, uniqueEmail } from '../utils/helpers.js';

export function registrationScenario() {
  // Usar @example.com — dominio válido que pasa Pydantic EmailStr
  const email = `stress-client-${__VU}-${__ITER}@example.com`;

  const registerRes = http.post(
    `${BASE_URL}/auth/register-client`,
    JSON.stringify({
      email,
      password: 'StressTest1',
      full_name: `Stress User ${__VU}`,
      phone: '+56912345678',
    }),
    { headers: DEFAULT_HEADERS },
  );
  check(registerRes, {
    'registro cliente: 201 o 409 o 422 o 429': (r) => r.status === 201 || r.status === 409 || r.status === 422 || r.status === 429,
  });
  sleep(1);

  // Reenvío de email de verificación
  const resendRes = http.post(
    `${BASE_URL}/auth/send-verification-email`,
    JSON.stringify({ email }),
    { headers: DEFAULT_HEADERS },
  );
  check(resendRes, {
    'reenvío verificación: 200 o 404 o 429': (r) => r.status === 200 || r.status === 404 || r.status === 429,
  });
  sleep(0.5);

  // Reset de password
  const resetRes = http.post(
    `${BASE_URL}/auth/reset-password`,
    JSON.stringify({ email }),
    { headers: DEFAULT_HEADERS },
  );
  check(resetRes, {
    'reset password email: 200 o 404 o 429': (r) => r.status === 200 || r.status === 404 || r.status === 429,
  });
  sleep(0.5);
}

export function registrationProviderScenario() {
  const email = `stress-provider-${__VU}-${__ITER}@example.com`;

  const registerRes = http.post(
    `${BASE_URL}/auth/register-provider`,
    JSON.stringify({
      email,
      password: 'StressTest1',
      full_name: `Stress Provider ${__VU}`,
      phone: '+56912345678',
    }),
    { headers: DEFAULT_HEADERS },
  );
  check(registerRes, {
    'registro proveedor: 201 o 409 o 422 o 429': (r) => r.status === 201 || r.status === 409 || r.status === 422 || r.status === 429,
  });
  sleep(1);
}

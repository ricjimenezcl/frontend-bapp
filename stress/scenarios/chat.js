import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, authHeaders } from '../utils/helpers.js';

export function chatScenario(token) {
  if (!token) return;
  const headers = authHeaders(token);

  const convRes = http.get(`${BASE_URL}/chat/conversations`, { headers });
  check(convRes, { 'conversaciones: 200 o 404': (r) => r.status === 200 || r.status === 404 });
  sleep(0.5);

  if (convRes.status === 200) {
    const convs = convRes.json();
    if (Array.isArray(convs) && convs.length > 0) {
      const convId = convs[0].id || convs[0].conversation_id;
      const msgsRes = http.get(`${BASE_URL}/chat/conversations/${convId}/messages`, { headers });
      check(msgsRes, { 'mensajes: 200 o 404': (r) => r.status === 200 || r.status === 404 });
    }
  }
  sleep(0.5);
}

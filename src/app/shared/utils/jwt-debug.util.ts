/**
 * Utilidad de diagnóstico TEMPORAL para depurar el flujo de Google Sign-In en Android.
 *
 * Decodifica (sin verificar firma) el payload de un JWT (id_token) y lo imprime
 * en consola para poder comparar visualmente:
 *   - aud  → debe ser igual al Client ID de Android registrado en Google Cloud Console
 *   - iss  → debe ser "https://accounts.google.com" o "accounts.google.com"
 *   - azp  → "authorized party", normalmente igual al aud
 *   - email_verified → debe ser true/"true"
 *
 * Uso: llamar logGoogleIdTokenPayload(idToken, 'login|register-client|register-provider')
 * justo después de obtener el idToken en el flujo nativo de Android.
 *
 * IMPORTANTE: Solo para diagnóstico. Remover las llamadas una vez resuelto el
 * problema de autorización de Google en Android.
 */
export function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch (error) {
    console.error('[jwt-debug] No se pudo decodificar el token:', error);
    return null;
  }
}

export function logGoogleIdTokenPayload(idToken: string, origin: string): void {
  const payload = decodeJwtPayload(idToken);
  if (!payload) {
    console.warn(`[jwt-debug:${origin}] idToken vacío o malformado`);
    return;
  }
  console.log(`[jwt-debug:${origin}] Google idToken payload:`, {
    aud: payload['aud'],
    iss: payload['iss'],
    azp: payload['azp'],
    email: payload['email'],
    email_verified: payload['email_verified'],
    exp: payload['exp'],
    sub: payload['sub'],
  });
}

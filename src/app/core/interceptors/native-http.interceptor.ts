import {
  HttpErrorResponse,
  HttpHeaders,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { from } from 'rxjs';

/**
 * Interceptor que reemplaza el transporte HTTP del WebView por CapacitorHttp
 * cuando la app corre en un dispositivo nativo (Android/iOS).
 *
 * Esto evita los errores CORS que ocurren porque el WebView envía
 * Origin: https://localhost, que el backend puede no tener en su lista de
 * orígenes permitidos. Las peticiones nativas no incluyen cabecera Origin.
 */
export const nativeHttpInterceptor: HttpInterceptorFn = (req, next) => {
  if (!Capacitor.isNativePlatform()) {
    return next(req);
  }
  return from(nativeRequest(req));
};

async function nativeRequest(req: any): Promise<HttpResponse<any>> {
  // Convertir HttpHeaders a objeto plano que CapacitorHttp espera
  const headers: Record<string, string> = {};
  req.headers.keys().forEach((key: string) => {
    const value = req.headers.get(key);
    if (value) headers[key] = value;
  });

  // Angular no agrega Content-Type en el interceptor (lo hace el XHR backend
  // que reemplazamos). Si el body es un objeto plano lo forzamos a JSON para
  // que CapacitorHttp serialice correctamente.
  const body = req.body ?? undefined;
  if (
    body !== undefined &&
    typeof body === 'object' &&
    !(body instanceof FormData) &&
    !headers['Content-Type'] &&
    !headers['content-type']
  ) {
    headers['Content-Type'] = 'application/json';
  }

  let response: any;
  try {
    response = await CapacitorHttp.request({
      url: req.urlWithParams,
      method: req.method,
      headers,
      data: body,
    });
  } catch (err: any) {
    // Error de red (sin conexión, timeout, etc.)
    throw new HttpErrorResponse({
      error: err,
      status: 0,
      statusText: 'Network Error',
      url: req.url,
    });
  }

  const responseHeaders = new HttpHeaders(response.headers ?? {});

  // Errores HTTP (4xx, 5xx) deben llegar al errorInterceptor como HttpErrorResponse
  if (response.status >= 400) {
    throw new HttpErrorResponse({
      error: response.data,
      headers: responseHeaders,
      status: response.status,
      url: req.url,
    });
  }

  return new HttpResponse({
    body: response.data,
    headers: responseHeaders,
    status: response.status,
    url: req.url,
  });
}

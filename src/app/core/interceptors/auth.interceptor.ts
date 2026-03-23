// src/app/core/interceptors/auth.interceptor.ts
import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse,
  HttpClient
} from '@angular/common/http';
import { Observable, throwError, from, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { Router } from '@angular/router';
import { StorageService } from '../storage/storage.service';
import { AlertController } from '@ionic/angular';
import { environment } from '../../../environments/environment';

// Dominios externos que NO deben recibir el JWT token
const EXTERNAL_DOMAINS = [
  'photon.komoot.io',
  'nominatim.openstreetmap.org',
  'maps.geoapify.com',
  'tiles.openfreemap.org',
  'api.openfreemap.org',
];

/**
 * Interceptor que agrega el token de autenticación a las peticiones
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>, 
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const storageService = inject(StorageService);

  // Si es una API externa, pasar sin token
  const isExternal = EXTERNAL_DOMAINS.some(domain => req.url.includes(domain));
  if (isExternal) {
    return next(req);
  }
  
  // URLs que no requieren autenticación
  const publicUrls = [
    '/auth/login',
    '/auth/register',
    '/auth/google',
    '/auth/facebook',
    '/categories/main-categories',
    '/categories/services'
  ];
  
  // Verificar si es una URL pública
  const isPublicUrl = publicUrls.some(url => req.url.includes(url));
  
  if (isPublicUrl) {
    return next(req);
  }
  
  // Intentar obtener token de forma síncrona primero (localStorage)
  let token = localStorage.getItem('token');
  
  if (token) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(authReq);
  }
  
  // Si no hay token en localStorage, intentar obtenerlo de SQLite
  return from(storageService.getAccessToken()).pipe(
    switchMap(asyncToken => {
      if (asyncToken) {
        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${asyncToken}`
          }
        });
        return next(authReq);
      }
      
      // Sin token, enviar request sin auth
      return next(req);
    })
  );
};

/**
 * Estado del refresh — compartido entre llamadas concurrentes que fallen con 401.
 * Evita múltiples llamadas a /auth/refresh simultáneas.
 */
let isRefreshing = false;
let refreshToken$ = new BehaviorSubject<string | null>(null);
let isShowingSessionAlert = false;

/**
 * Realiza el refresh del token y lo almacena. Retorna el nuevo token o null si falla.
 */
async function attemptTokenRefresh(http: HttpClient, storageService: StorageService): Promise<string | null> {
  const currentToken = localStorage.getItem('token');
  if (!currentToken) return null;
  try {
    const response: any = await http.post(
      `${environment.apiUrl}/auth/refresh`,
      {},
      { headers: { Authorization: `Bearer ${currentToken}` } }
    ).toPromise();
    const newToken: string = response?.access_token;
    if (newToken) {
      localStorage.setItem('token', newToken);
      await storageService.setAccessToken(newToken);
      return newToken;
    }
  } catch {
    // Refresh falló — el token está completamente expirado
  }
  return null;
}

/**
 * Interceptor que maneja errores HTTP globalmente con silent refresh en 401.
 */
export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const router = inject(Router);
  const storageService = inject(StorageService);
  const alertController = inject(AlertController);
  const http = inject(HttpClient);

  // No aplicar refresh en APIs externas, refresh o login
  const isExternal = EXTERNAL_DOMAINS.some(domain => req.url.includes(domain));
  const isAuthCall = req.url.includes('/auth/refresh') || req.url.includes('/auth/login');

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('🔴 HTTP Error:', error.status, error.url);

      if (error.status === 401 && !isAuthCall && !isExternal) {
        if (isRefreshing) {
          return refreshToken$.pipe(
            filter(t => t !== null),
            take(1),
            switchMap(newToken => {
              const retried = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
              return next(retried);
            })
          );
        }

        isRefreshing = true;
        refreshToken$.next(null);

        return from(attemptTokenRefresh(http, storageService)).pipe(
          switchMap(newToken => {
            isRefreshing = false;
            if (newToken) {
              refreshToken$.next(newToken);
              const retried = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
              return next(retried);
            }
            return from(showSessionExpiredAlert(alertController, storageService, router)).pipe(
              switchMap(() => throwError(() => error))
            );
          }),
          catchError(refreshErr => {
            isRefreshing = false;
            return from(showSessionExpiredAlert(alertController, storageService, router)).pipe(
              switchMap(() => throwError(() => refreshErr))
            );
          })
        );
      }

      if (error.status === 403) {
        console.log('⚠️ Error 403: Acceso denegado');
      }
      if (error.status === 500) {
        console.error('🔴 Error 500: Error interno del servidor');
      }
      if (error.status === 0) {
        console.error('🔴 Error de red: Sin conexión al servidor');
      }

      return throwError(() => error);
    })
  );
};

async function showSessionExpiredAlert(
  alertController: AlertController,
  storageService: StorageService,
  router: Router
): Promise<void> {
  if (router.url.includes('/auth/login') || isShowingSessionAlert) return;
  isShowingSessionAlert = true;
  await storageService.clearSession();
  const alert = await alertController.create({
    header: 'Sesión expirada',
    message: 'Tu sesión ha finalizado por inactividad. Por favor, inicia sesión nuevamente.',
    backdropDismiss: false,
    buttons: [{
      text: 'Aceptar',
      handler: () => {
        isShowingSessionAlert = false;
        router.navigate(['/auth/login'], { replaceUrl: true, queryParams: { sessionExpired: 'true' } });
      }
    }]
  });
  await alert.present();
}

/**
 * Interceptor de logging para desarrollo
 */
export const loggingInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>, 
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const startTime = Date.now();
  
  console.log(`📤 [${req.method}] ${req.url}`);
  
  return next(req).pipe(
    catchError((error) => {
      const duration = Date.now() - startTime;
      console.log(`📥 [${req.method}] ${req.url} - ${error.status} (${duration}ms)`);
      return throwError(() => error);
    })
  );
};

/**
 * Interceptor que agrega headers comunes
 */
export const headersInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>, 
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  if (req.headers.has('Content-Type')) {
    return next(req);
  }
  
  if (req.body instanceof FormData) {
    return next(req);
  }
  
  const modifiedReq = req.clone({
    setHeaders: {
      'Accept': 'application/json'
    }
  });
  
  return next(modifiedReq);
};

/**
 * Interceptor para manejar caché offline
 */
export const offlineCacheInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>, 
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  if (req.method !== 'GET') {
    return next(req);
  }
  
  if (!navigator.onLine) {
    console.log('📴 Offline: Intentando obtener desde cache');
  }
  
  return next(req);
};
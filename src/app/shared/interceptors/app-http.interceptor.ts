import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';

import { StateService } from '../services/state.service';
import { ErrorHandlerService } from '../services/error-handler.service';

@Injectable()
export class AppHttpInterceptor implements HttpInterceptor {
  constructor(
    private stateService: StateService,
    private errorHandlerService: ErrorHandlerService,
    private router: Router
  ) {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    // Agregar token al header si existe
    const token = this.stateService.getToken();
    if (token && !request.headers.has('Authorization')) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        return this.handleError(error);
      })
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const appError = this.errorHandlerService.handleError(error);

    switch (error.status) {
      case 401:
        return this.handleUnauthorized(appError);

      case 403:
        return this.handleForbidden(appError);

      case 422:
        return this.handleValidationError(error, appError);

      case 0:
        return this.handleNetworkError(appError);

      default:
        this.errorHandlerService.showError(appError);
        return throwError(() => appError);
    }
  }

  /**
   * Maneja errores 401 (No autorizado)
   * Limpia el estado y redirige al login
   */
  private handleUnauthorized(appError: any): Observable<never> {
    this.stateService.clearState();
    this.errorHandlerService.showError(appError);
    this.router.navigate(['/auth/login']);
    return throwError(() => appError);
  }

  /**
   * Maneja errores 403 (Prohibido)
   * El usuario está autenticado pero no tiene permisos
   */
  private handleForbidden(appError: any): Observable<never> {
    this.errorHandlerService.showError(appError);
    this.router.navigate(['/home']);
    return throwError(() => appError);
  }

  /**
   * Maneja errores 422 (Validación)
   * Extrae errores de validación del servidor
   */
  private handleValidationError(
    error: HttpErrorResponse,
    appError: any
  ): Observable<never> {
    // Los errores de validación generalmente no se muestran automáticamente
    // El componente debe manejarlos específicamente
    console.warn('Validation error:', error.error);
    return throwError(() => appError);
  }

  /**
   * Maneja errores de red
   */
  private handleNetworkError(appError: any): Observable<never> {
    this.errorHandlerService.showError(appError);
    return throwError(() => appError);
  }
}

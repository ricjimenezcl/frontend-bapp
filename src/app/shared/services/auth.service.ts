import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { StateService } from './state.service';
import { ErrorHandlerService } from './error-handler.service';
import { APP_CONSTANTS } from '../constants/app.constants';
import { WebSocketService } from '../../core/services/websocket.service';

export interface LoginResponse {
  token: string;
  user: any;
}

export interface RegisterResponse {
  token: string;
  user: any;
}

/**
 * Servicio de autenticación
 * Maneja login, register, perfil y token
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = `${APP_CONSTANTS.API.BASE_URL}/auth`;

  constructor(
    private http: HttpClient,
    private stateService: StateService,
    private errorHandler: ErrorHandlerService,
    private webSocketService: WebSocketService
  ) {}

  /**
   * Login para cliente
   * ✅ CORRECTO - Usa throwError en catchError
   */
  loginClient(credentials: any): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        // ✅ Guardar en state
        this.stateService.setToken(response.token);
        this.stateService.setUser(response.user);
      }),
      catchError(error => {
        // ✅ CORRECTO - throwError(() => error)
        return throwError(() => error);
      })
    );
  }

  /**
   * Login para proveedor
   * ✅ CORRECTO - Usa throwError en catchError
   */
  loginProvider(credentials: any): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        this.stateService.setToken(response.token);
        this.stateService.setUser(response.user);
      }),
      catchError(error => {
        // ✅ CORRECTO
        return throwError(() => error);
      })
    );
  }

  /**
   * Register para cliente
   * ✅ CORRECTO - Usa throwError en catchError
   */
  registerClient(data: any): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register/client`, data).pipe(
      tap(response => {
        this.stateService.setToken(response.token);
        this.stateService.setUser(response.user);
      }),
      catchError(error => {
        // ✅ CORRECTO
        return throwError(() => error);
      })
    );
  }

  /**
   * Register para proveedor
   * ✅ CORRECTO - Usa throwError en catchError
   */
  registerProvider(data: any): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register/provider`, data).pipe(
      tap(response => {
        this.stateService.setToken(response.token);
        this.stateService.setUser(response.user);
      }),
      catchError(error => {
        // ✅ CORRECTO
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener usuario actual
   * ✅ CORRECTO - Usa throwError en catchError
   */
  getCurrentUser(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me`).pipe(
      catchError(error => {
        // ✅ CORRECTO
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener perfil del usuario
   * ✅ CORRECTO - Usa throwError en catchError
   */
  getProfile(): Observable<any> {
    return this.http.get(`${this.apiUrl}/profile`).pipe(
      catchError(error => {
        // ✅ CORRECTO
        return throwError(() => error);
      })
    );
  }

  /**
   * Actualizar perfil
   * ✅ CORRECTO - Usa throwError en catchError
   */
  updateProfile(data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/profile`, data).pipe(
      tap(response => {
        this.stateService.setUser(response.user);
      }),
      catchError(error => {
        // ✅ CORRECTO
        return throwError(() => error);
      })
    );
  }

  /**
   * Cambiar contraseña
   * ✅ CORRECTO - Usa throwError en catchError
   */
  changePassword(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/change-password`, data).pipe(
      catchError(error => {
        // ✅ CORRECTO
        return throwError(() => error);
      })
    );
  }

  /**
   * Solicitar reset de contraseña
   * ✅ CORRECTO - Usa throwError en catchError
   */
  requestPasswordReset(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email }).pipe(
      catchError(error => {
        // ✅ CORRECTO
        return throwError(() => error);
      })
    );
  }

  /**
   * Confirmar reset de contraseña
   * ✅ CORRECTO - Usa throwError en catchError
   */
  confirmPasswordReset(token: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, {
      token,
      newPassword
    }).pipe(
      catchError(error => {
        // ✅ CORRECTO
        return throwError(() => error);
      })
    );
  }

  /**
   * Refresh token
   * ✅ CORRECTO - Usa throwError en catchError
   */
  refreshToken(): Observable<any> {
    return this.http.post(`${this.apiUrl}/refresh`, {}).pipe(
      tap(response => {
        this.stateService.setToken(response.token);
      }),
      catchError(error => {
        // ✅ CORRECTO
        return throwError(() => error);
      })
    );
  }

  /**
   * Logout
   * ✅ CORRECTO - Usa throwError en catchError
   */
  logout(): Observable<any> {
    // Cerrar conexiones WebSocket antes de limpiar estado
    this.webSocketService.disconnectAll();
    this.stateService.clearState();
    return this.http.post(`${this.apiUrl}/logout`, {}).pipe(
      catchError(error => {
        // ✅ CORRECTO
        return throwError(() => error);
      })
    );
  }

  /**
   * Verificar si está autenticado
   * ✅ CORRECTO - Síncrono, sin Observable
   */
  isAuthenticated(): boolean {
    const token = this.stateService.getToken();
    return !!token;
  }
}
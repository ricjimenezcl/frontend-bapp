import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, from, of } from 'rxjs';
import { catchError, switchMap, retry, timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { StorageService } from '../../core/storage/storage.service';

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;
  private http = inject(HttpClient);
  private storageService = inject(StorageService);

  /**
   * Obtiene los headers con el token de autenticación
   */
  private async getHeaders(): Promise<HttpHeaders> {
    // Intentar obtener token de SQLite primero, luego localStorage
    let token = await this.storageService.getAccessToken();
    
    if (!token) {
      token = localStorage.getItem('token');
    }
    
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
  }

  /**
   * Obtiene headers sincrónicamente (para casos donde async no es posible)
   */
  private getHeadersSync(): HttpHeaders {
    const token = localStorage.getItem('token');
    
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
  }

  /**
   * GET request
   */
  get<T>(endpoint: string, params?: HttpParams): Observable<T> {
    return from(this.getHeaders()).pipe(
      switchMap(headers => 
        this.http.get<T>(`${this.apiUrl}${endpoint}`, { 
          headers, 
          params 
        })
      ),
      timeout(30000),
      retry(1),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * POST request
   */
  post<T>(endpoint: string, data: any): Observable<T> {
    return from(this.getHeaders()).pipe(
      switchMap(headers => 
        this.http.post<T>(`${this.apiUrl}${endpoint}`, data, { headers })
      ),
      timeout(30000),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * PUT request
   */
  put<T>(endpoint: string, data: any): Observable<T> {
    return from(this.getHeaders()).pipe(
      switchMap(headers => 
        this.http.put<T>(`${this.apiUrl}${endpoint}`, data, { headers })
      ),
      timeout(30000),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * PATCH request
   */
  patch<T>(endpoint: string, data: any): Observable<T> {
    return from(this.getHeaders()).pipe(
      switchMap(headers => 
        this.http.patch<T>(`${this.apiUrl}${endpoint}`, data, { headers })
      ),
      timeout(30000),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * DELETE request
   */
  delete<T>(endpoint: string): Observable<T> {
    return from(this.getHeaders()).pipe(
      switchMap(headers => 
        this.http.delete<T>(`${this.apiUrl}${endpoint}`, { headers })
      ),
      timeout(30000),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * POST con FormData (para archivos)
   */
  postFormData<T>(endpoint: string, formData: FormData): Observable<T> {
    return from(this.storageService.getAccessToken()).pipe(
      switchMap(token => {
        let headers = new HttpHeaders();
        if (token) {
          headers = headers.set('Authorization', `Bearer ${token}`);
        }
        // No establecer Content-Type, el browser lo hace automáticamente con boundary
        return this.http.post<T>(`${this.apiUrl}${endpoint}`, formData, { headers });
      }),
      timeout(60000), // Más tiempo para uploads
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * POST con URL-encoded (para OAuth)
   */
  postUrlEncoded<T>(endpoint: string, data: { [key: string]: string }): Observable<T> {
    const body = new URLSearchParams();
    Object.keys(data).forEach(key => body.set(key, data[key]));
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded'
    });
    
    return this.http.post<T>(`${this.apiUrl}${endpoint}`, body.toString(), { headers }).pipe(
      timeout(30000),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * GET con parámetros de paginación
   */
  getPaginated<T>(
    endpoint: string, 
    page: number = 1, 
    limit: number = 20,
    additionalParams?: { [key: string]: string }
  ): Observable<PaginatedResponse<T>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    
    if (additionalParams) {
      Object.keys(additionalParams).forEach(key => {
        params = params.set(key, additionalParams[key]);
      });
    }
    
    return this.get<PaginatedResponse<T>>(endpoint, params);
  }

  /**
   * Manejo centralizado de errores
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('❌ API Error:', error);
    
    let errorMessage = 'Error desconocido';
    
    if (error.error instanceof ErrorEvent) {
      // Error del cliente (ej: red)
      errorMessage = `Error de conexión: ${error.error.message}`;
    } else {
      // Error del servidor
      switch (error.status) {
        case 0:
          errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
          break;
        case 400:
          errorMessage = error.error?.detail || 'Solicitud inválida';
          break;
        case 401:
          errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
          // Aquí podrías emitir un evento para hacer logout automático
          break;
        case 403:
          errorMessage = 'No tienes permisos para realizar esta acción';
          break;
        case 404:
          errorMessage = 'Recurso no encontrado';
          break;
        case 422:
          errorMessage = this.parseValidationErrors(error.error);
          break;
        case 500:
          errorMessage = 'Error interno del servidor. Intenta más tarde.';
          break;
        default:
          errorMessage = error.error?.detail || error.error?.message || `Error ${error.status}`;
      }
    }
    
    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      error: error.error
    }));
  }

  /**
   * Parsea errores de validación de FastAPI
   */
  private parseValidationErrors(error: any): string {
    if (error?.detail && Array.isArray(error.detail)) {
      return error.detail.map((err: any) => {
        const field = err.loc?.join('.') || 'campo';
        return `${field}: ${err.msg}`;
      }).join(', ');
    }
    return error?.detail || 'Error de validación';
  }

  /**
   * Verifica si hay conexión a internet
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * URL base de la API
   */
  getApiUrl(): string {
    return this.apiUrl;
  }
}

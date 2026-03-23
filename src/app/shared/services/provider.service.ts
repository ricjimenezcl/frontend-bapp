import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { throwError } from 'rxjs';

import { ErrorHandlerService } from './error-handler.service';
import { APP_CONSTANTS } from '../constants/app.constants';

export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration: number; // en minutos
  image_url?: string;
  is_active: boolean;
}

export interface ProviderService {
  service_id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration: number;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  rating: number;
  reviews_count: number;
}

export interface CreateServiceRequest {
  name: string;
  description: string;
  category: string;
  price: number;
  duration: number;
  image?: File;
}

export interface UpdateServiceRequest extends Partial<CreateServiceRequest> {}

@Injectable({
  providedIn: 'root'
})
export class ProviderService {
  private apiUrl = `${APP_CONSTANTS.API.BASE_URL}/providers`;

  constructor(
    private http: HttpClient,
    private errorHandler: ErrorHandlerService
  ) {}

  /**
   * Obtiene el perfil del proveedor actual
   */
  getProfile(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me`).pipe(
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Actualiza el perfil del proveedor
   */
  updateProfile(data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/me`, data).pipe(
      tap(() => this.errorHandler.showSuccess('Perfil actualizado')),
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene todos los servicios del proveedor
   */
  getServices(): Observable<Service[]> {
    return this.http.get<Service[]>(`${this.apiUrl}/me/services`).pipe(
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene un servicio específico
   */
  getService(serviceId: string): Observable<Service> {
    return this.http.get<Service>(
      `${this.apiUrl}/me/services/${serviceId}`
    ).pipe(
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Crea un nuevo servicio
   */
  createService(data: CreateServiceRequest): Observable<Service> {
    const formData = this.buildFormData(data);

    return this.http.post<Service>(
      `${this.apiUrl}/me/services`,
      formData
    ).pipe(
      tap(() => this.errorHandler.showSuccess('Servicio creado')),
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Actualiza un servicio existente
   */
  updateService(
    serviceId: string,
    data: UpdateServiceRequest
  ): Observable<Service> {
    const formData = this.buildFormData(data);

    return this.http.put<Service>(
      `${this.apiUrl}/me/services/${serviceId}`,
      formData
    ).pipe(
      tap(() => this.errorHandler.showSuccess('Servicio actualizado')),
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Elimina un servicio
   */
  deleteService(serviceId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/me/services/${serviceId}`
    ).pipe(
      tap(() => this.errorHandler.showSuccess('Servicio eliminado')),
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene servicios de otros proveedores cercanos
   */
  getNearbyServices(
    latitude: number,
    longitude: number,
    radiusKm: number = APP_CONSTANTS.COORDINATES.SEARCH_RADIUS_KM
  ): Observable<ProviderService[]> {
    return this.http.get<ProviderService[]>(
      `${this.apiUrl}/nearby`,
      {
        params: {
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          radius_km: radiusKm.toString()
        }
      }
    ).pipe(
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Busca servicios por categoría
   */
  searchServices(
    category: string,
    page: number = 1,
    pageSize: number = APP_CONSTANTS.PAGINATION.DEFAULT_PAGE_SIZE
  ): Observable<{ services: ProviderService[]; total: number }> {
    return this.http.get<{ services: ProviderService[]; total: number }>(
      `${this.apiUrl}/search`,
      {
        params: {
          category,
          page: page.toString(),
          page_size: pageSize.toString()
        }
      }
    ).pipe(
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene proveedores destacados
   */
  getFeaturedProviders(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/featured`
    ).pipe(
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene detalles de un proveedor específico
   */
  getProviderDetails(providerId: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/${providerId}`
    ).pipe(
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  private buildFormData(data: any): FormData {
    const formData = new FormData();

    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        if (data[key] instanceof File) {
          formData.append(key, data[key]);
        } else {
          formData.append(key, String(data[key]));
        }
      }
    });

    return formData;
  }
}


// src/app/provider/services/provider.service.ts
import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { map, catchError, tap, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// ==================== INTERFACES ====================

// ProviderProfile se importa desde el modelo centralizado
import { ProviderProfile } from '../../core/models/provider.model';
export { ProviderProfile };

export interface ProviderServices {
  id: number;
  provider_id: number;
  service_category_id: number;
  business_name: string;
  description: string;
  hourly_rate: number;
  is_available: boolean;
  validation_status: string;
  service_category?: {
    id: number;
    name: string;
    icon?: string;
  };
  created_at?: string;
}

export interface ServiceProviderData {
  id: number;
  provider_id: number;
  service_id: number;
  business_name: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  hourly_rate: number;
  is_available: boolean;
  validation_status: string;
  rating_avg: number;
  total_reviews: number;
  created_at: string;
  service_category?: {
    id: number;
    name: string;
    description: string;
    icon: string;
  };
}

export interface ProviderStats {
  total_services: number;
  active_services: number;
  pending_services: number;
  total_bookings: number;
  completed_bookings: number;
  pending_bookings: number;
  total_earnings: number;
  average_rating: number;
  profile_views: number;
  service_views: number;
  zone_searches: number;
}

// ==================== SERVICE ====================

@Injectable({
  providedIn: 'root'
})
export class ProviderService {

  private apiUrl = environment.apiUrl;

  // Signals para estado
  private _providerProfile = signal<ProviderProfile | null>(null);
  private _providerServices = signal<ProviderServices[]>([]);
  private _providerStats = signal<ProviderStats | null>(null);
  private _isLoading = signal<boolean>(false);

  // Public readonly signals
  public readonly providerProfile = this._providerProfile.asReadonly();
  public readonly providerServices = this._providerServices.asReadonly();
  public readonly providerStats = this._providerStats.asReadonly();
  public readonly isLoading = this._isLoading.asReadonly();

  constructor(private http: HttpClient) {
    // console.log('ProviderService initialized');
  }

  // ==================== PERFIL ====================

  getProviderProfile(providerId?: string): Observable<ProviderProfile> {
    this._isLoading.set(true);
    return this.http.get<ProviderProfile>(`${this.apiUrl}/providers/me`).pipe(
      tap(profile => {
        this._providerProfile.set(profile);
        this._isLoading.set(false);
      }),
      catchError(error => {
        this._isLoading.set(false);
        console.error('Error fetching provider profile:', error);
        return throwError(() => error);
      })
    );
  }

  // Shared in-flight request — prevents parallel HTTP calls during simultaneous init
  private _profileRequest$: Observable<ProviderProfile> | null = null;

  getMyProfile(): Observable<ProviderProfile> {
    const cached = this._providerProfile();
    if (cached) return of(cached);
    if (!this._profileRequest$) {
      this._profileRequest$ = this.getProviderProfile().pipe(
        tap(() => { this._profileRequest$ = null; }),
        shareReplay(1)
      );
    }
    return this._profileRequest$;
  }

  invalidateProfileCache(): void {
    this._providerProfile.set(null);
    this._profileRequest$ = null;
  }

  
  updateProviderProfile(providerId?: string, data?: Partial<ProviderProfile>): Observable<ProviderProfile> {
    return this.http.patch<ProviderProfile>(`${this.apiUrl}/providers/me`, data).pipe(
      tap(profile => this._providerProfile.set(profile)),
      catchError(error => {
        console.error('Error updating provider profile:', error);
        return throwError(() => error);
      })
    );
  }

  // Alias para compatibilidad
  putProviderProfileEdit(providerId: string, data: Partial<ProviderProfile>): Observable<ProviderProfile> {
    return this.updateProviderProfile(providerId, data);
  }

  // ==================== SERVICIOS DEL PROVEEDOR ====================

  
  getProviderServices(providerId: string): Observable<ProviderServices[]> {
    this._isLoading.set(true);
    return this.http.get<ProviderServices[]>(`${this.apiUrl}/providers/services/${providerId}`).pipe(
      tap(services => {
        this._providerServices.set(services);
        this._isLoading.set(false);
      }),
      catchError(error => {
        this._isLoading.set(false);
        console.error('Error fetching provider services:', error);
        return throwError(() => error);
      })
    );
  }

  //   getProviderServices(providerId: number): Observable<ServiceProviderData[]> {
  //   return this.apiService.get<ServiceProviderData[]>(`/providers/providers/services/${providerId}`);
  // }

  getProviderService(providerId: number, serviceId: number): Observable<ProviderServices> {
    return this.http.get<ProviderServices>(`${this.apiUrl}/providers/${providerId}/services/${serviceId}`);
  }

  // Alias para compatibilidad
  // getProviderServiceById(serviceId: string): Observable<ProviderServices> {
  //   return this.http.get<ProviderServices>(`${this.apiUrl}/provider-services/${serviceId}`);
  // }

   getProviderServiceById(providerId: number, serviceId: number): Observable<ServiceProviderData> {
    return this.http.get<ServiceProviderData>(`${this.apiUrl}/providers/${providerId}/services/${serviceId}`);
  }

  createProviderService(data: Partial<ProviderServices>): Observable<ProviderServices> {
    return this.http.post<ProviderServices>(`${this.apiUrl}/provider-services`, data).pipe(
      tap(service => {
        const current = this._providerServices();
        this._providerServices.set([...current, service]);
      }),
      catchError(error => {
        console.error('Error creating provider service:', error);
        return throwError(() => error);
      })
    );
  }

  updateProviderService(providerId: number, serviceId: number, data: Partial<ProviderServices>): Observable<ProviderServices> {
    return this.http.put<ProviderServices>(`${this.apiUrl}/providers/${providerId}/services/${serviceId}`, data).pipe(
      tap(updatedService => {
        const current = this._providerServices();
        const index = current.findIndex(s => s.id === updatedService.id);
        if (index !== -1) {
          const updated = [...current];
          updated[index] = updatedService;
          this._providerServices.set(updated);
        }
      }),
      catchError(error => {
        console.error('Error updating provider service:', error);
        return throwError(() => error);
      })
    );
  }

  deleteProviderService(serviceId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/provider-services/${serviceId}`).pipe(
      tap(() => {
        const current = this._providerServices();
        this._providerServices.set(current.filter(s => s.id !== serviceId));
      }),
      catchError(error => {
        console.error('Error deleting provider service:', error);
        return throwError(() => error);
      })
    );
  }

  toggleServiceAvailability(serviceId: number, isAvailable: boolean): Observable<ProviderServices> {
    return this.http.patch<ProviderServices>(`${this.apiUrl}/providers/provider-services/${serviceId}`, { is_available: isAvailable }).pipe(
      tap(updatedService => {
        const current = this._providerServices();
        const index = current.findIndex(s => s.id === serviceId);
        if (index !== -1) {
          const updated = [...current];
          updated[index] = updatedService;
          this._providerServices.set(updated);
        }
      })
    );
  }

  // ==================== ESTADÍSTICAS ====================

  getProviderStats(providerId: string): Observable<ProviderStats> {
    return this.http.get<ProviderStats>(`${this.apiUrl}/providers/${providerId}/stats`).pipe(
      tap(stats => this._providerStats.set(stats)),
      catchError(error => {
        console.error('Error fetching provider stats:', error);
        return throwError(() => error);
      })
    );
  }

  // ==================== BOOKINGS DEL PROVEEDOR ====================

  getProviderBookings(providerId: string, status?: string): Observable<any[]> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<any[]>(`${this.apiUrl}/providers/${providerId}/bookings`, { params });
  }

  updateBookingStatus(bookingId: number, status: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/bookings/${bookingId}`, { status });
  }

  // ==================== DISPONIBILIDAD ====================

  updateAvailability(providerId: string, isAvailable: boolean): Observable<ProviderProfile> {
    return this.http.patch<ProviderProfile>(`${this.apiUrl}/providers/${providerId}`, { is_available: isAvailable }).pipe(
      tap(profile => this._providerProfile.set(profile))
    );
  }

  // ==================== REGISTRO ====================

  registerProvider(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/providers/register`, data);
  }

  // ==================== UTILIDADES ====================

  clearCache(): void {
    this._providerProfile.set(null);
    this._providerServices.set([]);
    this._providerStats.set(null);
  }
}

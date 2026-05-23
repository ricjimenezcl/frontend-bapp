import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// ==================== INTERFACES ====================

export interface MainCategory {
  id: number;
  name: string;
  description: string;
  icon: string;
  is_active: boolean;
  created_at: string;
}

export interface ServiceCategory {
  id: number;
  name: string;
  description: string;
  main_category_id: number;
  icon: string;
  is_active: boolean;
  created_at: string;
}
export interface ServiceProvider {
  id: number;
  provider_id: number;  // ✅ OPCIÓN B: Added for provider ID mapping
  user_id: number;
  business_name: string;
  full_name?: string;
  run?: string;
  status?: string;
  bio?: string;
  description?: string;
  avatar?: string;
  phone?: string;
  email?: string;
  address?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  rating_avg?: number;
  total_reviews?: number;
  hourly_rate?: number;
  is_available?: boolean;
  is_verified?: boolean;
  validation_status?: string;
  distance?: number;
  services?: ServiceCategory[];
}

export interface Booking {
  id?: number;
  client_id: number;
  provider_id: number;
  service_id?: string;
  service_category?: string;
  status?: string;
  location_address?: string;
  location_lat?: number;
  location_lng?: number;
  scheduled_date?: string; // ISO date (YYYY-MM-DD)
  scheduled_time?: string; // Time (HH:mm:ss)
  price?: number;
  total_price?: number;
  duration?: number;
  currency?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  service_provider_id?: number;
}

export interface Review {
  id: number;
  booking_id: number;
  client_id: number;
  provider_id: number;
  rating: number;
  comment?: string;
  client_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Provider {
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
  updated_at: string;
  
  full_name: string;
  avatar: string;
  bio: string;
  provider_rating: number;
  
  service_category_name: string;
  service_icon: string;
  
  distance: number;
}

export interface MainCategoryWithServices extends MainCategory {
  services: ServiceCategory[];
}

export interface WorkingHours {
  id: number;
  provider_id: number;
  day_of_week: number;   // 0=Lun, 6=Dom (backend convention)
  start_time: string;    // "HH:MM:SS"
  end_time: string;
  is_active: boolean;
}

export interface ServiceSchedule {
  id?: number;
  provider_id: number;
  service_id: number;   // service_providers.id
  day_of_week: number;  // 0=Lun … 6=Dom
  day_name?: string;
  start_time: string;   // "HH:MM"
  end_time: string;     // "HH:MM"
  is_available: boolean;
  timezone?: string;
}

export interface TimeSlot {
  time: string;       // "HH:MM"
  available: boolean; // false si está reservado
}

export interface AvailableSlotsResponse {
  date: string;
  service_provider_id: number;
  slots: TimeSlot[];
}


// ==================== SERVICE ====================

@Injectable({
  providedIn: 'root'
})
export class CoreService {

  private apiUrl = environment.apiUrl;

  // Signals para estado
  private _mainCategories = signal<MainCategory[]>([]);
  private _serviceCategories = signal<ServiceCategory[]>([]);
  private _providers = signal<ServiceProvider[]>([]);
  private _selectedProvider = signal<ServiceProvider | null>(null);
  private _isLoading = signal<boolean>(false);

  // Public readonly signals
  public readonly mainCategories = this._mainCategories.asReadonly();
  public readonly serviceCategories = this._serviceCategories.asReadonly();
  public readonly providers = this._providers.asReadonly();
  public readonly selectedProvider = this._selectedProvider.asReadonly();
  public readonly isLoading = this._isLoading.asReadonly();

  constructor(private http: HttpClient) {
    // console.log('CoreService initialized');
  }

  // ==================== CATEGORÍAS PRINCIPALES ====================

  getMainCategories(): Observable<MainCategory[]> {
    this._isLoading.set(true);
    return this.http.get<MainCategory[]>(`${this.apiUrl}/categories/main-categories`).pipe(
      tap(categories => {
        this._mainCategories.set(categories);
        this._isLoading.set(false);
      }),
      catchError(error => {
        this._isLoading.set(false);
        console.error('Error fetching main categories:', error);
        return throwError(() => error);
      })
    );
  }

  getMainCategoryById(id: number): Observable<MainCategory> {
    return this.http.get<MainCategory>(`${this.apiUrl}/categories/main/${id}`);
  }

  // ==================== CATEGORÍAS DE SERVICIO ====================

 getMainCategoryWithServices(mainCategoryId: number): Observable<ServiceCategory[]> {
    return this.http.get<MainCategoryWithServices>(`${this.apiUrl}/categories/main-categories/${mainCategoryId}`)
        .pipe(
            map((response: MainCategoryWithServices) => response.services)
        );
  }
  getServiceCategories(mainCategoryId?: number): Observable<ServiceCategory[]> {
    let url = `${this.apiUrl}/categories/services`;
    if (mainCategoryId) {
      url += `?main_category_id=${mainCategoryId}`;
    }
    
    this._isLoading.set(true);
    return this.http.get<ServiceCategory[]>(url).pipe(
      tap(categories => {
        this._serviceCategories.set(categories);
        this._isLoading.set(false);
      }),
      catchError(error => {
        this._isLoading.set(false);
        console.error('Error fetching service categories:', error);
        return throwError(() => error);
      })
    );
  }

  getServiceCategory(serviceId: number): Observable<ServiceCategory> {
    return this.http.get<ServiceCategory>(`${this.apiUrl}/categories/services/${serviceId}`);
  }

  // Alias para compatibilidad
  getCategories(): Observable<ServiceCategory[]> {
    return this.getServiceCategories();
  }

  // ==================== PROVEEDORES ====================

  createServiceProvider(serviceData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/providers/services`, serviceData);
  }

  getProviders(lat?: number, lng?: number, radius?: number, serviceId?: string): Observable<ServiceProvider[]> {
    let params = new HttpParams();
    
    if (lat !== undefined) params = params.set('lat', lat.toString());
    if (lng !== undefined) params = params.set('lng', lng.toString());
    if (radius !== undefined) params = params.set('radius', radius.toString());
    if (serviceId !== undefined) params = params.set('service_id', serviceId);

    this._isLoading.set(true);
    return this.http.get<ServiceProvider[]>(`${this.apiUrl}/providers`, { params }).pipe(
      tap(providers => {
        this._providers.set(providers);
        this._isLoading.set(false);
      }),
      catchError(error => {
        this._isLoading.set(false);
        console.error('Error fetching providers:', error);
        return throwError(() => error);
      })
    );
  }

  getProviderById(providerId: number): Observable<ServiceProvider> {
    return this.http.get<ServiceProvider>(`${this.apiUrl}/providers/${providerId}/detailed`);
  }

  getProviderService(providerId: number, serviceId: number): Observable<ServiceProvider> {
    return this.http.get<ServiceProvider>(`${this.apiUrl}/providers/${providerId}/services/${serviceId}`);
  }

  getProvidersByService(serviceId: number): Observable<ServiceProvider[]> {
    // Usar getNearbyProvidersByServiceId o implementar el endpoint en backend si es necesario
    return this.http.get<ServiceProvider[]>(`${this.apiUrl}/providers/nearby/service/${serviceId}`);
  }

  /**
   * Obtiene todos los servicios de un proveedor específico
   * @param providerId - ID del proveedor
   * @returns Observable con array de servicios del proveedor
   */
  getProviderServices(providerId: number): Observable<ServiceProvider[]> {
    return this.http.get<ServiceProvider[]>(`${this.apiUrl}/providers/${providerId}/services`);
  }

  setSelectedProvider(provider: ServiceProvider): void {
    this._selectedProvider.set(provider);
  }

  clearSelectedProvider(): void {
    this._selectedProvider.set(null);
  }

  // ==================== BOOKINGS ====================

  createBooking(bookingData: Partial<Booking>): Observable<Booking> {
    // Si bookingData incluye service_provider_id, lo enviamos al backend
    const payload = { ...bookingData };
    if (bookingData.service_provider_id) {
      payload["service_provider_id"] = bookingData.service_provider_id;
    }
    return this.http.post<Booking>(`${this.apiUrl}/bookings`, payload).pipe(
      tap(booking => {/* console.log('Booking created:', booking)*/}),
      catchError(error => {
        console.error('Error creating booking:', error);
        return throwError(() => error);
      })
    );
  }

  getClientBookings(clientId: number): Observable<Booking[]> {
    return this.http.get<Booking[]>(`${this.apiUrl}/bookings/client/${clientId}`);
  }

  getProviderBookings(): Observable<Booking[]> {
    return this.http.get<Booking[]>(`${this.apiUrl}/bookings/provider`);
  }

  getBookingById(bookingId: number): Observable<Booking> {
    return this.http.get<Booking>(`${this.apiUrl}/bookings/${bookingId}`);
  }

  updateBookingStatus(bookingId: number, status: string): Observable<Booking> {
    return this.http.put<Booking>(`${this.apiUrl}/bookings/${bookingId}/status`, { status }).pipe(
      catchError(error => {
        console.error('Error updating booking status:', error);
        return throwError(() => error);
      })
    );
  }

  cancelBooking(bookingId: number, reason: string = 'CLIENT_REQUEST', reasonComment?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/bookings/${bookingId}/cancel`, {
      reason,
      reason_comment: reasonComment ?? null
    }).pipe(
      catchError(error => {
        console.error('Error cancelling booking:', error);
        return throwError(() => error);
      })
    );
  }

  // ==================== REVIEWS ====================

  getProviderReviews(providerId: number): Observable<Review[]> {
    return this.http.get<Review[]>(`${this.apiUrl}/reviews/providers/${providerId}/reviews`);
  }

  createReview(reviewData: Partial<Review>): Observable<Review> {
    return this.http.post<Review>(`${this.apiUrl}/reviews`, reviewData);
  }

  // ==================== WORKING HOURS ====================

  getProviderWorkingHours(providerId: number): Observable<WorkingHours[]> {
    return this.http.get<WorkingHours[]>(`${this.apiUrl}/working-hours/provider/${providerId}`);
  }

  // ==================== SERVICE SCHEDULES (por servicio publicado) ====================

  getServiceSchedules(providerId: number, serviceProviderId: number): Observable<ServiceSchedule[]> {
    return this.http.get<ServiceSchedule[]>(
      `${this.apiUrl}/providers/${providerId}/services/${serviceProviderId}/schedules`
    );
  }

  upsertServiceSchedule(providerId: number, serviceProviderId: number, schedule: Partial<ServiceSchedule>): Observable<ServiceSchedule> {
    return this.http.post<ServiceSchedule>(
      `${this.apiUrl}/providers/${providerId}/services/${serviceProviderId}/schedules`,
      schedule
    );
  }

  getAvailableSlots(providerId: number, serviceProviderId: number, date: string): Observable<AvailableSlotsResponse> {
    return this.http.get<AvailableSlotsResponse>(
      `${this.apiUrl}/providers/${providerId}/services/${serviceProviderId}/available-slots`,
      { params: { date } }
    );
  }

  // ==================== UTILIDADES ====================

  searchProviders(query: string): Observable<ServiceProvider[]> {
    return this.http.get<ServiceProvider[]>(`${this.apiUrl}/providers/text-search`, {
      params: new HttpParams().set('q', query)
    });
  }

  getNearbyProviders(lat: number, lng: number, radius: number = 10): Observable<ServiceProvider[]> {
    return this.getProviders(lat, lng, radius);
  }

  getNearbyProvidersByServiceId(
    lat: number, lng: number, radius: number, serviceId: number,
    skip: number = 0, limit: number = 10
  ): Observable<Provider[]> {
    const url = `providers/nearby/service/${serviceId}?lat=${lat}&lng=${lng}&radius=${radius}&skip=${skip}&limit=${limit}`;
    return this.http.get<Provider[]>(`${this.apiUrl}/${url}`);
  }


}

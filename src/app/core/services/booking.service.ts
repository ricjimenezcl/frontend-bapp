import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  BookingResponse,
  BookingCreate,
  BookingStatus,
  BookingUpdateRequest
} from '../models/booking.model';

/**
 * Request para cancelar una reserva
 */
export interface CancelBookingRequest {
  reason: string;
  reason_comment?: string;
}

/**
 * Request para confirmar una reserva
 */
export interface ConfirmBookingRequest {
  notes?: string;
}

/**
 * Request para completar una reserva
 */
export interface CompleteBookingRequest {
  notes?: string;
}

/**
 * Request para marcar no-show
 */
export interface NoShowBookingRequest {
  notes?: string;
}

/**
 * Filtros de búsqueda de reservas
 */
export interface BookingFilters {
  status?: BookingStatus;
  service_id?: number;
  provider_id?: number;
  client_id?: number;
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
}

/**
 * Estadísticas de reservas
 */
export interface BookingStats {
  total: number;
  pending: number;
  confirmed: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  noshow: number;
  revenue_total?: number;
  revenue_this_month?: number;
}

/**
 * Booking Service - Sincronizado con proyecto WEB
 * Servicio unificado para gestión completa de reservas
 * Consolida funcionalidad de client-booking y provider-booking
 */
@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/bookings`;

  // Estado de reservas
  myBookings = signal<BookingResponse[]>([]);
  providerBookings = signal<BookingResponse[]>([]);
  isLoading = signal(false);

  // ==================== CREAR RESERVA ====================

  /**
   * Crear una nueva reserva (cliente)
   * @param booking Datos de la reserva
   * @returns Observable con la reserva creada
   */
  createBooking(booking: BookingCreate): Observable<BookingResponse> {
    this.isLoading.set(true);
    return this.http.post<BookingResponse>(this.apiUrl, booking).pipe(
      tap(() => this.isLoading.set(false)),
      catchError(error => {
        this.isLoading.set(false);
        throw error;
      })
    );
  }

  // ==================== OBTENER RESERVAS ====================

  /**
   * Obtener todas las reservas del cliente autenticado
   * @param filters Filtros opcionales
   * @returns Observable con array de reservas
   */
  getMyBookings(filters?: BookingFilters): Observable<BookingResponse[]> {
    this.isLoading.set(true);
    let params = this.buildParams(filters);
    
    return this.http.get<BookingResponse[]>(`${this.apiUrl}/me`, { params }).pipe(
      tap(bookings => {
        this.myBookings.set(bookings);
        this.isLoading.set(false);
      }),
      catchError(error => {
        this.isLoading.set(false);
        throw error;
      })
    );
  }

  /**
   * Obtener reservas de un cliente específico (admin/provider)
   * @param clientId ID del cliente
   * @param filters Filtros opcionales
   * @returns Observable con array de reservas
   */
  getClientBookings(clientId: number, filters?: BookingFilters): Observable<BookingResponse[]> {
    let params = this.buildParams(filters);
    return this.http.get<BookingResponse[]>(`${this.apiUrl}/client/${clientId}`, { params });
  }

  /**
   * Obtener todas las reservas del proveedor autenticado
   * @param filters Filtros opcionales
   * @returns Observable con array de reservas
   */
  getProviderBookings(filters?: BookingFilters): Observable<BookingResponse[]> {
    this.isLoading.set(true);
    let params = this.buildParams(filters);
    
    return this.http.get<BookingResponse[]>(`${this.apiUrl}/provider`, { params }).pipe(
      tap(bookings => {
        this.providerBookings.set(bookings);
        this.isLoading.set(false);
      }),
      catchError(error => {
        this.isLoading.set(false);
        throw error;
      })
    );
  }

  /**
   * Obtener una reserva específica por ID
   * @param bookingId ID de la reserva
   * @returns Observable con la reserva
   */
  getBookingById(bookingId: number): Observable<BookingResponse> {
    return this.http.get<BookingResponse>(`${this.apiUrl}/${bookingId}`);
  }

  // ==================== ACTUALIZAR ESTADO ====================

  /**
   * Confirmar una reserva (proveedor acepta)
   * @param bookingId ID de la reserva
   * @param request Datos adicionales (notas)
   * @returns Observable con la reserva actualizada
   */
  confirmBooking(bookingId: number, request?: ConfirmBookingRequest): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(`${this.apiUrl}/${bookingId}/confirm`, request || {}).pipe(
      tap(() => this.refreshProviderBookings())
    );
  }

  /**
   * Alias para confirmBooking (compatibilidad con provider-booking.service)
   * @param bookingId ID de la reserva
   * @param notes Notas opcionales
   * @returns Observable con la reserva actualizada
   */
  acceptBooking(bookingId: number, notes?: string): Observable<BookingResponse> {
    return this.confirmBooking(bookingId, { notes });
  }

  /**
   * Cancelar una reserva
   * @param bookingId ID de la reserva
   * @param reason Razón de cancelación
   * @param reasonComment Comentario adicional
   * @returns Observable con la reserva actualizada
   */
  cancelBooking(
    bookingId: number,
    reason: string = 'CLIENT_REQUEST',
    reasonComment?: string
  ): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(`${this.apiUrl}/${bookingId}/cancel`, {
      reason,
      reason_comment: reasonComment
    }).pipe(
      tap(() => {
        this.refreshMyBookings();
        this.refreshProviderBookings();
      })
    );
  }

  /**
   * Alias para cancelBooking con razón de proveedor (compatibilidad)
   * @param bookingId ID de la reserva
   * @param reason Razón de rechazo
   * @param reasonComment Comentario adicional
   * @returns Observable con la reserva actualizada
   */
  rejectBooking(
    bookingId: number,
    reason: string = 'PROVIDER_REQUEST',
    reasonComment?: string
  ): Observable<BookingResponse> {
    return this.cancelBooking(bookingId, reason, reasonComment);
  }

  /**
   * Marcar reserva como en progreso (servicio iniciado)
   * @param bookingId ID de la reserva
   * @returns Observable con la reserva actualizada
   */
  startBooking(bookingId: number): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(`${this.apiUrl}/${bookingId}/start`, {}).pipe(
      tap(() => this.refreshProviderBookings())
    );
  }

  /**
   * Completar una reserva (servicio finalizado)
   * @param bookingId ID de la reserva
   * @param request Datos adicionales (notas)
   * @returns Observable con la reserva actualizada
   */
  completeBooking(bookingId: number, request?: CompleteBookingRequest): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(`${this.apiUrl}/${bookingId}/complete`, request || {}).pipe(
      tap(() => this.refreshProviderBookings())
    );
  }

  /**
   * Marcar reserva como no-show (cliente no se presentó)
   * @param bookingId ID de la reserva
   * @param request Datos adicionales (notas)
   * @returns Observable con la reserva actualizada
   */
  markAsNoShow(bookingId: number, request?: NoShowBookingRequest): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(`${this.apiUrl}/${bookingId}/noshow`, request || {}).pipe(
      tap(() => this.refreshProviderBookings())
    );
  }

  /**
   * Actualizar estado de una reserva (genérico)
   * @param bookingId ID de la reserva
   * @param status Nuevo estado
   * @returns Observable con la reserva actualizada
   */
  updateBookingStatus(bookingId: number, status: BookingStatus): Observable<BookingResponse> {
    return this.http.patch<BookingResponse>(`${this.apiUrl}/${bookingId}/status`, { status }).pipe(
      tap(() => {
        this.refreshMyBookings();
        this.refreshProviderBookings();
      })
    );
  }

  /**
   * Actualizar datos de una reserva
   * @param bookingId ID de la reserva
   * @param data Datos a actualizar
   * @returns Observable con la reserva actualizada
   */
  updateBooking(bookingId: number, data: BookingUpdateRequest): Observable<BookingResponse> {
    return this.http.patch<BookingResponse>(`${this.apiUrl}/${bookingId}`, data);
  }

  // ==================== ESTADÍSTICAS ====================

  /**
   * Obtener estadísticas de reservas del proveedor
   * @returns Observable con estadísticas
   */
  getProviderStats(): Observable<BookingStats> {
    return this.http.get<BookingStats>(`${this.apiUrl}/provider/stats`);
  }

  /**
   * Obtener estadísticas de reservas del cliente
   * @returns Observable con estadísticas
   */
  getClientStats(): Observable<BookingStats> {
    return this.http.get<BookingStats>(`${this.apiUrl}/client/stats`);
  }

  // ==================== HELPERS ====================

  /**
   * Construir HttpParams desde filtros
   * @param filters Filtros opcionales
   * @returns HttpParams configurados
   */
  private buildParams(filters?: BookingFilters): HttpParams {
    let params = new HttpParams();
    
    if (!filters) return params;

    if (filters.status) params = params.set('status', filters.status);
    if (filters.service_id) params = params.set('service_id', filters.service_id.toString());
    if (filters.provider_id) params = params.set('provider_id', filters.provider_id.toString());
    if (filters.client_id) params = params.set('client_id', filters.client_id.toString());
    if (filters.date_from) params = params.set('date_from', filters.date_from);
    if (filters.date_to) params = params.set('date_to', filters.date_to);
    if (filters.skip !== undefined) params = params.set('skip', filters.skip.toString());
    if (filters.limit !== undefined) params = params.set('limit', filters.limit.toString());

    return params;
  }

  /**
   * Refrescar lista de mis reservas (cliente)
   */
  private refreshMyBookings(): void {
    this.getMyBookings().subscribe();
  }

  /**
   * Refrescar lista de reservas del proveedor
   */
  private refreshProviderBookings(): void {
    this.getProviderBookings().subscribe();
  }

  /**
   * Limpiar caché de reservas
   */
  clearCache(): void {
    this.myBookings.set([]);
    this.providerBookings.set([]);
  }

  /**
   * Verificar si una reserva puede ser cancelada
   * @param booking Reserva a verificar
   * @returns true si puede ser cancelada
   */
  canCancel(booking: BookingResponse): boolean {
    const cancellableStatuses: BookingStatus[] = ['PENDING', 'CONFIRMED'];
    return cancellableStatuses.includes(booking.status);
  }

  /**
   * Verificar si una reserva puede ser confirmada (proveedor)
   * @param booking Reserva a verificar
   * @returns true si puede ser confirmada
   */
  canConfirm(booking: BookingResponse): boolean {
    return booking.status === 'PENDING';
  }

  /**
   * Verificar si una reserva puede ser completada
   * @param booking Reserva a verificar
   * @returns true si puede ser completada
   */
  canComplete(booking: BookingResponse): boolean {
    const completableStatuses: BookingStatus[] = ['CONFIRMED', 'IN_PROGRESS'];
    return completableStatuses.includes(booking.status);
  }

  /**
   * Verificar si una reserva puede recibir reseña
   * @param booking Reserva a verificar
   * @returns true si puede ser reseñada
   */
  canReview(booking: BookingResponse): boolean {
    return booking.status === 'COMPLETED';
  }
}

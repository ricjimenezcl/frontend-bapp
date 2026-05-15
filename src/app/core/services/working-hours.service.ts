import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Horario de trabajo del proveedor (configuración general)
 */
export interface WorkingHours {
  id?: number;
  provider_id: number;
  day_of_week: number;   // 0=Lunes, 6=Domingo (backend convention)
  start_time: string;    // "HH:MM:SS" o "HH:MM"
  end_time: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Horario específico de un servicio publicado
 */
export interface ServiceSchedule {
  id?: number;
  provider_id: number;
  service_id: number;        // service_providers.id (servicio publicado)
  day_of_week: number;       // 0=Lunes … 6=Domingo
  day_name?: string;
  start_time: string;        // "HH:MM"
  end_time: string;          // "HH:MM"
  is_available: boolean;
  timezone?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Slot de tiempo disponible
 */
export interface TimeSlot {
  time: string;              // "HH:MM"
  available: boolean;        // false si está reservado
}

/**
 * Response de slots disponibles para un servicio en una fecha
 */
export interface AvailableSlotsResponse {
  date: string;              // "YYYY-MM-DD"
  service_provider_id: number;
  slots: TimeSlot[];
}

/**
 * Working Hours Service - Sincronizado con proyecto WEB
 * Gestiona horarios de trabajo, disponibilidad de servicios y slots
 */
@Injectable({
  providedIn: 'root'
})
export class WorkingHoursService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}`;

  // Estado de horarios del proveedor actual
  myWorkingHours = signal<WorkingHours[]>([]);
  isLoading = signal(false);

  // ==================== WORKING HOURS (Horarios Generales) ====================

  /**
   * Obtener mis horarios de trabajo (provider autenticado)
   * @returns Observable con array de horarios
   */
  getMyWorkingHours(): Observable<WorkingHours[]> {
    this.isLoading.set(true);
    return this.http.get<WorkingHours[]>(`${this.apiUrl}/working-hours/me`).pipe(
      tap(hours => {
        this.myWorkingHours.set(hours);
        this.isLoading.set(false);
      })
    );
  }

  /**
   * Guardar/actualizar mis horarios de trabajo
   * @param data Horario a guardar (create o update)
   * @returns Observable con horario guardado
   */
  saveWorkingHours(data: Omit<WorkingHours, 'id' | 'created_at' | 'updated_at'>): Observable<WorkingHours> {
    return this.http.post<WorkingHours>(`${this.apiUrl}/working-hours/me`, data).pipe(
      tap(() => {
        // Refrescar caché después de guardar
        this.getMyWorkingHours().subscribe();
      })
    );
  }

  /**
   * Obtener horarios de trabajo de un proveedor específico
   * @param providerId ID del proveedor
   * @returns Observable con array de horarios
   */
  getProviderWorkingHours(providerId: number): Observable<WorkingHours[]> {
    return this.http.get<WorkingHours[]>(`${this.apiUrl}/working-hours/provider/${providerId}`);
  }

  /**
   * Eliminar un horario de trabajo
   * @param workingHourId ID del horario
   * @returns Observable void
   */
  deleteWorkingHour(workingHourId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/working-hours/${workingHourId}`).pipe(
      tap(() => {
        // Actualizar caché
        this.getMyWorkingHours().subscribe();
      })
    );
  }

  // ==================== SERVICE SCHEDULES (Horarios por Servicio) ====================

  /**
   * Obtener horarios de un servicio publicado específico
   * @param providerId ID del proveedor
   * @param serviceProviderId ID del servicio publicado (service_providers.id)
   * @returns Observable con array de schedules
   */
  getServiceSchedules(providerId: number, serviceProviderId: number): Observable<ServiceSchedule[]> {
    return this.http.get<ServiceSchedule[]>(
      `${this.apiUrl}/providers/${providerId}/services/${serviceProviderId}/schedules`
    );
  }

  /**
   * Guardar/actualizar horario de un servicio publicado
   * @param providerId ID del proveedor
   * @param serviceProviderId ID del servicio publicado
   * @param schedule Datos del horario
   * @returns Observable con schedule guardado
   */
  saveServiceSchedule(
    providerId: number,
    serviceProviderId: number,
    schedule: Omit<ServiceSchedule, 'id' | 'created_at' | 'updated_at'>
  ): Observable<ServiceSchedule> {
    return this.http.post<ServiceSchedule>(
      `${this.apiUrl}/providers/${providerId}/services/${serviceProviderId}/schedules`,
      schedule
    );
  }

  /**
   * Crear o actualizar horario de servicio (alias para compatibilidad)
   * @param providerId ID del proveedor
   * @param serviceProviderId ID del servicio publicado
   * @param schedule Datos del horario
   * @returns Observable con schedule guardado
   */
  upsertServiceSchedule(
    providerId: number,
    serviceProviderId: number,
    schedule: Partial<ServiceSchedule>
  ): Observable<ServiceSchedule> {
    return this.saveServiceSchedule(providerId, serviceProviderId, schedule as any);
  }

  /**
   * Eliminar un horario de servicio
   * @param scheduleId ID del schedule
   * @returns Observable void
   */
  deleteServiceSchedule(scheduleId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/service-schedules/${scheduleId}`);
  }

  // ==================== AVAILABLE SLOTS (Slots Disponibles) ====================

  /**
   * Obtener slots disponibles para un servicio en una fecha específica
   * Considera reservas existentes y horarios configurados
   * @param providerId ID del proveedor
   * @param serviceProviderId ID del servicio publicado
   * @param date Fecha en formato YYYY-MM-DD
   * @returns Observable con slots disponibles
   */
  getAvailableSlots(
    providerId: number,
    serviceProviderId: number,
    date: string
  ): Observable<AvailableSlotsResponse> {
    return this.http.get<AvailableSlotsResponse>(
      `${this.apiUrl}/providers/${providerId}/services/${serviceProviderId}/available-slots`,
      { params: { date } }
    );
  }

  /**
   * Obtener slots disponibles por servicio (alias para compatibilidad con web)
   * @param providerId ID del proveedor
   * @param serviceProviderId ID del servicio publicado
   * @param date Fecha en formato YYYY-MM-DD
   * @returns Observable con slots disponibles
   */
  getAvailableSlotsByService(
    providerId: number,
    serviceProviderId: number,
    date: string
  ): Observable<AvailableSlotsResponse> {
    return this.getAvailableSlots(providerId, serviceProviderId, date);
  }

  // ==================== HELPERS ====================

  /**
   * Obtener nombre del día de la semana
   * @param dayOfWeek Número del día (0=Lunes, 6=Domingo)
   * @returns Nombre en español
   */
  getDayName(dayOfWeek: number): string {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return days[dayOfWeek] || '';
  }

  /**
   * Formatear hora para display (HH:MM)
   * @param time Hora en formato "HH:MM:SS" o "HH:MM"
   * @returns Hora formateada "HH:MM"
   */
  formatTime(time: string): string {
    return time.substring(0, 5); // Toma solo HH:MM
  }

  /**
   * Verificar si un horario está activo
   * @param workingHour Horario a verificar
   * @returns true si está activo
   */
  isActive(workingHour: WorkingHours): boolean {
    return workingHour.is_active;
  }

  /**
   * Limpiar caché de horarios
   */
  clearCache(): void {
    this.myWorkingHours.set([]);
  }

  /**
   * Verificar si hay slots disponibles
   * @param slots Array de slots
   * @returns true si hay al menos un slot disponible
   */
  hasAvailableSlots(slots: TimeSlot[]): boolean {
    return slots.some(slot => slot.available);
  }

  /**
   * Contar slots disponibles
   * @param slots Array de slots
   * @returns Número de slots disponibles
   */
  countAvailableSlots(slots: TimeSlot[]): number {
    return slots.filter(slot => slot.available).length;
  }
}

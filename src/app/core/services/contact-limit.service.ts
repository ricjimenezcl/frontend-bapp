import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Respuesta del endpoint de límites de contacto
 */
export interface ContactLimitResponse {
  can_contact: boolean;
  contacts_made_today: number;
  max_daily_contacts: number;
  reason?: string;
  reset_time?: string;
}

/**
 * Contact Limit Service - Sincronizado con proyecto WEB
 * Gestiona los límites de contacto diario para clientes
 * Implementa rate limiting para prevenir spam
 */
@Injectable({
  providedIn: 'root'
})
export class ContactLimitService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/contact-limits`;

  /**
   * Verificar si el cliente puede contactar a un proveedor
   * @param providerId ID del proveedor a contactar
   * @returns Observable con la información de límite
   */
  canContactProvider(providerId: number): Observable<ContactLimitResponse> {
    return this.http.get<ContactLimitResponse>(
      `${this.apiUrl}/check/${providerId}`
    ).pipe(
      catchError(error => {
        console.error('[ContactLimitService] Error checking contact limit:', error);
        // En caso de error, permitir el contacto (fail-open)
        return of({
          can_contact: true,
          contacts_made_today: 0,
          max_daily_contacts: 10,
          reason: 'Error al verificar límite, permitiendo contacto'
        });
      })
    );
  }

  /**
   * Registrar un nuevo contacto (incrementar contador)
   * @param providerId ID del proveedor contactado
   * @returns Observable con la respuesta
   */
  registerContact(providerId: number): Observable<ContactLimitResponse> {
    return this.http.post<ContactLimitResponse>(
      `${this.apiUrl}/register`,
      { provider_id: providerId }
    ).pipe(
      catchError(error => {
        console.error('[ContactLimitService] Error registering contact:', error);
        throw error;
      })
    );
  }

  /**
   * Obtener el estado actual de límites del usuario
   * @returns Observable con el estado de límites
   */
  getContactLimitStatus(): Observable<ContactLimitResponse> {
    return this.http.get<ContactLimitResponse>(`${this.apiUrl}/status`).pipe(
      catchError(error => {
        console.error('[ContactLimitService] Error getting limit status:', error);
        return of({
          can_contact: true,
          contacts_made_today: 0,
          max_daily_contacts: 10
        });
      })
    );
  }

  /**
   * Verificar si se alcanzó el límite diario
   * @returns Observable<boolean> - true si alcanzó el límite
   */
  hasReachedDailyLimit(): Observable<boolean> {
    return this.getContactLimitStatus().pipe(
      map(status => !status.can_contact)
    );
  }

  /**
   * Obtener contactos restantes hoy
   * @returns Observable<number> - número de contactos disponibles
   */
  getRemainingContacts(): Observable<number> {
    return this.getContactLimitStatus().pipe(
      map(status => {
        const remaining = status.max_daily_contacts - status.contacts_made_today;
        return Math.max(0, remaining);
      })
    );
  }

  /**
   * Formatear mensaje de error para el usuario
   * @param response Respuesta del límite
   * @returns Mensaje formateado
   */
  formatLimitMessage(response: ContactLimitResponse): string {
    if (response.can_contact) {
      return `Puedes realizar ${response.max_daily_contacts - response.contacts_made_today} contactos más hoy.`;
    }

    return response.reason || 
      `Has alcanzado el límite de ${response.max_daily_contacts} contactos diarios. Intenta mañana.`;
  }

  /**
   * Verificar y registrar contacto en una sola operación
   * @param providerId ID del proveedor
   * @returns Observable<boolean> - true si el contacto fue exitoso
   */
  checkAndRegisterContact(providerId: number): Observable<boolean> {
    return this.canContactProvider(providerId).pipe(
      map(response => {
        if (!response.can_contact) {
          throw new Error(this.formatLimitMessage(response));
        }
        
        // Si puede contactar, registrar el contacto
        this.registerContact(providerId).subscribe({
          error: err => console.error('Error registering contact:', err)
        });
        
        return true;
      }),
      catchError(error => {
        console.error('[ContactLimitService] Error in checkAndRegister:', error);
        throw error;
      })
    );
  }
}

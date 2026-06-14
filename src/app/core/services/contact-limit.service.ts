import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';

// { [serviceId]: [providerId, providerId, ...] }
type ContactMap = Record<number, number[]>;

const STORAGE_KEY = 'bapp_contacts_v2';
const OLD_KEY     = 'bapp_contacted_providers';
export const FREE_CONTACT_LIMIT = 5;

/**
 * Respuesta de límite de contacto (API compatible)
 */
export interface ContactLimitResponse {
  can_contact: boolean;
  contacts_made_today: number;
  max_daily_contacts: number;
  reason?: string;
}

/**
 * Contact Limit Service — Sincronizado con web-bapp
 *
 * Implementa el límite de 5 contactos gratuitos por servicio usando
 * localStorage, sin depender de ningún endpoint de backend.
 * El mismo mecanismo que usa la versión web.
 */
@Injectable({ providedIn: 'root' })
export class ContactLimitService {
  private contactMap = signal<ContactMap>(this.loadFromStorage());

  readonly FREE_LIMIT = FREE_CONTACT_LIMIT;

  // ─── API nueva (synchronous, igual que web) ─────────────────────

  /** Contactos gratuitos restantes para un servicio */
  remaining(serviceId: number): number {
    const contacted = this.contactMap()[serviceId] ?? [];
    return Math.max(0, FREE_CONTACT_LIMIT - contacted.length);
  }

  /** true si se alcanzó el límite para el servicio */
  hasReachedLimit(serviceId: number): boolean {
    return this.remaining(serviceId) === 0;
  }

  /** true si puede contactar: ya lo contactó antes O tiene slots libres */
  canContact(serviceId: number, providerId: number): boolean {
    const contacted = this.contactMap()[serviceId] ?? [];
    if (contacted.includes(providerId)) return true;
    return !this.hasReachedLimit(serviceId);
  }

  /** IDs de proveedores ya contactados para un serviceId */
  contactedProviders(serviceId: number): number[] {
    return this.contactMap()[serviceId] ?? [];
  }

  /** Registra un contacto; idempotente */
  recordContact(serviceId: number, providerId: number): void {
    const current    = this.contactMap();
    const forService = current[serviceId] ?? [];
    if (forService.includes(providerId)) return;
    const updated = { ...current, [serviceId]: [...forService, providerId] };
    this.contactMap.set(updated);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* safari private */ }
  }

  // ─── API legada (Observable) para compatibilidad con código existente ─

  /**
   * Verificar si el cliente puede contactar a un proveedor
   * @deprecated Usar canContact(serviceId, providerId) directamente
   */
  canContactProvider(providerId: number, serviceId: number = 0): Observable<ContactLimitResponse> {
    const can = this.canContact(serviceId, providerId);
    const contacted = (this.contactMap()[serviceId] ?? []).length;
    return of({
      can_contact: can,
      contacts_made_today: contacted,
      max_daily_contacts: FREE_CONTACT_LIMIT,
      reason: can ? undefined : `Has alcanzado el límite de ${FREE_CONTACT_LIMIT} contactos para este servicio.`
    });
  }

  /**
   * Registrar un nuevo contacto
   * @deprecated Usar recordContact(serviceId, providerId) directamente
   */
  registerContact(providerId: number, serviceId: number = 0): Observable<ContactLimitResponse> {
    this.recordContact(serviceId, providerId);
    const contacted = (this.contactMap()[serviceId] ?? []).length;
    return of({
      can_contact: true,
      contacts_made_today: contacted,
      max_daily_contacts: FREE_CONTACT_LIMIT
    });
  }

  /**
   * Verificar y registrar contacto en una sola operación
   * @deprecated Usar canContact() + recordContact() directamente
   */
  checkAndRegisterContact(providerId: number, serviceId: number = 0): Observable<boolean> {
    if (!this.canContact(serviceId, providerId)) {
      const msg = `Has alcanzado el límite de ${FREE_CONTACT_LIMIT} contactos gratuitos para este servicio.`;
      return new Observable(obs => { obs.error(new Error(msg)); });
    }
    this.recordContact(serviceId, providerId);
    return of(true);
  }

  /** Formatear mensaje de estado */
  formatLimitMessage(response: ContactLimitResponse): string {
    if (response.can_contact) {
      return `Puedes realizar ${response.max_daily_contacts - response.contacts_made_today} contactos más para este servicio.`;
    }
    return response.reason ??
      `Has alcanzado el límite de ${response.max_daily_contacts} contactos gratuitos.`;
  }

  // ─── Carga desde localStorage ─────────────────────────────────────

  private loadFromStorage(): ContactMap {
    try {
      // Migrar datos del formato anterior (pool global sin service_id)
      const legacy = localStorage.getItem(OLD_KEY);
      if (legacy) {
        const ids: unknown = JSON.parse(legacy);
        if (Array.isArray(ids) && ids.length > 0) {
          const migrated: ContactMap = { 0: ids as number[] };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          localStorage.removeItem(OLD_KEY);
          return migrated;
        }
        localStorage.removeItem(OLD_KEY);
      }

      const raw    = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return (typeof parsed === 'object' && parsed !== null) ? parsed as ContactMap : {};
    } catch { return {}; }
  }
}


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

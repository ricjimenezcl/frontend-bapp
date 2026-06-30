import { Injectable, signal } from '@angular/core';

/**
 * Estado global del modal de completar perfil.
 * Muestra un modal bloqueante cuando el proveedor registrado via OAuth
 * o registro express no ingresó RUN y/o Teléfono.
 */
@Injectable({ providedIn: 'root' })
export class ProfileCompletionService {
  /** Controla la visibilidad del modal */
  readonly show = signal(false);

  /** Rol que requiere completar perfil ('PROVIDER' | 'CLIENT') */
  readonly role = signal<string | null>(null);

  /** Flag interno para no re-chequear en la misma sesión */
  private _checked = false;

  /** Muestra el modal bloqueante para el rol dado */
  require(role: string): void {
    this.role.set(role);
    this.show.set(true);
  }

  /** Oculta el modal (llamar tras guardar exitosamente) */
  dismiss(): void {
    this.show.set(false);
    this._checked = true;
  }

  /** Marca que ya se verificó en esta sesión (sin mostrar modal) */
  markChecked(): void {
    this._checked = true;
  }

  /** ¿Ya se revisó el perfil en esta sesión? */
  isChecked(): boolean {
    return this._checked;
  }

  /** Reset al hacer logout */
  reset(): void {
    this.show.set(false);
    this.role.set(null);
    this._checked = false;
  }
}

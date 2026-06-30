import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { ProfileCompletionService } from '../../core/services/profile-completion.service';
import { environment } from '../../../environments/environment';

const LS_KEY = (userId: string | number) => `bapp_profile_ok_${userId}`;

/**
 * Guard que verifica que el proveedor tenga RUN y teléfono.
 * Si faltan, activa el modal bloqueante (ProfileCompletionService.require()).
 * Usa localStorage para no re-chequear en sesiones completadas.
 */
export const profileCompletionGuard: CanActivateFn = (): Observable<boolean> | boolean => {
  const auth       = inject(AuthService);
  const completion = inject(ProfileCompletionService);
  const http       = inject(HttpClient);

  const user = auth.getCurrentUser();
  if (!user) return true;

  // Solo aplica a proveedores
  if (user.role !== 'PROVIDER') return true;

  // Ya chequeado en esta sesión → no volver a llamar API
  if (completion.isChecked()) return true;

  // Persistencia: si ya completó en una sesión anterior
  if (user.id && localStorage.getItem(LS_KEY(user.id))) {
    completion.markChecked();
    return true;
  }

  // Consultar backend
  return http.get<any>(`${environment.apiUrl}/providers/me`).pipe(
    map(res => {
      if (res.is_profile_complete === true) {
        completion.markChecked();
        if (user.id) localStorage.setItem(LS_KEY(user.id), '1');
      } else {
        completion.require('PROVIDER');
      }
      return true; // siempre deja pasar — el modal se superpone
    }),
    catchError(() => {
      // Si falla la llamada, no bloqueamos la navegación
      return of(true);
    })
  );
};

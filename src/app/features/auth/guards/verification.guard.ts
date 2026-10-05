// src/app/auth/guards/verification.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ProviderService } from '../../provider/services/provider.service';

/**
 * Guard que verifica que un proveedor tenga su identidad validada antes de
 * acceder a secciones operativas (mis servicios, reservas, mensajes, agregar/
 * editar servicio, horarios, chat). Homologado con web-bapp's
 * `providerVerificationGuard` (GET /providers/validation/status).
 * No se aplica a home/perfil: esas rutas siempre deben ser accesibles.
 */
export const providerVerificationGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const providerService = inject(ProviderService);
  const router = inject(Router);

  const user = authService.getCurrentUser();

  if (!user) {
    return router.createUrlTree(['/auth/login']);
  }

  if (user.role !== 'PROVIDER') {
    return router.createUrlTree(['/auth/login']);
  }

  return providerService.getValidationStatus().pipe(
    map((res) => {
      const status = String(res?.status ?? '').toLowerCase();
      return status === 'approved' ? true : router.createUrlTree(['/auth/verify-identity']);
    }),
    catchError(() => {
      // Fallback legacy: usar estado del usuario en storage si falla la verificación remota.
      if (user.status !== 'ACTIVE') {
        return of(router.createUrlTree(['/auth/verify-identity']));
      }
      return of(true);
    })
  );
};

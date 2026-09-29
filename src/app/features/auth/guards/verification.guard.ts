// src/app/auth/guards/verification.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard que verifica que un proveedor tenga su identidad verificada (status = ACTIVE).
 * En el flujo "No Bloqueante", permitimos que el proveedor acceda a su dashboard
 * pero mostramos advertencias si su perfil está incompleto o pendiente de verificación.
 */
export const providerVerificationGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.getCurrentUser();

  if (!user) {
    return router.createUrlTree(['/auth/login']);
  }

  // Permitir siempre el acceso al dashboard y perfil en el flujo no bloqueante.
  // La restricción ahora ocurre a nivel de acciones (ej: publicar servicio) o via banners de aviso.
  return true;
};

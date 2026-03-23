// src/app/auth/guards/verification.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard que verifica que un proveedor tenga su identidad verificada (status = ACTIVE).
 * Si el proveedor está PENDING o REJECTED → redirige a /auth/verify-identity.
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

  // Consideramos verificado si status es ACTIVE o si verified === true
  const isActive = user.status === 'ACTIVE' || user.verified === true;
  if (isActive) {
    return true;
  }

  // Proveedor pendiente de verificación → redirigir al flujo de identidad
  return router.createUrlTree(['/auth/verify-identity']);
};

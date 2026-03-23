// src/app/auth/guards/auth.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard que requiere autenticación
 * Redirige a login si no está autenticado
 */
export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  if (authService.isAuthenticated()) {
    console.log('✅ authGuard: Usuario autenticado');
    return true;
  }
  
  console.log('❌ authGuard: Usuario no autenticado, redirigiendo a login');
  router.navigate(['/auth/login'], { 
    queryParams: { returnUrl: state.url } 
  });
  return false;
};

/**
 * Guard que requiere NO estar autenticado
 * Redirige al dashboard si ya está autenticado
 */
export const noAuthGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  if (!authService.isAuthenticated()) {
    console.log('✅ noAuthGuard: Usuario no autenticado, acceso permitido');
    return true;
  }
  
  // Redirigir según rol
  const user = authService.getCurrentUser();
  console.log('⚠️ noAuthGuard: Usuario ya autenticado, redirigiendo...');
  
  if (user?.role === 'PROVIDER') {
    router.navigate(['/provider/tabs']);
  } else if (user?.role === 'CLIENT') {
    router.navigate(['/client/tabs/categories']);
  } else {
    router.navigate(['/home']);
  }
  
  return false;
};

/**
 * Guard que verifica un rol específico
 */
export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    
    if (!authService.isAuthenticated()) {
      console.log('❌ roleGuard: No autenticado');
      router.navigate(['/auth/login'], { 
        queryParams: { returnUrl: state.url } 
      });
      return false;
    }
    
    const user = authService.getCurrentUser();
    
    if (user && allowedRoles.includes(user.role)) {
      console.log(`✅ roleGuard: Rol ${user.role} permitido`);
      return true;
    }
    
    console.log(`❌ roleGuard: Rol ${user?.role} no permitido`);
    
    // Redirigir a su dashboard correspondiente
    if (user?.role === 'PROVIDER') {
      router.navigate(['/provider/tabs']);
    } else if (user?.role === 'CLIENT') {
      router.navigate(['/client/categories']);
    } else {
      router.navigate(['/home']);
    }
    
    return false;
  };
};

/**
 * Guard para proveedores
 */
export const providerGuard: CanActivateFn = (route, state) => {
  return roleGuard(['PROVIDER'])(route, state);
};

/**
 * Guard para clientes
 */
export const clientGuard: CanActivateFn = (route, state) => {
  return roleGuard(['CLIENT'])(route, state);
};

/**
 * Guard para administradores
 */
export const adminGuard: CanActivateFn = (route, state) => {
  return roleGuard(['ADMIN'])(route, state);
};

/**
 * Guard combinado para proveedor o admin
 */
export const providerOrAdminGuard: CanActivateFn = (route, state) => {
  return roleGuard(['PROVIDER', 'ADMIN'])(route, state);
};

/**
 * Guard combinado para cliente o admin
 */
export const clientOrAdminGuard: CanActivateFn = (route, state) => {
  return roleGuard(['CLIENT', 'ADMIN'])(route, state);
};

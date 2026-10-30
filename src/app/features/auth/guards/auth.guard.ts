// src/app/auth/guards/auth.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { AccessAuthModalComponent } from '../../../shared/components/access-auth-modal/access-auth-modal.component';

const openGuestAccessModal = async (
  mode: 'login' | 'register' = 'register',
  guestRole: 'client' | 'provider' = 'client'
) => {
  const modalCtrl = inject(ModalController);
  const modal = await modalCtrl.create({
    component: AccessAuthModalComponent,
    backdropDismiss: true,
    cssClass: 'access-auth-modal'
  });

  const resolvedRole = guestRole === 'provider' ? 'provider' : 'client';
  const instance = (modal as any).componentInstance as AccessAuthModalComponent | undefined;
  if (instance) {
    instance.configure({
      mode,
      role: resolvedRole,
      appleSignInAvailable: false
    });
    instance.open(mode, resolvedRole);
  }

  await modal.present();
};

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

  const guestRole = localStorage.getItem('bapp_user_role');
  const isGuestProviderAccess = state.url.startsWith('/provider') && guestRole === 'provider';
  const isGuestClientAccess = state.url.startsWith('/client') && guestRole === 'client';

  if (isGuestProviderAccess) {
    const allowGuestProviderRoute = state.url === '/provider' || state.url.startsWith('/provider/tabs/home');
    if (allowGuestProviderRoute) {
      console.log('✅ authGuard: Acceso temporal de invitado proveedor permitido');
      return true;
    }

    console.log('⚠️ authGuard: Invitado proveedor intentando entrar a ruta restringida, se abre modal de acceso');
    void openGuestAccessModal('register', 'provider');
    return false;
  }

  if (isGuestClientAccess) {
    const allowGuestClientRoute = state.url.startsWith('/client/categories') || state.url.startsWith('/client/provider-info') || state.url.startsWith('/client/tabs/home');
    if (allowGuestClientRoute) {
      console.log('✅ authGuard: Acceso temporal de invitado cliente permitido');
      return true;
    }

    console.log('⚠️ authGuard: Invitado cliente intentando entrar a ruta restringida, se abre modal de acceso');
    void openGuestAccessModal('register', 'client');
    return false;
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
    router.navigate(['/client/tabs/home']);
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
      const guestRole = localStorage.getItem('bapp_user_role');
      const isGuestProviderAccess = state.url.startsWith('/provider') && guestRole === 'provider';
      const isGuestClientAccess = state.url.startsWith('/client') && guestRole === 'client';

      if (isGuestProviderAccess) {
        const allowGuestProviderRoute = state.url === '/provider' || state.url.startsWith('/provider/tabs/home');
        if (allowGuestProviderRoute) {
          console.log('✅ roleGuard: Acceso temporal de invitado proveedor permitido');
          return true;
        }

        console.log('⚠️ roleGuard: Invitado proveedor bloqueado en ruta restringida, se abre modal de acceso');
        void openGuestAccessModal('register', 'provider');
        return false;
      }

      if (isGuestClientAccess) {
        const allowGuestClientRoute = state.url.startsWith('/client/categories') || state.url.startsWith('/client/provider-info') || state.url.startsWith('/client/tabs/home');
        if (allowGuestClientRoute) {
          console.log('✅ roleGuard: Acceso temporal de invitado cliente permitido');
          return true;
        }

        console.log('⚠️ roleGuard: Invitado cliente bloqueado en ruta restringida, se abre modal de acceso');
        void openGuestAccessModal('register', 'client');
        return false;
      }

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

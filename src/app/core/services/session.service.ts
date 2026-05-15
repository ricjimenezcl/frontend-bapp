import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/services/auth.service';
import { User } from '../models/user.model';

/**
 * Session Service - Sincronizado con proyecto WEB
 * Gestiona el estado de la sesión del usuario y validaciones
 */
@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private authService = inject(AuthService);
  private router = inject(Router);

  // Estado de la sesión
  isSessionValid = signal(true);
  sessionCheckInProgress = signal(false);

  /**
   * Verificar validez de la sesión actual
   * @returns true si la sesión es válida
   */
  async checkSession(): Promise<boolean> {
    this.sessionCheckInProgress.set(true);

    try {
      const token = await this.authService.getToken();
      
      if (!token) {
        this.isSessionValid.set(false);
        return false;
      }

      // Verificar si el token está expirado
      if (this.isTokenExpired(token)) {
        console.warn('[SessionService] Token expirado');
        await this.handleInvalidSession();
        return false;
      }

      // Intentar obtener el usuario actual
      const user = this.authService.getCurrentUser();
      
      if (!user) {
        console.warn('[SessionService] Usuario no encontrado');
        await this.handleInvalidSession();
        return false;
      }

      this.isSessionValid.set(true);
      return true;

    } catch (error) {
      console.error('[SessionService] Error al verificar sesión:', error);
      await this.handleInvalidSession();
      return false;
    } finally {
      this.sessionCheckInProgress.set(false);
    }
  }

  /**
   * Manejar sesión inválida (logout y redirección)
   */
  async handleInvalidSession(): Promise<void> {
    this.isSessionValid.set(false);
    await this.authService.logout();
    await this.router.navigate(['/auth/login'], {
      queryParams: { sessionExpired: 'true' }
    });
  }

  /**
   * Renovar el token de sesión
   * @returns true si se renovó exitosamente
   */
  async refreshSession(): Promise<boolean> {
    try {
      // Implementación futura: llamar a endpoint de refresh token
      // Por ahora, verificamos la sesión actual
      return await this.checkSession();
    } catch (error) {
      console.error('[SessionService] Error al renovar sesión:', error);
      return false;
    }
  }

  /**
   * Verificar si el token JWT está expirado
   * @param token Token JWT
   * @returns true si el token está expirado
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convertir a milisegundos
      const currentTime = Date.now();
      
      // Considerar expirado si quedan menos de 5 minutos
      const bufferTime = 5 * 60 * 1000; // 5 minutos
      
      return expirationTime - currentTime < bufferTime;
    } catch (error) {
      console.error('[SessionService] Error al decodificar token:', error);
      return true; // Considerar expirado si hay error
    }
  }

  /**
   * Obtener tiempo restante del token en segundos
   * @returns Segundos restantes o 0 si expiró
   */
  getTokenTimeRemaining(): number {
    try {
      const token = this.authService.getToken();
      if (!token) return 0;

      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000;
      const currentTime = Date.now();
      const remaining = Math.max(0, expirationTime - currentTime);
      
      return Math.floor(remaining / 1000); // Convertir a segundos
    } catch (error) {
      return 0;
    }
  }

  /**
   * Obtener información del usuario actual de forma segura
   * @returns Usuario actual o null
   */
  getCurrentUser(): User | null {
    return this.authService.getCurrentUser();
  }

  /**
   * Verificar si el usuario tiene un rol específico
   * @param role Rol a verificar
   * @returns true si el usuario tiene el rol
   */
  hasRole(role: 'CLIENT' | 'PROVIDER' | 'ADMIN'): boolean {
    const user = this.getCurrentUser();
    return user?.role === role;
  }

  /**
   * Verificar si el usuario está autenticado
   * @returns true si está autenticado
   */
  isAuthenticated(): boolean {
    return this.authService.isLoggedIn();
  }

  /**
   * Limpiar estado de la sesión
   */
  clearSession(): void {
    this.isSessionValid.set(false);
    this.sessionCheckInProgress.set(false);
  }
}

// src/app/core/storage/storage.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { SqliteService, PendingSync } from './sqlite.service';

export interface StoredUser {
  id: number | string;
  email: string;
  role: string;
  access_token: string;
  user_id?: number | string;
  provider_id?: number | string;
  client_id?: number | string;
  name?: string;
  picture?: string;
  verified?: boolean;
}

export interface StoredProfile {
  id: number;
  user_id: number;
  full_name: string;
  phone: string;
  run?: string;
  bio?: string;
  avatar?: string | null;
  rating_avg?: number;
  status?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private _isInitialized = signal<boolean>(false);
  private _initPromise: Promise<boolean> | null = null;
  private _hasTokenSignal = signal<boolean>(!!localStorage.getItem('auth_access_token') || !!localStorage.getItem('token'));
  private _accessTokenCache: string | null = localStorage.getItem('token');
  private _refreshTokenCache: string | null = localStorage.getItem('refresh_token');
  
  public readonly isInitialized = this._isInitialized.asReadonly();
  
  // Computed para verificar autenticación
  public readonly isAuthenticated = computed(() => {
    return this._isInitialized() && this._hasTokenSignal();
  });

  constructor(private sqliteService: SqliteService) {}

  /**
   * Inicializa el servicio de almacenamiento
   */
  async initialize(): Promise<boolean> {
    if (this._initPromise) {
      return this._initPromise;
    }
    
    this._initPromise = this._doInitialize();
    return this._initPromise;
  }

  private async _doInitialize(): Promise<boolean> {
    try {
      console.log('🔧 StorageService: Inicializando...');
      
      const sqliteReady = await this.sqliteService.initialize();
      
      if (sqliteReady) {
        console.log('✅ StorageService: SQLite inicializado correctamente');
        const persistedToken = await this.sqliteService.getAuthToken('access_token');
        const persistedRefreshToken = await this.sqliteService.getAuthToken('refresh_token');
        this._accessTokenCache = persistedToken || this._accessTokenCache;
        this._refreshTokenCache = persistedRefreshToken || this._refreshTokenCache;
        this._hasTokenSignal.set(!!persistedToken || !!localStorage.getItem('token'));
      } else if (typeof window !== 'undefined') {
        // En navegador web, esto es esperado
        console.debug('ℹ️ StorageService: SQLite no disponible en web, usando localStorage');
      } else {
        console.warn('⚠️ StorageService: SQLite no disponible, usando localStorage');
      }
      
      this._isInitialized.set(true);
      return true;
      
    } catch (error) {
      console.error('❌ StorageService: Error en inicialización:', error);
      // Aún podemos funcionar con localStorage
      this._isInitialized.set(true);
      return true;
    }
  }

  /**
   * Espera a que el servicio esté listo
   */
  async waitForReady(): Promise<void> {
    if (this._isInitialized()) return;
    await this.initialize();
  }

  // ==================== TOKEN MANAGEMENT ====================

  async setAccessToken(token: string): Promise<void> {
    // Cache inmediato para evitar condiciones de carrera entre login y primeras requests.
    this._accessTokenCache = token;
    this._hasTokenSignal.set(!!token);
    await this.sqliteService.setAuthToken('access_token', token);
  }

  async getAccessToken(): Promise<string | null> {
    if (this._accessTokenCache) {
      return this._accessTokenCache;
    }

    const token = await this.sqliteService.getAuthToken('access_token');
    if (token) {
      this._accessTokenCache = token;
      this._hasTokenSignal.set(true);
    }
    return token;
  }

  async removeAccessToken(): Promise<void> {
    this._accessTokenCache = null;
    await this.sqliteService.removeAuthToken('access_token');
    this._hasTokenSignal.set(false);
  }

  async setRefreshToken(token: string): Promise<void> {
    this._refreshTokenCache = token;
    await this.sqliteService.setAuthToken('refresh_token', token);
  }

  async getRefreshToken(): Promise<string | null> {
    if (this._refreshTokenCache) {
      return this._refreshTokenCache;
    }

    const token = await this.sqliteService.getAuthToken('refresh_token');
    if (token) {
      this._refreshTokenCache = token;
    }
    return token;
  }

  async removeRefreshToken(): Promise<void> {
    this._refreshTokenCache = null;
    await this.sqliteService.removeAuthToken('refresh_token');
  }

  hasToken(): boolean {
    return this._hasTokenSignal();
  }

  // ==================== USER DATA ====================

  async setCurrentUser(user: StoredUser): Promise<void> {
    await this.sqliteService.setUserData('current_user', user);
    // También guardar token si viene incluido
    if (user.access_token) {
      await this.setAccessToken(user.access_token);
    }
  }

  async getCurrentUser(): Promise<StoredUser | null> {
    return this.sqliteService.getUserData<StoredUser>('current_user');
  }

  async removeCurrentUser(): Promise<void> {
    await this.sqliteService.removeUserData('current_user');
  }

  // ==================== USER PROFILE ====================

  async setUserProfile(profile: StoredProfile): Promise<void> {
    await this.sqliteService.setUserData('user_profile', profile);
  }

  async getUserProfile(): Promise<StoredProfile | null> {
    return this.sqliteService.getUserData<StoredProfile>('user_profile');
  }

  async removeUserProfile(): Promise<void> {
    await this.sqliteService.removeUserData('user_profile');
  }

  // ==================== PROVIDER SERVICES ====================

  async setProviderServices(services: any[]): Promise<void> {
    await this.sqliteService.setUserData('provider_services', services);
  }

  async getProviderServices(): Promise<any[]> {
    return (await this.sqliteService.getUserData<any[]>('provider_services')) || [];
  }

  async removeProviderServices(): Promise<void> {
    await this.sqliteService.removeUserData('provider_services');
  }

  // ==================== GENERIC KEY-VALUE ====================

  async set(key: string, value: any): Promise<void> {
    await this.sqliteService.setUserData(key, value);
  }

  async get<T = any>(key: string): Promise<T | null> {
    return this.sqliteService.getUserData<T>(key);
  }

  async remove(key: string): Promise<void> {
    await this.sqliteService.removeUserData(key);
  }

  // ==================== CACHED DATA ====================

  async setCached(key: string, value: any, ttlMs?: number): Promise<void> {
    await this.sqliteService.setCachedData(key, value, ttlMs);
  }

  async getCached<T = any>(key: string): Promise<T | null> {
    return this.sqliteService.getCachedData<T>(key);
  }

  async removeCached(key: string): Promise<void> {
    await this.sqliteService.removeCachedData(key);
  }

  async clearCache(): Promise<void> {
    await this.sqliteService.clearAllCache();
  }

  // ==================== CATEGORIES CACHE ====================

  async setCategoriesCache(type: string, data: any): Promise<void> {
    await this.sqliteService.setCategoriesCache(type, data);
  }

  async getCategoriesCache<T = any>(type: string): Promise<T | null> {
    return this.sqliteService.getCategoriesCache<T>(type);
  }

  // ==================== NEARBY PROVIDERS CACHE ====================

  async setNearbyProviders(
    serviceId: number, 
    lat: number, 
    lng: number, 
    radius: number, 
    providers: any[]
  ): Promise<void> {
    await this.sqliteService.setNearbyProvidersCache(serviceId, lat, lng, radius, providers);
  }

  async getNearbyProviders(
    serviceId: number, 
    lat: number, 
    lng: number, 
    radius: number
  ): Promise<any[] | null> {
    return this.sqliteService.getNearbyProvidersCache(serviceId, lat, lng, radius);
  }

  // ==================== OFFLINE SYNC ====================

  async queueForSync(action: string, endpoint: string, data: any): Promise<void> {
    await this.sqliteService.addPendingSync(action, endpoint, data);
  }

  async getPendingSync(): Promise<PendingSync[]> {
    return this.sqliteService.getPendingSync();
  }

  async removePendingSync(id: number): Promise<void> {
    await this.sqliteService.removePendingSync(id);
  }

  async clearPendingSync(): Promise<void> {
    await this.sqliteService.clearPendingSync();
  }

  // ==================== AUTHENTICATION HELPERS ====================

  async getUserRole(): Promise<string | null> {
    const user = await this.getCurrentUser();
    return user?.role || null;
  }

  async isProvider(): Promise<boolean> {
    const role = await this.getUserRole();
    return role === 'PROVIDER';
  }

  async isClient(): Promise<boolean> {
    const role = await this.getUserRole();
    return role === 'CLIENT';
  }

  async isAdmin(): Promise<boolean> {
    const role = await this.getUserRole();
    return role === 'ADMIN';
  }

  async getProviderId(): Promise<number | null> {
    const user = await this.getCurrentUser();
    return user?.provider_id ? Number(user.provider_id) : null;
  }

  async getUserId(): Promise<number | null> {
    const user = await this.getCurrentUser();
    return user?.user_id ? Number(user.user_id) : (user?.id ? Number(user.id) : null);
  }

  // ==================== SESSION MANAGEMENT ====================

  async clearSession(): Promise<void> {
    console.log('🔄 StorageService: Limpiando sesión...');
    this._accessTokenCache = null;
    this._refreshTokenCache = null;
    
    await this.sqliteService.clearAuthTokens();
    await this.sqliteService.clearUserData();
    
    // También limpiar localStorage por compatibilidad
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('user_profile');
    localStorage.removeItem('provider_services');

    this._hasTokenSignal.set(false);
    
    console.log('✅ StorageService: Sesión limpiada');
  }

  async clearAll(): Promise<void> {
    console.log('🔄 StorageService: Limpiando todo...');
    await this.sqliteService.clearAll();
    localStorage.clear();
    console.log('✅ StorageService: Todo limpiado');
  }

  // ==================== MIGRATION HELPERS ====================

  /**
   * Migra datos de localStorage a SQLite
   */
  async migrateFromLocalStorage(): Promise<void> {
    console.log('🔄 StorageService: Migrando datos de localStorage...');
    
    // Migrar token
    const token = localStorage.getItem('token');
    if (token) {
      await this.setAccessToken(token);
    }
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      await this.setRefreshToken(refreshToken);
    }
    
    // Migrar user_data
    const userData = localStorage.getItem('user_data');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        await this.setCurrentUser(user);
      } catch (e) {
        console.warn('Error migrando user_data:', e);
      }
    }
    
    // Migrar user_profile
    const profileData = localStorage.getItem('user_profile');
    if (profileData) {
      try {
        const profile = JSON.parse(profileData);
        await this.setUserProfile(profile);
      } catch (e) {
        console.warn('Error migrando user_profile:', e);
      }
    }
    
    // Migrar provider_services
    const servicesData = localStorage.getItem('provider_services');
    if (servicesData) {
      try {
        const services = JSON.parse(servicesData);
        await this.setProviderServices(services);
      } catch (e) {
        console.warn('Error migrando provider_services:', e);
      }
    }
    
    console.log('✅ StorageService: Migración completada');
  }
}

// Índice de exportación
export * from './sqlite.service';

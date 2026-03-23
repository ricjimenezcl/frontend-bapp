// src/app/core/storage/sqlite.service.ts
import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

export interface CachedData {
  key: string;
  value: string;
  expiry: number;
  created_at: number;
}

export interface PendingSync {
  id?: number;
  action: string;
  endpoint: string;
  data: string;
  created_at: number;
  retries: number;
}

@Injectable({
  providedIn: 'root'
})
export class SqliteService {
  private sqlite: SQLiteConnection;
  private db: SQLiteDBConnection | null = null;
  private isNative: boolean;
  private dbName = 'bappsearch_db';
  
  // Signals para estado reactivo
  private _isReady = signal<boolean>(false);
  private _lastError = signal<string | null>(null);
  
  public readonly isReady = this._isReady.asReadonly();
  public readonly lastError = this._lastError.asReadonly();

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  /**
   * Inicializa la base de datos SQLite
   */
  async initialize(): Promise<boolean> {
    try {
      // console.log('🔧 SQLite: Inicializando...', { isNative: this.isNative });
      
      if (!this.isNative) {
        // Web: usar jeep-sqlite para IndexedDB
        await this.initializeWeb();
      }
      
      // Crear conexión
      const ret = await this.sqlite.checkConnectionsConsistency();
      const isConn = (await this.sqlite.isConnection(this.dbName, false)).result;
      
      if (ret.result && isConn) {
        this.db = await this.sqlite.retrieveConnection(this.dbName, false);
      } else {
        this.db = await this.sqlite.createConnection(
          this.dbName,
          false,
          'no-encryption',
          1,
          false
        );
      }
      
      await this.db.open();
      await this.createTables();
      
      this._isReady.set(true);
      // console.log('✅ SQLite: Inicializado correctamente');
      return true;
      
    } catch (error) {
      // En web, SQLite puede no estar disponible - esto es normal
      if (!this.isNative && error instanceof Error && error.message.includes('jeep-sqlite')) {
        console.warn('⚠️ SQLite Web: No disponible (esperado en navegador), usando fallback');
      } else {
        console.error('❌ SQLite: Error al inicializar:', error);
      }
      this._lastError.set(error instanceof Error ? error.message : 'Error desconocido');
      this._isReady.set(false);
      return false;
    }
  }

  /**
   * Inicializa SQLite en web usando IndexedDB
   */
  private async initializeWeb(): Promise<void> {
    try {
      const jeepEl = document.querySelector('jeep-sqlite');
      if (jeepEl) {
        await customElements.whenDefined('jeep-sqlite');
        await this.sqlite.initWebStore();
        // console.log('✅ SQLite Web: jeep-sqlite inicializado');
      }
    } catch (error) {
      console.warn('⚠️ SQLite Web: No se pudo inicializar jeep-sqlite, usando fallback');
    }
  }

  /**
   * Crea las tablas necesarias
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const createTablesSQL = `
      -- Tabla para tokens de autenticación
      CREATE TABLE IF NOT EXISTS auth_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      -- Tabla para datos del usuario
      CREATE TABLE IF NOT EXISTS user_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      -- Tabla para datos cacheados con TTL
      CREATE TABLE IF NOT EXISTS cached_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        expiry INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      
      -- Tabla para servicios del proveedor (offline)
      CREATE TABLE IF NOT EXISTS provider_services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL,
        data TEXT NOT NULL,
        synced INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      -- Tabla para acciones pendientes de sincronización
      CREATE TABLE IF NOT EXISTS pending_sync (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        retries INTEGER DEFAULT 0
      );
      
      -- Tabla para categorías (cache offline)
      CREATE TABLE IF NOT EXISTS categories_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_type TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      -- Tabla para proveedores cercanos (cache temporal)
      CREATE TABLE IF NOT EXISTS nearby_providers_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        radius REAL NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      
      -- Índices para mejor rendimiento
      CREATE INDEX IF NOT EXISTS idx_cached_data_key ON cached_data(key);
      CREATE INDEX IF NOT EXISTS idx_cached_data_expiry ON cached_data(expiry);
      CREATE INDEX IF NOT EXISTS idx_pending_sync_action ON pending_sync(action);
      CREATE INDEX IF NOT EXISTS idx_provider_services_synced ON provider_services(synced);
    `;
    
    await this.db.execute(createTablesSQL);
    console.log('✅ SQLite: Tablas creadas correctamente');
  }

  // ==================== AUTH TOKENS ====================

  async setAuthToken(key: string, value: string): Promise<void> {
    if (!this.db) {
      console.warn('SQLite no disponible, usando localStorage');
      localStorage.setItem(`auth_${key}`, value);
      return;
    }
    
    const now = Date.now();
    const sql = `
      INSERT OR REPLACE INTO auth_tokens (key, value, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `;
    
    await this.db.run(sql, [key, value, now, now]);
  }

  async getAuthToken(key: string): Promise<string | null> {
    if (!this.db) {
      return localStorage.getItem(`auth_${key}`);
    }
    
    const sql = 'SELECT value FROM auth_tokens WHERE key = ?';
    const result = await this.db.query(sql, [key]);
    
    return result.values && result.values.length > 0 
      ? result.values[0].value 
      : null;
  }

  async removeAuthToken(key: string): Promise<void> {
    if (!this.db) {
      localStorage.removeItem(`auth_${key}`);
      return;
    }
    
    await this.db.run('DELETE FROM auth_tokens WHERE key = ?', [key]);
  }

  async clearAuthTokens(): Promise<void> {
    if (!this.db) {
      Object.keys(localStorage)
        .filter(k => k.startsWith('auth_'))
        .forEach(k => localStorage.removeItem(k));
      return;
    }
    
    await this.db.run('DELETE FROM auth_tokens');
  }

  // ==================== USER DATA ====================

  async setUserData(key: string, value: any): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (!this.db) {
      localStorage.setItem(`user_${key}`, stringValue);
      return;
    }
    
    const now = Date.now();
    const sql = `
      INSERT OR REPLACE INTO user_data (key, value, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `;
    
    await this.db.run(sql, [key, stringValue, now, now]);
  }

  async getUserData<T = any>(key: string): Promise<T | null> {
    let value: string | null = null;
    
    if (!this.db) {
      value = localStorage.getItem(`user_${key}`);
    } else {
      const sql = 'SELECT value FROM user_data WHERE key = ?';
      const result = await this.db.query(sql, [key]);
      value = result.values && result.values.length > 0 ? result.values[0].value : null;
    }
    
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async removeUserData(key: string): Promise<void> {
    if (!this.db) {
      localStorage.removeItem(`user_${key}`);
      return;
    }
    
    await this.db.run('DELETE FROM user_data WHERE key = ?', [key]);
  }

  async clearUserData(): Promise<void> {
    if (!this.db) {
      Object.keys(localStorage)
        .filter(k => k.startsWith('user_'))
        .forEach(k => localStorage.removeItem(k));
      return;
    }
    
    await this.db.run('DELETE FROM user_data');
  }

  // ==================== CACHED DATA (con TTL) ====================

  async setCachedData(key: string, value: any, ttlMs: number = 300000): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const now = Date.now();
    const expiry = now + ttlMs;
    
    if (!this.db) {
      const cacheItem = { value: stringValue, expiry };
      localStorage.setItem(`cache_${key}`, JSON.stringify(cacheItem));
      return;
    }
    
    const sql = `
      INSERT OR REPLACE INTO cached_data (key, value, expiry, created_at)
      VALUES (?, ?, ?, ?)
    `;
    
    await this.db.run(sql, [key, stringValue, expiry, now]);
  }

  async getCachedData<T = any>(key: string): Promise<T | null> {
    const now = Date.now();
    
    if (!this.db) {
      const item = localStorage.getItem(`cache_${key}`);
      if (!item) return null;
      
      try {
        const parsed = JSON.parse(item);
        if (parsed.expiry < now) {
          localStorage.removeItem(`cache_${key}`);
          return null;
        }
        return JSON.parse(parsed.value) as T;
      } catch {
        return null;
      }
    }
    
    // Limpiar datos expirados
    await this.db.run('DELETE FROM cached_data WHERE expiry < ?', [now]);
    
    const sql = 'SELECT value FROM cached_data WHERE key = ? AND expiry > ?';
    const result = await this.db.query(sql, [key, now]);
    
    if (!result.values || result.values.length === 0) return null;
    
    try {
      return JSON.parse(result.values[0].value) as T;
    } catch {
      return result.values[0].value as unknown as T;
    }
  }

  async removeCachedData(key: string): Promise<void> {
    if (!this.db) {
      localStorage.removeItem(`cache_${key}`);
      return;
    }
    
    await this.db.run('DELETE FROM cached_data WHERE key = ?', [key]);
  }

  async clearExpiredCache(): Promise<void> {
    if (!this.db) {
      const now = Date.now();
      Object.keys(localStorage)
        .filter(k => k.startsWith('cache_'))
        .forEach(k => {
          try {
            const item = JSON.parse(localStorage.getItem(k) || '{}');
            if (item.expiry < now) localStorage.removeItem(k);
          } catch {}
        });
      return;
    }
    
    await this.db.run('DELETE FROM cached_data WHERE expiry < ?', [Date.now()]);
  }

  async clearAllCache(): Promise<void> {
    if (!this.db) {
      Object.keys(localStorage)
        .filter(k => k.startsWith('cache_'))
        .forEach(k => localStorage.removeItem(k));
      return;
    }
    
    await this.db.run('DELETE FROM cached_data');
  }

  // ==================== PENDING SYNC ====================

  async addPendingSync(action: string, endpoint: string, data: any): Promise<void> {
    const stringData = typeof data === 'string' ? data : JSON.stringify(data);
    const now = Date.now();
    
    if (!this.db) {
      const pending = JSON.parse(localStorage.getItem('pending_sync') || '[]');
      pending.push({ action, endpoint, data: stringData, created_at: now, retries: 0 });
      localStorage.setItem('pending_sync', JSON.stringify(pending));
      return;
    }
    
    const sql = `
      INSERT INTO pending_sync (action, endpoint, data, created_at, retries)
      VALUES (?, ?, ?, ?, 0)
    `;
    
    await this.db.run(sql, [action, endpoint, stringData, now]);
  }

  async getPendingSync(): Promise<PendingSync[]> {
    if (!this.db) {
      return JSON.parse(localStorage.getItem('pending_sync') || '[]');
    }
    
    const result = await this.db.query('SELECT * FROM pending_sync ORDER BY created_at ASC');
    return result.values || [];
  }

  async removePendingSync(id: number): Promise<void> {
    if (!this.db) {
      const pending = JSON.parse(localStorage.getItem('pending_sync') || '[]');
      const filtered = pending.filter((_: any, index: number) => index !== id);
      localStorage.setItem('pending_sync', JSON.stringify(filtered));
      return;
    }
    
    await this.db.run('DELETE FROM pending_sync WHERE id = ?', [id]);
  }

  async incrementPendingSyncRetry(id: number): Promise<void> {
    if (!this.db) return;
    
    await this.db.run('UPDATE pending_sync SET retries = retries + 1 WHERE id = ?', [id]);
  }

  async clearPendingSync(): Promise<void> {
    if (!this.db) {
      localStorage.removeItem('pending_sync');
      return;
    }
    
    await this.db.run('DELETE FROM pending_sync');
  }

  // ==================== CATEGORIES CACHE ====================

  async setCategoriesCache(type: string, data: any): Promise<void> {
    const stringData = JSON.stringify(data);
    const now = Date.now();
    
    if (!this.db) {
      localStorage.setItem(`categories_${type}`, stringData);
      return;
    }
    
    const sql = `
      INSERT OR REPLACE INTO categories_cache (category_type, data, updated_at)
      VALUES (?, ?, ?)
    `;
    
    await this.db.run(sql, [type, stringData, now]);
  }

  async getCategoriesCache<T = any>(type: string): Promise<T | null> {
    if (!this.db) {
      const data = localStorage.getItem(`categories_${type}`);
      return data ? JSON.parse(data) : null;
    }
    
    const sql = 'SELECT data FROM categories_cache WHERE category_type = ?';
    const result = await this.db.query(sql, [type]);
    
    if (!result.values || result.values.length === 0) return null;
    
    return JSON.parse(result.values[0].data);
  }

  // ==================== NEARBY PROVIDERS CACHE ====================

  async setNearbyProvidersCache(
    serviceId: number, 
    lat: number, 
    lng: number, 
    radius: number, 
    data: any
  ): Promise<void> {
    const stringData = JSON.stringify(data);
    const now = Date.now();
    
    if (!this.db) {
      const key = `nearby_${serviceId}_${lat.toFixed(4)}_${lng.toFixed(4)}_${radius}`;
      const cacheItem = { data: stringData, created_at: now };
      localStorage.setItem(key, JSON.stringify(cacheItem));
      return;
    }
    
    // Eliminar cache anterior para estos parámetros
    await this.db.run(
      'DELETE FROM nearby_providers_cache WHERE service_id = ? AND lat = ? AND lng = ? AND radius = ?',
      [serviceId, lat, lng, radius]
    );
    
    const sql = `
      INSERT INTO nearby_providers_cache (service_id, lat, lng, radius, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.run(sql, [serviceId, lat, lng, radius, stringData, now]);
  }

  async getNearbyProvidersCache(
    serviceId: number, 
    lat: number, 
    lng: number, 
    radius: number,
    maxAgeMs: number = 60000 // 1 minuto por defecto
  ): Promise<any[] | null> {
    const minTime = Date.now() - maxAgeMs;
    
    if (!this.db) {
      const key = `nearby_${serviceId}_${lat.toFixed(4)}_${lng.toFixed(4)}_${radius}`;
      const item = localStorage.getItem(key);
      if (!item) return null;
      
      const parsed = JSON.parse(item);
      if (parsed.created_at < minTime) {
        localStorage.removeItem(key);
        return null;
      }
      return JSON.parse(parsed.data);
    }
    
    const sql = `
      SELECT data FROM nearby_providers_cache 
      WHERE service_id = ? AND lat = ? AND lng = ? AND radius = ? AND created_at > ?
    `;
    
    const result = await this.db.query(sql, [serviceId, lat, lng, radius, minTime]);
    
    if (!result.values || result.values.length === 0) return null;
    
    return JSON.parse(result.values[0].data);
  }

  // ==================== UTILIDADES ====================

  async clearAll(): Promise<void> {
    if (!this.db) {
      localStorage.clear();
      return;
    }
    
    await this.db.run('DELETE FROM auth_tokens');
    await this.db.run('DELETE FROM user_data');
    await this.db.run('DELETE FROM cached_data');
    await this.db.run('DELETE FROM provider_services');
    await this.db.run('DELETE FROM pending_sync');
    await this.db.run('DELETE FROM categories_cache');
    await this.db.run('DELETE FROM nearby_providers_cache');
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      await this.sqlite.closeConnection(this.dbName, false);
      this.db = null;
      this._isReady.set(false);
    }
  }

  isAvailable(): boolean {
    return this._isReady();
  }
}

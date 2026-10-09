import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import type {
  Product,
  ProductPlatform,
  ProductCatalogResponse,
  Transaction,
  ProductTargetRole,
  ProductPlatformType
} from '../core/models/product.model';

// Re-export types for backward compatibility
export type {
  Product,
  ProductPlatform,
  ProductCatalogResponse,
  Transaction,
  ProductTargetRole,
  ProductPlatformType
} from '../core/models/product.model';

/**
 * Product API Service
 */
@Injectable({
  providedIn: 'root'
})
export class ProductService {

  private apiUrl = `${environment.apiUrl}/products`;

  // ── Plan activo (caché compartida) ───────────────────────────────────────
  // Fuente de verdad para "¿el usuario tiene premium?" en toda la app: se basa
  // en /transactions/me (completed + expires_at vigente), NO en el flag
  // has_premium de AuthService, que solo se fija en login y nunca se refresca
  // tras una compra exitosa dentro de la misma sesión.
  private readonly activePlanSubject = new BehaviorSubject<Transaction | null>(null);
  private activePlanCacheTime = 0;
  private readonly ACTIVE_PLAN_TTL_MS = 30_000;
  readonly activePlan$ = this.activePlanSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Refresca (con TTL de 30s) el plan activo del usuario autenticado.
   * Llamar tras login, al entrar a páginas que dependen de premium, y tras
   * volver de un pago exitoso (deep-link payment-result).
   */
  refreshActivePlan(force = false): Observable<Transaction | null> {
    const isCacheValid = Date.now() - this.activePlanCacheTime < this.ACTIVE_PLAN_TTL_MS;
    if (isCacheValid && !force) {
      return of(this.activePlanSubject.value);
    }

    return this.getUserTransactions().pipe(
      map(transactions => {
        const now = Date.now();
        return transactions.find(t =>
          t.status === 'completed' && !!t.expires_at && new Date(t.expires_at).getTime() > now
        ) ?? null;
      }),
      tap(active => {
        this.activePlanSubject.next(active);
        this.activePlanCacheTime = Date.now();
      })
    );
  }

  /** Lectura síncrona (para getters de template) del plan activo ya cacheado. */
  hasActivePlanSync(): boolean {
    return !!this.activePlanSubject.value;
  }

  /**
   * Get product catalog
   */
  getCatalog(
    platform?: ProductPlatformType,
    targetRole?: ProductTargetRole
  ): Observable<ProductCatalogResponse> {
    let params = new HttpParams();
    
    if (platform) {
      params = params.set('platform', platform);
    }
    
    if (targetRole) {
      params = params.set('target_role', targetRole);
    }

    return this.http.get<ProductCatalogResponse>(
      `${this.apiUrl}/catalog`,
      { params }
    );
  }

  /**
   * Get product by SKU
   */
  getProductBySku(sku: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${sku}`);
  }

  /**
   * Get all products
   */
  getAllProducts(
    targetRole?: ProductTargetRole,
    includeInactive: boolean = false
  ): Observable<Product[]> {
    let params = new HttpParams();
    
    if (targetRole) {
      params = params.set('target_role', targetRole);
    }
    
    if (includeInactive) {
      params = params.set('include_inactive', 'true');
    }

    return this.http.get<Product[]>(this.apiUrl, { params });
  }

  /**
   * Get user transactions
   */
  getUserTransactions(): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(`${environment.apiUrl}/transactions/me`);
  }

  /**
   * Format price for display
   */
  formatPrice(product: Product, currency: 'USD' | 'CLP' = 'CLP'): string {
    if (currency === 'USD') {
      return `$${product.price_usd.toFixed(2)} USD`;
    } else {
      return `$${product.price_clp.toLocaleString('es-CL')} CLP`;
    }
  }

  /**
   * Get product display name with duration
   */
  getProductDisplayName(product: Product): string {
    return `${product.name} (${product.duration_days} días)`;
  }

  /**
   * Check if product is for current user role
   */
  isProductForRole(product: Product, userRole: 'CLIENT' | 'PROVIDER'): boolean {
    return product.target_role === userRole || product.target_role === 'ALL';
  }
}

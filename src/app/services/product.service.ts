import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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

  constructor(private http: HttpClient) {}

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

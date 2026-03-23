import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Product from catalog
 */
export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string;
  target_role: 'CLIENT' | 'PROVIDER' | 'ALL';
  duration_days: number;
  price_usd: number;
  price_clp: number;
  free_limit: number;
  is_active: boolean;
  metadata?: any;
  platforms?: PlatformProduct[];
}

/**
 * Platform-specific product mapping
 */
export interface PlatformProduct {
  id: number;
  platform: 'google_play' | 'apple_iap' | 'web';
  platform_product_id: string;
  platform_price?: string;
  is_active: boolean;
}

/**
 * Product catalog response
 */
export interface ProductCatalogResponse {
  products: Product[];
  total: number;
}

/**
 * Transaction
 */
export interface Transaction {
  id: number;
  user_id: number;
  product_id: number;
  platform: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'expired';
  transaction_id?: string;
  external_transaction_id?: string;
  platform_transaction_id?: string;
  activated_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  product?: Product;
}

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
    platform?: 'google_play' | 'apple_iap' | 'web',
    targetRole?: 'CLIENT' | 'PROVIDER' | 'ALL'
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
    targetRole?: 'CLIENT' | 'PROVIDER' | 'ALL',
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

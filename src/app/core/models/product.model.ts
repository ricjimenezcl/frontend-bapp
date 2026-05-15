/**
 * Product Models - Modelos de productos y transacciones
 * Sincronizado entre payment.service.ts y product.service.ts
 */

/**
 * Rol objetivo del producto
 */
export type ProductTargetRole = 'CLIENT' | 'PROVIDER' | 'ALL';

/**
 * Plataforma de compra
 */
export type ProductPlatformType = 'google_play' | 'apple_iap' | 'web' | 'transbank';

/**
 * Estado de transacción
 */
export type ProductTransactionStatus = 
  | 'pending' 
  | 'completed' 
  | 'failed' 
  | 'refunded' 
  | 'expired';

/**
 * Producto del catálogo
 */
export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string;
  target_role: ProductTargetRole;
  duration_days: number;
  price_usd: number;
  price_clp: number;
  free_limit: number;
  is_active: boolean;
  metadata?: any;
  platforms?: ProductPlatform[];
}

/**
 * Mapeo de producto específico por plataforma
 */
export interface ProductPlatform {
  id?: number;
  platform: ProductPlatformType;
  platform_product_id: string;
  platform_price?: string;
  is_active: boolean;
}

/**
 * Response del catálogo de productos
 */
export interface ProductCatalogResponse {
  products: Product[];
  total: number;
}

/**
 * Transacción de compra
 */
export interface Transaction {
  id: number;
  user_id: number;
  product_id: number;
  platform: string;
  amount: number;
  currency: string;
  status: ProductTransactionStatus;
  transaction_id?: string;
  external_transaction_id?: string;
  platform_transaction_id?: string;
  activated_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  product?: Product;
}

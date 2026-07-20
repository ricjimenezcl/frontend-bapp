/**
 * Payment Models - Sincronizado con proyecto WEB
 * Define todos los tipos y estructuras para pagos
 */

// Re-export Product and ProductPlatform for convenience
export { Product, ProductPlatform } from './product.model';

/**
 * Tipos de producto disponibles (desde web-bapp)
 */
export type ProductType =
  | 'CLIENT_UNLOCK_7'
  | 'CLIENT_UNLOCK_30'
  | 'PROVIDER_SERVICE_30'
  | 'PROVIDER_SERVICE_YEAR'
  | 'PROVIDER_LEADS_7'
  | 'PROVIDER_LEADS_30'
  | 'PROVIDER_PREMIUM_MONTHLY'
  | 'PROVIDER_PREMIUM_ANNUAL';

/**
 * Plataformas de pago soportadas
 */
export type PaymentPlatform = 'transbank' | 'google_play' | 'apple_iap';

/**
 * Request para crear transacción (Web - Transbank)
 */
export interface CreateTransactionRequest {
  product_type: ProductType;
  amount: number;
}

/**
 * Response de creación de transacción (Web - Transbank)
 */
export interface CreateTransactionResponse {
  success: boolean;
  token: string;
  url: string;
  buy_order: string;
  session_id: string;
  amount: number;
  product_type: ProductType;
}

/**
 * Response de commit de transacción (Web - Transbank)
 */
export interface CommitTransactionResponse {
  success: boolean;
  status: string;
  buy_order?: string;
  authorization_code?: string;
  amount?: number;
  transaction_id?: number;
  expires_at?: string;
  error?: string;
}

/**
 * Response de estado de transacción (Web - Transbank)
 */
export interface TransactionStatusResponse {
  success: boolean;
  buy_order: string;
  local_status: string;
  product_type?: string;
  amount: number;
  token?: string;
  transbank?: Record<string, unknown>;
}

/**
 * Response unificada de verificación de pago
 */
export interface PaymentVerificationResponse {
  success: boolean;
  transaction_id?: number;
  message: string;
  expires_at?: string;
  error?: string;
  buy_order?: string;
  authorization_code?: string;
  status?: string;
}

/**
 * Datos de compra Google Play
 */
export interface GooglePlayPurchase {
  productId: string;
  purchaseToken: string;
  orderId?: string;
  packageName: string;
  purchaseTime: number;
  purchaseState: number;
}

/**
 * Datos de compra Apple IAP
 */
export interface AppleIAPPurchase {
  productId: string;
  transactionId: string;
  transactionReceipt: string;
}

/**
 * Datos de pago Transbank
 */
export interface TransbankPayment {
  token: string;
  url: string;
  buy_order?: string;
}

// Note: Product and ProductPlatform are now imported from product.model.ts

/**
 * Estado de una transacción
 */
export type TransactionStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'COMPLETED'
  | 'FAILED'
  | 'REVERSED'
  | 'NULLIFIED';

/**
 * Información completa de transacción
 */
export interface Transaction {
  id: number;
  user_id: number;
  product_type: ProductType;
  amount: number;
  status: TransactionStatus;
  buy_order?: string;
  token?: string;
  authorization_code?: string;
  payment_platform: PaymentPlatform;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Helper: Mapeo de ProductType a nombre legible
 */
export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  CLIENT_UNLOCK_7: 'Desbloqueo 7 días',
  CLIENT_UNLOCK_30: 'Desbloqueo 30 días',
  PROVIDER_SERVICE_30: 'Publicación servicio 30 días',
  PROVIDER_SERVICE_YEAR: 'Publicación servicio 1 año',
  PROVIDER_LEADS_7: 'Leads premium 7 días',
  PROVIDER_LEADS_30: 'Leads premium 30 días',
  PROVIDER_PREMIUM_MONTHLY: 'Premium mensual',
  PROVIDER_PREMIUM_ANNUAL: 'Premium anual',
};

/**
 * Helper: Duración en días por tipo de producto
 */
export const PRODUCT_DURATIONS: Record<ProductType, number> = {
  CLIENT_UNLOCK_7: 7,
  CLIENT_UNLOCK_30: 30,
  PROVIDER_SERVICE_30: 30,
  PROVIDER_SERVICE_YEAR: 365,
  PROVIDER_LEADS_7: 7,
  PROVIDER_LEADS_30: 30,
  PROVIDER_PREMIUM_MONTHLY: 30,
  PROVIDER_PREMIUM_ANNUAL: 365,
};

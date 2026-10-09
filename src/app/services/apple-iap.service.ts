/**
 * AppleIapService
 *
 * Envuelve el SDK de RevenueCat (@revenuecat/purchases-capacitor) para
 * habilitar compras In-App reales en iOS, cumpliendo Apple Guideline 3.1.1
 * (los pagos de productos digitales dentro de la app deben usar StoreKit).
 *
 * RevenueCat valida los recibos con Apple y gestiona los "entitlements";
 * el backend recibe la confirmación vía webhook de RevenueCat (ver
 * docs.revenuecat.com/docs/webhooks) para activar el premium del usuario.
 *
 * Este servicio SOLO se activa en iOS nativo. En Android/Web no hace nada
 * (el flujo sigue usando PaymentRedirectService → Transbank/Mercado Pago).
 */

import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL, type CustomerInfo, type PurchasesStoreProduct } from '@revenuecat/purchases-capacitor';
import { environment } from '../../environments/environment';
import { AuthService } from '../features/auth/services/auth.service';
import { ProductType } from '../core/models/payment.model';

/**
 * Mapeo de ProductType (backend) a Product ID configurado en
 * App Store Connect + RevenueCat. Solo los productos aquí listados
 * están disponibles como compra In-App en iOS.
 *
 * NOTA: sufijo "_v2" porque los IDs originales (sin sufijo) se crearon
 * primero como "No consumible" y luego se eliminaron para recrearlos como
 * "Consumible" — Apple reserva un Product ID para siempre una vez usado,
 * incluso borrado, por lo que no se pueden reutilizar los nombres antiguos.
 */
const IOS_PRODUCT_ID_MAP: Partial<Record<ProductType, string>> = {
  CLIENT_UNLOCK_7: 'bapp_client_unlock_7_v2',
  CLIENT_UNLOCK_30: 'bapp_client_unlock_30_v2',
  PROVIDER_PLAN_7D: 'bapp_provider_plan_7d_v2',
  PROVIDER_PLAN_MONTHLY: 'bapp_provider_plan_monthly_v2',
  PROVIDER_PLAN_ANNUAL: 'bapp_provider_plan_annual_v2',
};

export interface AppleIapPurchaseResult {
  success: boolean;
  /** true si el usuario canceló el diálogo de compra (no es un error real) */
  cancelled?: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AppleIapService {
  private readonly auth = inject(AuthService);
  private configured = false;

  /** Devuelve el Product ID de RevenueCat/App Store para un ProductType, si existe */
  getIosProductId(productType: ProductType): string | undefined {
    return IOS_PRODUCT_ID_MAP[productType];
  }

  /** true si el producto tiene compra In-App disponible en iOS */
  isAvailableOnIos(productType: ProductType): boolean {
    return !!IOS_PRODUCT_ID_MAP[productType];
  }

  private isIos(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  }

  /** Inicializa el SDK de RevenueCat (una sola vez) con el usuario autenticado */
  private async ensureConfigured(): Promise<void> {
    if (this.configured || !this.isIos()) return;

    const apiKey = environment.revenueCatApiKeyIos;
    if (!apiKey) {
      console.error('[AppleIapService] Falta revenueCatApiKeyIos en environment (.env REVENUECAT_API_KEY_IOS)');
      return;
    }

    const user = this.auth.getCurrentUser();
    const appUserID = user?.id ? String(user.id) : undefined;

    await Purchases.configure({ apiKey, appUserID });

    if (!environment.production) {
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
    }

    this.configured = true;
  }

  /**
   * Compra un producto vía StoreKit/RevenueCat.
   * Retorna cancelled=true si el usuario cierra el diálogo (no mostrar error en ese caso).
   */
  async purchase(productType: ProductType): Promise<AppleIapPurchaseResult> {
    const productId = this.getIosProductId(productType);
    if (!productId) {
      return { success: false, error: 'not-available-on-ios' };
    }

    try {
      await this.ensureConfigured();

      const { products } = await Purchases.getProducts({ productIdentifiers: [productId] });
      const product: PurchasesStoreProduct | undefined = products[0];
      if (!product) {
        return { success: false, error: 'product-not-found' };
      }

      const result = await Purchases.purchaseStoreProduct({ product });
      return { success: true, customerInfo: result.customerInfo };
    } catch (error: any) {
      if (error?.userCancelled) {
        return { success: false, cancelled: true };
      }
      console.error('[AppleIapService] Error en compra:', error);
      return { success: false, error: error?.message ?? 'purchase-failed' };
    }
  }

  /** Restaura compras previas (requerido por Apple para no-consumibles/suscripciones) */
  async restorePurchases(): Promise<AppleIapPurchaseResult> {
    try {
      await this.ensureConfigured();
      const { customerInfo } = await Purchases.restorePurchases();
      return { success: true, customerInfo };
    } catch (error: any) {
      console.error('[AppleIapService] Error al restaurar compras:', error);
      return { success: false, error: error?.message ?? 'restore-failed' };
    }
  }
}

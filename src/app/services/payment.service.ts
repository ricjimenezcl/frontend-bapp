import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { PlatformDetectionService } from './platform-detection.service';
import { environment } from '../../environments/environment';
import {
  PaymentVerificationResponse,
  GooglePlayPurchase,
  AppleIAPPurchase,
  TransbankPayment,
  CreateTransactionRequest,
  CreateTransactionResponse,
  CommitTransactionResponse,
  TransactionStatusResponse,
  Product,
  ProductType
} from '../core/models/payment.model';

/**
 * Payment Service
 * Handles in-app purchases across Android, iOS, and Web platforms
 */
@Injectable({
  providedIn: 'root'
})
export class PaymentService {

  private apiUrl = `${environment.apiUrl}/payments`;

  constructor(
    private http: HttpClient,
    private platformDetection: PlatformDetectionService
  ) {}

  /**
   * Purchase a product (platform-agnostic)
   */
  purchaseProduct(product: Product): Observable<PaymentVerificationResponse> {
    const platform = this.platformDetection.getPlatform();

    switch (platform) {
      case 'android':
        return this.purchaseGooglePlay(product);
      case 'ios':
        return this.purchaseAppleIAP(product);
      case 'web':
        return this.purchaseWeb(product);
      default:
        return throwError(() => new Error('Unsupported platform'));
    }
  }

  /**
   * Purchase via Google Play
   */
  private purchaseGooglePlay(product: Product): Observable<PaymentVerificationResponse> {
    // Get Google Play product ID
    const platformProduct = product.platforms?.find(p => p.platform === 'google_play');
    
    if (!platformProduct) {
      return throwError(() => new Error('Product not available for Android'));
    }

    // Note: This requires @capacitor-community/in-app-purchases or similar plugin
    // For now, returning mock implementation
    console.log('Initiating Google Play purchase:', platformProduct.platform_product_id);

    // In production, you would use:
    // import { InAppPurchase2, IAPProduct } from '@capacitor-community/in-app-purchases';
    // 
    // return from(InAppPurchase2.order(platformProduct.platform_product_id)).pipe(
    //   switchMap(purchase => this.verifyGooglePlayPurchase(purchase))
    // );

    return throwError(() => new Error('Google Play purchases not yet implemented. Install @capacitor-community/in-app-purchases plugin.'));
  }

  /**
   * Verify Google Play purchase with backend
   */
  verifyGooglePlayPurchase(purchase: GooglePlayPurchase): Observable<PaymentVerificationResponse> {
    return this.http.post<PaymentVerificationResponse>(
      `${this.apiUrl}/verify/google-play`,
      {
        purchase_token: purchase.purchaseToken,
        product_id: purchase.productId,
        package_name: purchase.packageName
      }
    );
  }

  /**
   * Purchase via Apple IAP
   */
  private purchaseAppleIAP(product: Product): Observable<PaymentVerificationResponse> {
    // Get Apple IAP product ID
    const platformProduct = product.platforms?.find(p => p.platform === 'apple_iap');
    
    if (!platformProduct) {
      return throwError(() => new Error('Product not available for iOS'));
    }

    console.log('Initiating Apple IAP purchase:', platformProduct.platform_product_id);

    // In production, you would use:
    // import { InAppPurchase2 } from '@capacitor-community/in-app-purchases';
    // 
    // return from(InAppPurchase2.order(platformProduct.platform_product_id)).pipe(
    //   switchMap(purchase => this.verifyAppleIAPPurchase(purchase))
    // );

    return throwError(() => new Error('Apple IAP not yet implemented. Install @capacitor-community/in-app-purchases plugin.'));
  }

  /**
   * Verify Apple IAP purchase with backend
   */
  verifyAppleIAPPurchase(purchase: AppleIAPPurchase): Observable<PaymentVerificationResponse> {
    return this.http.post<PaymentVerificationResponse>(
      `${this.apiUrl}/verify/apple-iap`,
      {
        receipt_data: purchase.transactionReceipt
      }
    );
  }

  /**
   * Purchase via Web (Transbank)
   */
  private purchaseWeb(product: Product): Observable<PaymentVerificationResponse> {
    // Create Transbank transaction
    return this.createTransbankTransaction(product.sku).pipe(
      switchMap(payment => {
        // Redirect to Transbank payment page
        window.location.href = `${payment.url}?token_ws=${payment.token}`;
        
        // Return pending status (actual verification happens on callback)
        return new Observable<PaymentVerificationResponse>(observer => {
          observer.next({
            success: true,
            message: 'Redirecting to payment gateway...'
          });
          observer.complete();
        });
      })
    );
  }

  /**
   * Create Transbank transaction (from web project)
   */
  createTransaction(payload: CreateTransactionRequest): Observable<CreateTransactionResponse> {
    return this.http.post<CreateTransactionResponse>(
      `${this.apiUrl}/transbank/create`,
      payload
    );
  }

  /**
   * Create Transbank transaction (legacy method with productSku)
   * @deprecated Use createTransaction(payload) instead
   */
  createTransbankTransaction(productSku: string): Observable<TransbankPayment> {
    return this.http.post<TransbankPayment>(
      `${this.apiUrl}/transbank/create`,
      null,
      { params: { product_sku: productSku } }
    );
  }

  /**
   * Verify Transbank payment (called from callback)
   * @deprecated Use commitTransaction(token) instead for consistency with web
   */
  verifyTransbankPayment(token: string): Observable<PaymentVerificationResponse> {
    return this.http.post<PaymentVerificationResponse>(
      `${this.apiUrl}/verify/transbank`,
      { token }
    );
  }

  /**
   * Commit Transbank transaction (from web project)
   * Confirms and validates a Transbank payment after redirect
   */
  commitTransaction(token: string): Observable<CommitTransactionResponse> {
    return this.http.post<CommitTransactionResponse>(
      `${this.apiUrl}/transbank/commit`,
      { token }
    );
  }

  /**
   * Get transaction status by buy_order (from web project)
   */
  getTransactionStatus(buyOrder: string): Observable<TransactionStatusResponse> {
    return this.http.get<TransactionStatusResponse>(
      `${this.apiUrl}/transbank/status/${buyOrder}`
    );
  }

  /**
   * Restore purchases (for iOS/Android)
   */
  restorePurchases(): Observable<any> {
    if (!this.platformDetection.isNative()) {
      return throwError(() => new Error('Restore only available on mobile'));
    }

    // In production:
    // return from(InAppPurchase2.restore());

    return throwError(() => new Error('Restore not yet implemented'));
  }

  /**
   * Get platform-specific payment method name
   */
  getPaymentMethodName(): string {
    const platform = this.platformDetection.getPlatform();
    
    switch (platform) {
      case 'android':
        return 'Google Play';
      case 'ios':
        return 'App Store';
      case 'web':
        return 'Transbank Webpay';
      default:
        return 'Unknown';
    }
  }

  /**
   * Check if platform supports in-app purchases
   */
  supportsIAP(): boolean {
    return this.platformDetection.supportsIAP();
  }

  /**
   * Get payment instructions for platform
   */
  getPaymentInstructions(): string {
    const platform = this.platformDetection.getPlatform();
    
    switch (platform) {
      case 'android':
        return 'El pago se procesará a través de Google Play. Asegúrate de tener un método de pago configurado en tu cuenta de Google.';
      case 'ios':
        return 'El pago se procesará a través del App Store. Asegúrate de tener un método de pago configurado en tu cuenta de Apple.';
      case 'web':
        return 'Serás redirigido a Webpay para completar el pago de forma segura con tu tarjeta de crédito o débito.';
      default:
        return '';
    }
  }

  /**
   * Purchase product by type (unified method for web compatibility)
   * @param productType Type of product from ProductType union
   * @param amount Amount in CLP
   * @returns Observable with payment flow result
   */
  purchaseByProductType(
    productType: ProductType,
    amount: number
  ): Observable<PaymentVerificationResponse | CreateTransactionResponse> {
    const platform = this.platformDetection.getPlatform();

    // Web platform → use Transbank directly
    if (platform === 'web') {
      return this.createTransaction({ product_type: productType, amount }).pipe(
        switchMap(response => {
          // Redirect to Transbank
          if (response.url && response.token) {
            window.location.href = `${response.url}?token_ws=${response.token}`;
          }
          return new Observable<CreateTransactionResponse>(observer => {
            observer.next(response);
            observer.complete();
          });
        })
      );
    }

    // Native platforms → use IAP (if implemented)
    return throwError(() => new Error(
      'Native IAP not yet configured for this product type. Use purchaseProduct() with Product object.'
    ));
  }

  /**
   * Get readable name for product type
   * @param productType Product type
   * @returns Human-readable name in Spanish
   */
  getProductTypeName(productType: ProductType): string {
    const labels: Record<ProductType, string> = {
      CLIENT_UNLOCK_7: 'Desbloqueo 7 días',
      CLIENT_UNLOCK_30: 'Desbloqueo 30 días',
      PROVIDER_SERVICE_30: 'Publicación servicio 30 días',
      PROVIDER_SERVICE_YEAR: 'Publicación servicio 1 año',
      PROVIDER_LEADS_7: 'Leads premium 7 días',
      PROVIDER_LEADS_30: 'Leads premium 30 días',
      PROVIDER_PREMIUM_MONTHLY: 'Premium mensual',
      PROVIDER_PREMIUM_ANNUAL: 'Premium anual',
    };
    return labels[productType] || productType;
  }
}

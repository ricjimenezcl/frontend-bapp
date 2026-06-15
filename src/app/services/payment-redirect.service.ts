/**
 * PaymentRedirectService
 *
 * Redirige todos los flujos de pago de la app al sitio web externo
 * https://bappsearch.com/payment pasando los parámetros correspondientes.
 *
 * En dispositivos nativos (iOS/Android) el sistema abre el navegador del
 * OS (SFSafariViewController / Chrome Custom Tabs), lo cual es necesario
 * para que Transbank WebPay pueda completar el flujo de pago seguro.
 *
 * Tras el pago el sitio redirige al usuario de vuelta a la app usando
 * el deep-link:  bapp://payment-result?status=success|failed&productType=...
 */

import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { AuthService } from '../auth/services/auth.service';
import { ProductType } from '../core/models/payment.model';

export interface PaymentRedirectOptions {
  /** Tipo de producto a comprar (debe coincidir con PRODUCT_TYPE_CONFIG del backend) */
  productType: ProductType;
  /**
   * Ruta interna de la app a la que volver tras el pago.
   * Se convierte en deep-link: bapp://payment-result?returnTo=...
   */
  returnTo?: string;
  /** Acción adicional que la pantalla de retorno debe ejecutar */
  action?: string;
}

const PAYMENT_BASE_URL = 'https://bappsearch.com/app-payment';

@Injectable({ providedIn: 'root' })
export class PaymentRedirectService {
  private readonly router = inject(Router);
  private readonly auth   = inject(AuthService);

  /**
   * Abre el sitio de pago en el navegador del sistema con los parámetros
   * correspondientes al producto elegido.
   */
  openPayment(options: PaymentRedirectOptions): void {
    const user = this.auth.getCurrentUser();
    const userId = user?.id ?? user?.user_id ?? '';
    const role   = (user?.role ?? 'CLIENT').toUpperCase();
    const token  = localStorage.getItem('token') ?? '';

    const params = new URLSearchParams({
      token,
      product_type: options.productType,
      user_id:      String(userId),
      role,
    });

    // returnTo como deep-link para que bappsearch.com redirija de vuelta a la app
    if (options.returnTo) {
      const returnDeepLink = `bapp://payment-result?returnTo=${encodeURIComponent(options.returnTo)}${options.action ? `&action=${encodeURIComponent(options.action)}` : ''}`;
      params.set('returnTo', returnDeepLink);
    }

    const url = `${PAYMENT_BASE_URL}?${params.toString()}`;

    if (Capacitor.isNativePlatform()) {
      // En nativo, window.open con _system abre el navegador del OS
      window.open(url, '_system');
    } else {
      // En web, navegar en la misma pestaña como hace el PaymentComponent
      window.location.href = url;
    }
  }

  /**
   * Atajos semánticos para los casos de uso más comunes
   */

  openClientUnlock(returnTo?: string): void {
    this.openPayment({ productType: 'CLIENT_UNLOCK_7', returnTo });
  }

  openProviderServicePlan(returnTo?: string, action?: string): void {
    this.openPayment({ productType: 'PROVIDER_SERVICE_30', returnTo, action });
  }

  openProviderLeads(returnTo?: string): void {
    this.openPayment({ productType: 'PROVIDER_LEADS_7', returnTo });
  }

  openProviderPremium(returnTo?: string): void {
    this.openPayment({ productType: 'PROVIDER_PREMIUM_MONTHLY', returnTo });
  }
}

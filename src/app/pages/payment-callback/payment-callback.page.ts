import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadingController, ToastController, AlertController } from '@ionic/angular';
import { PaymentService } from '../../services/payment.service';

@Component({
  selector: 'app-payment-callback',
  templateUrl: './payment-callback.page.html',
  styleUrls: ['./payment-callback.page.scss'],
})
export class PaymentCallbackPage implements OnInit {

  status: 'processing' | 'success' | 'failed' = 'processing';
  message: string = 'Verificando pago...';
  transactionId?: number;
  expiresAt?: string;
  errorMessage?: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentService: PaymentService,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.processCallback();
  }

  /**
   * Detecta el proveedor de pago por los query params y delega al handler correcto.
   *
   * Transbank   → token_ws presente en la URL
   * Mercado Pago → provider=mercadopago presente en la URL (back_urls del preference)
   */
  async processCallback() {
    const params = this.route.snapshot.queryParamMap;
    const provider = params.get('provider');
    const tokenWs   = params.get('token_ws');

    if (provider === 'mercadopago') {
      await this.processMercadoPagoCallback(params.get('status') ?? '');
    } else if (tokenWs) {
      await this.processTransbankCallback(tokenWs);
    } else {
      this.status = 'failed';
      this.message = 'Callback de pago no reconocido';
      this.errorMessage = 'No se encontraron parámetros de pago válidos';
      await this.showErrorAlert();
    }
  }

  /**
   * Callback de Transbank — verifica (y commitea) el pago en el backend.
   */
  async processTransbankCallback(token: string) {
    const loading = await this.loadingCtrl.create({
      message: 'Verificando pago con Transbank...',
    });
    await loading.present();

    try {
      const result = await this.paymentService.verifyTransbankPayment(token).toPromise();
      await loading.dismiss();

      if (result?.success) {
        this.status = 'success';
        this.message = result.message || '¡Pago exitoso!';
        this.transactionId = result.transaction_id;
        this.expiresAt = result.expires_at;
        await this.showSuccessAlert();
      } else {
        this.status = 'failed';
        this.message = 'El pago no pudo ser procesado';
        this.errorMessage = result?.error || 'Error desconocido';
        await this.showErrorAlert();
      }
    } catch (error: any) {
      await loading.dismiss();
      console.error('Transbank callback error:', error);
      this.status = 'failed';
      this.message = 'Error al verificar el pago con Transbank';
      this.errorMessage = error?.message || 'Error de conexión';
      await this.showErrorAlert();
    }
  }

  /**
   * Callback de Mercado Pago — el pago se procesa vía webhook en el backend.
   * Esta pantalla solo muestra el estado informativo; la activación real
   * ya ocurrió (o ocurrirá) cuando llegue el webhook IPN de Mercado Pago.
   *
   * Estados posibles que MP devuelve en la back_url:
   *   approved → pago aprobado
   *   failure  → pago rechazado
   *   pending  → pago en revisión (transferencia bancaria, etc.)
   */
  async processMercadoPagoCallback(mpStatus: string) {
    const loading = await this.loadingCtrl.create({
      message: 'Procesando resultado de Mercado Pago...',
    });
    await loading.present();

    // Pequeña espera para dar tiempo al webhook de procesarse en el backend
    await new Promise(resolve => setTimeout(resolve, 2000));
    await loading.dismiss();

    if (mpStatus === 'approved') {
      this.status = 'success';
      this.message = '¡Pago aprobado! Tu beneficio estará activo en unos momentos.';
      await this.showSuccessAlert();
    } else if (mpStatus === 'pending') {
      this.status = 'processing';
      this.message = 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.';
    } else {
      this.status = 'failed';
      this.message = 'El pago fue rechazado o cancelado';
      this.errorMessage = 'Puedes intentarlo de nuevo con otro medio de pago';
      await this.showErrorAlert();
    }
  }

  /**
   * Show success alert
   */
  async showSuccessAlert() {
    const alert = await this.alertCtrl.create({
      header: '¡Pago Exitoso!',
      message: `
        <p>${this.message}</p>
        ${this.expiresAt ? `<p>Tu beneficio expira el: ${this.formatDate(this.expiresAt)}</p>` : ''}
      `,
      buttons: [
        {
          text: 'Ver mi Perfil',
          handler: () => {
            this.router.navigate(['/tabs/profile']);
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Show error alert
   */
  async showErrorAlert() {
    const alert = await this.alertCtrl.create({
      header: 'Error en el Pago',
      message: `
        <p>${this.message}</p>
        ${this.errorMessage ? `<p class="error-detail">${this.errorMessage}</p>` : ''}
        <p>Si se realizó un cargo a tu tarjeta, será reembolsado automáticamente.</p>
      `,
      buttons: [
        {
          text: 'Intentar de Nuevo',
          handler: () => {
            this.router.navigate(['/product-catalog']);
          }
        },
        {
          text: 'Contactar Soporte',
          handler: () => {
            window.location.href = 'mailto:soporte@bappsearch.com';
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Format date
   */
  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Return to catalog
   */
  goToCatalog() {
    this.router.navigate(['/product-catalog']);
  }

  /**
   * Go to profile
   */
  goToProfile() {
    this.router.navigate(['/tabs/profile']);
  }

  /**
   * Contact support
   */
  contactSupport() {
    window.location.href = 'mailto:soporte@bappsearch.com?subject=Problema con pago';
  }
}

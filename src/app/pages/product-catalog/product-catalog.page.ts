import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadingController, ToastController, AlertController } from '@ionic/angular';
import { ProductService, Product } from '../../services/product.service';
import { PaymentService } from '../../services/payment.service';
import { PaymentRedirectService } from '../../services/payment-redirect.service';
import { PlatformDetectionService } from '../../services/platform-detection.service';
import { AuthService } from '../../auth/services/auth.service';
import { ProductType } from '../../core/models/payment.model';

@Component({
  selector: 'app-product-catalog',
  templateUrl: './product-catalog.page.html',
  styleUrls: ['./product-catalog.page.scss'],
})
export class ProductCatalogPage implements OnInit {

  products: Product[] = [];
  loading = true;
  userRole: 'CLIENT' | 'PROVIDER' | null = null;
  platform: string = '';
  paymentMethod: string = '';

  constructor(
    private productService: ProductService,
    public paymentService: PaymentService,
    private paymentRedirect: PaymentRedirectService,
    private platformDetection: PlatformDetectionService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  goBack() {
    this.location.back();
  }

  ngOnInit() {
    this.platform = this.platformDetection.getPlatform();
    this.paymentMethod = this.paymentService.getPaymentMethodName();
    this.loadUserRole();
    this.loadProducts();
  }

  /**
   * Load user role
   */
  loadUserRole() {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userRole = user.role === 'provider' ? 'PROVIDER' : 'CLIENT';
    }
  }

  /**
   * Load products from API
   */
  async loadProducts() {
    this.loading = true;

    try {
      const paymentPlatform = this.platformDetection.getPaymentPlatform();
      
      const response = await this.productService.getCatalog(
        paymentPlatform,
        this.userRole || undefined
      ).toPromise();

      this.products = response?.products || [];
    } catch (error) {
      console.error('Error loading products:', error);
      this.showToast('Error al cargar productos', 'danger');
    } finally {
      this.loading = false;
    }
  }

  /**
   * Get filtered products for current user
   */
  getFilteredProducts(): Product[] {
    if (!this.userRole) {
      return this.products;
    }

    return this.products.filter(product => 
      this.productService.isProductForRole(product, this.userRole!)
    );
  }

  /**
   * Format product price
   */
  formatPrice(product: Product): string {
    // Use CLP for Chilean market
    return this.productService.formatPrice(product, 'CLP');
  }

  /**
   * Purchase product — redirige al sitio web bappsearch.com para completar el pago.
   * El flujo de pago es manejado por Transbank WebPay en el navegador del sistema.
   */
  async purchaseProduct(product: Product) {
    const confirm = await this.showPurchaseConfirmation(product);
    if (!confirm) {
      return;
    }

    const returnTo = this.route.snapshot.queryParamMap.get('returnTo') ?? '/tabs/profile';
    const action   = this.route.snapshot.queryParamMap.get('action') ?? undefined;

    // Redirigir al sitio de pago externo (bappsearch.com/payment)
    this.paymentRedirect.openPayment({
      productType: product.sku as ProductType,
      returnTo,
      action,
    });
  }

  /**
   * Show purchase confirmation dialog
   */
  async showPurchaseConfirmation(product: Product): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar Compra',
      message: `
        <p><strong>${product.name}</strong></p>
        <p>${product.description}</p>
        <p>Precio: ${this.formatPrice(product)}</p>
        <p>Duración: ${product.duration_days} días</p>
        <p>Método de pago: ${this.paymentMethod}</p>
        <p class="text-muted">${this.paymentService.getPaymentInstructions()}</p>
      `,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Comprar',
          role: 'confirm'
        }
      ]
    });

    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }

  /**
   * Show success message
   */
  async showSuccessMessage(product: Product) {
    const alert = await this.alertCtrl.create({
      header: '¡Compra Exitosa!',
      message: `
        Has adquirido ${product.name} por ${product.duration_days} días.
        Tu beneficio está activo ahora.
      `,
      buttons: ['OK']
    });

    await alert.present();
  }

  /**
   * Show toast message
   */
  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  /**
   * Get product icon
   */
  getProductIcon(product: Product): string {
    if (product.sku.includes('premium')) {
      return 'star';
    } else if (product.sku.includes('service')) {
      return 'briefcase';
    }
    return 'cart';
  }

  /**
   * Get product color
   */
  getProductColor(product: Product): string {
    if (product.sku.includes('premium')) {
      return 'warning';
    } else if (product.sku.includes('service')) {
      return 'primary';
    }
    return 'medium';
  }
}

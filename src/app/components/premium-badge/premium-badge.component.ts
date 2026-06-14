import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ProductService, Transaction } from '../../services/product.service';
import { PaymentRedirectService } from '../../services/payment-redirect.service';

/**
 * Premium Badge Component
 * Shows premium status and expiration in user profile or provider dashboard
 */
@Component({
  selector: 'app-premium-badge',
  templateUrl: './premium-badge.component.html',
  styleUrls: ['./premium-badge.component.scss']
})
export class PremiumBadgeComponent implements OnInit {

  @Input() userId?: number;
  @Input() compactMode: boolean = false;

  isPremium = false;
  expiresAt?: Date;
  remainingDays = 0;
  loading = true;

  constructor(
    private productService: ProductService,
    private router: Router,
    private paymentRedirect: PaymentRedirectService
  ) {}

  ngOnInit() {
    this.loadPremiumStatus();
  }

  /**
   * Load user's premium status from transactions
   */
  async loadPremiumStatus() {
    this.loading = true;

    try {
      const transactions = await this.productService.getUserTransactions().toPromise() || [];
      
      // Find active premium subscription
      const premiumTransaction = this.findActivePremiumTransaction(transactions);

      if (premiumTransaction && premiumTransaction.expires_at) {
        this.isPremium = true;
        this.expiresAt = new Date(premiumTransaction.expires_at);
        this.calculateRemainingDays();
      }

    } catch (error) {
      console.error('Error loading premium status:', error);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Find active premium transaction
   */
  findActivePremiumTransaction(transactions: Transaction[]): Transaction | null {
    const now = new Date();

    // Filter to completed transactions with PREMIUM_ACCESS product
    const premiumTransactions = transactions.filter(t => 
      t.status === 'completed' &&
      t.product?.sku === 'PREMIUM_ACCESS' &&
      t.expires_at &&
      new Date(t.expires_at) > now
    );

    // Sort by expiration date descending and get the latest
    if (premiumTransactions.length > 0) {
      premiumTransactions.sort((a, b) => {
        const dateA = new Date(a.expires_at!).getTime();
        const dateB = new Date(b.expires_at!).getTime();
        return dateB - dateA;
      });

      return premiumTransactions[0];
    }

    return null;
  }

  /**
   * Calculate remaining days
   */
  calculateRemainingDays() {
    if (!this.expiresAt) return;

    const now = new Date();
    const diff = this.expiresAt.getTime() - now.getTime();
    this.remainingDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Format expiration date
   */
  formatExpirationDate(): string {
    if (!this.expiresAt) return '';

    return this.expiresAt.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Get badge color based on remaining days
   */
  getBadgeColor(): string {
    if (this.remainingDays <= 3) return 'danger';
    if (this.remainingDays <= 7) return 'warning';
    return 'success';
  }

  /**
   * Abre el sitio de pago en el navegador del sistema
   */
  goToCatalog() {
    this.paymentRedirect.openProviderPremium('/tabs/profile');
  }

  /**
   * Navigate to transactions
   */
  goToTransactions() {
    this.router.navigate(['/transactions']);
  }
}

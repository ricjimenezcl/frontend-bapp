import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ProductService, Transaction } from '../../services/product.service';

/**
 * Service Slots Component
 * Shows available service slots for service providers
 */
@Component({
  selector: 'app-service-slots',
  templateUrl: './service-slots.component.html',
  styleUrls: ['./service-slots.component.scss']
})
export class ServiceSlotsComponent implements OnInit {

  @Input() providerId?: number;
  @Input() compactMode: boolean = false;

  totalSlots = 2; // Free slots
  usedSlots = 0;
  availableSlots = 2;
  paidSlots = 0;
  paidSlotsExpiring?: Date;
  loading = true;

  constructor(
    private productService: ProductService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadSlotInfo();
  }

  /**
   * Load slot information from transactions
   */
  async loadSlotInfo() {
    this.loading = true;

    try {
      const transactions = await this.productService.getUserTransactions().toPromise() || [];
      
      // Find active service slot purchases
      const slotTransactions = this.findActiveSlotTransactions(transactions);

      if (slotTransactions.length > 0) {
        this.calculateSlots(slotTransactions);
      }

      // TODO: Get used slots from backend API
      // For now, we assume 0 used slots
      this.usedSlots = 0;
      this.availableSlots = this.totalSlots - this.usedSlots;

    } catch (error) {
      console.error('Error loading slot info:', error);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Find active slot transactions
   */
  findActiveSlotTransactions(transactions: Transaction[]): Transaction[] {
    const now = new Date();

    return transactions.filter(t => 
      t.status === 'completed' &&
      t.product?.sku === 'SERVICE_PUBLICATION' &&
      t.expires_at &&
      new Date(t.expires_at) > now
    );
  }

  /**
   * Calculate total slots from transactions
   */
  calculateSlots(transactions: Transaction[]) {
    // Each service publication purchase adds 1 slot for 30 days
    this.paidSlots = transactions.length;
    this.totalSlots = 2 + this.paidSlots; // 2 free + paid

    // Find earliest expiration
    const expirations = transactions
      .map(t => new Date(t.expires_at!))
      .sort((a, b) => a.getTime() - b.getTime());

    if (expirations.length > 0) {
      this.paidSlotsExpiring = expirations[0];
    }
  }

  /**
   * Get slot usage percentage
   */
  getSlotUsagePercentage(): number {
    if (this.totalSlots === 0) return 0;
    return (this.usedSlots / this.totalSlots) * 100;
  }

  /**
   * Get progress bar color
   */
  getProgressColor(): string {
    const percentage = this.getSlotUsagePercentage();
    if (percentage >= 100) return 'danger';
    if (percentage >= 80) return 'warning';
    return 'success';
  }

  /**
   * Check if slots are full
   */
  isSlotsFullOrNearlyFull(): boolean {
    return this.availableSlots <= 1;
  }

  /**
   * Format expiration date
   */
  formatExpirationDate(): string {
    if (!this.paidSlotsExpiring) return '';

    return this.paidSlotsExpiring.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Get remaining days for paid slots
   */
  getRemainingDays(): number {
    if (!this.paidSlotsExpiring) return 0;

    const now = new Date();
    const diff = this.paidSlotsExpiring.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Navigate to product catalog
   */
  goToCatalog() {
    this.router.navigate(['/product-catalog']);
  }

  /**
   * Navigate to transactions
   */
  goToTransactions() {
    this.router.navigate(['/transactions']);
  }
}

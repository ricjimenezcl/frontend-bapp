import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { ProductService, Transaction } from '../../services/product.service';

@Component({
  selector: 'app-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.scss'],
})
export class TransactionsPage implements OnInit {

  transactions: Transaction[] = [];
  loading = true;
  filterStatus: string = 'all';
  
  stats = {
    total: 0,
    completed: 0,
    pending: 0,
    failed: 0
  };

  constructor(
    private productService: ProductService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.loadTransactions();
  }

  /**
   * Load user transactions
   */
  async loadTransactions() {
    this.loading = true;

    try {
      this.transactions = await this.productService.getUserTransactions().toPromise() || [];
      this.calculateStats();
    } catch (error) {
      console.error('Error loading transactions:', error);
      this.showToast('Error al cargar transacciones', 'danger');
    } finally {
      this.loading = false;
    }
  }

  /**
   * Calculate transaction statistics
   */
  calculateStats() {
    this.stats.total = this.transactions.length;
    this.stats.completed = this.transactions.filter(t => t.status === 'completed').length;
    this.stats.pending = this.transactions.filter(t => t.status === 'pending').length;
    this.stats.failed = this.transactions.filter(t => t.status === 'failed').length;
  }

  /**
   * Get filtered transactions
   */
  getFilteredTransactions(): Transaction[] {
    if (this.filterStatus === 'all') {
      return this.transactions;
    }
    return this.transactions.filter(t => t.status === this.filterStatus);
  }

  /**
   * Format transaction status
   */
  getStatusLabel(status: string): string {
    const labels: any = {
      'completed': 'Completada',
      'pending': 'Pendiente',
      'failed': 'Fallida',
      'refunded': 'Reembolsada',
      'expired': 'Expirada'
    };
    return labels[status] || status;
  }

  /**
   * Get status color
   */
  getStatusColor(status: string): string {
    const colors: any = {
      'completed': 'success',
      'pending': 'warning',
      'failed': 'danger',
      'refunded': 'medium',
      'expired': 'medium'
    };
    return colors[status] || 'medium';
  }

  /**
   * Get status icon
   */
  getStatusIcon(status: string): string {
    const icons: any = {
      'completed': 'checkmark-circle',
      'pending': 'time',
      'failed': 'close-circle',
      'refunded': 'arrow-undo-circle',
      'expired': 'hourglass'
    };
    return icons[status] || 'information-circle';
  }

  /**
   * Format amount
   */
  formatAmount(transaction: Transaction): string {
    const amount = transaction.amount.toLocaleString('es-CL');
    return `$${amount} ${transaction.currency}`;
  }

  /**
   * Format date
   */
  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Check if transaction is active
   */
  isActive(transaction: Transaction): boolean {
    if (!transaction.expires_at || transaction.status !== 'completed') {
      return false;
    }
    return new Date(transaction.expires_at) > new Date();
  }

  /**
   * Get remaining days
   */
  getRemainingDays(expiresAt: string): number {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Refresh transactions
   */
  async handleRefresh(event: any) {
    await this.loadTransactions();
    event.target.complete();
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
   * Go to product catalog
   */
  goToCatalog() {
    this.router.navigate(['/product-catalog']);
  }
}

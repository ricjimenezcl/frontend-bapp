import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../../features/auth/services/auth.service';
import { StateService, SelectedService } from '../../../../shared/services/state.service';
import { BookingService, BookingStats } from '../../../../core/services/booking.service';
import { NotificationStateService } from '../../../../core/services/notification-state.service';
import { ProductService, Transaction } from '../../../../services/product.service';
import { PaymentRedirectService } from '../../../../services/payment-redirect.service';
import { PlatformDetectionService } from '../../../../services/platform-detection.service';
import { parseUtcDate } from '../../../../shared/utils/date.util';
import { AccessAuthModalComponent } from '../../../../shared/components/access-auth-modal/access-auth-modal.component';
import { ProviderActionSheetComponent } from '../../../../shared/components/provider-action-sheet/provider-action-sheet.component';
import { environment } from '../../../../../environments/environment';

interface QuickAccessItem {
  label: string;
  icon: string;
  route: string[];
}

@Component({
  selector: 'app-client-home',
  templateUrl: './client-home.page.html',
  styleUrls: ['./client-home.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class ClientHomePage implements OnInit, OnDestroy {
  userName = '';
  selectedServices: SelectedService[] = [];
  stats: BookingStats | null = null;
  isLoadingStats = false;
  isGuestMode = false;

  // Actividad de búsqueda (mismo dato que el dashboard web: /users/me/search-stats)
  searchesToday = 0;
  searchesDailyLimit: number | null = null;
  isLoadingSearchStats = false;

  // Mensajes sin leer (misma fuente que el badge de notificaciones)
  unreadMessages = 0;

  // Plan contratado (misma información que el dashboard web: transacción activa de /transactions/me)
  activePlan: Transaction | null = null;
  isLoadingPlan = false;
  /** Apple Guideline 3.1.1 — oculta el flujo de compra en iOS */
  canPurchase = true;

  get quickAccess(): QuickAccessItem[] {
    if (this.isGuestMode) {
      return [
        { label: 'Crear cuenta', icon: 'person-add-outline', route: ['/client/categories'] },
        { label: 'Contactar proveedores', icon: 'chatbubbles-outline', route: ['/client/categories'] },
        { label: 'Explorar servicios', icon: 'search-outline', route: ['/client/categories'] }
      ];
    }

    return [
      { label: 'Mis Reservas', icon: 'calendar-outline', route: ['/client/tabs/bookings'] },
      { label: 'Mensajes', icon: 'chatbubbles-outline', route: ['/client/tabs/chats'] },
      { label: 'Mi Perfil', icon: 'person-outline', route: ['/client/tabs/profile'] }
    ];
  }

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private authService: AuthService,
    private stateService: StateService,
    private bookingService: BookingService,
    private notificationStateService: NotificationStateService,
    private productService: ProductService,
    private paymentRedirect: PaymentRedirectService,
    private platformDetection: PlatformDetectionService,
    private http: HttpClient,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    const currentUser = this.authService.getCurrentUser();
    this.userName = currentUser?.name?.split(' ')[0] || '';
    this.canPurchase = this.platformDetection.canPurchaseInApp();
    this.isGuestMode = !this.authService.isAuthenticated() && localStorage.getItem('bapp_user_role') === 'client';

    if (this.isGuestMode) {
      this.stats = null;
      this.activePlan = null;
      this.searchesToday = 0;
      this.searchesDailyLimit = null;
      this.isLoadingStats = false;
      this.isLoadingPlan = false;
      return;
    }

    this.stateService.selectedServices$
      .pipe(takeUntil(this.destroy$))
      .subscribe(services => { this.selectedServices = services; });

    this.notificationStateService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => { this.unreadMessages = count; });

    this.loadStats();
    this.loadSearchStats();
    this.loadActivePlan();
  }

  get bookingsUpcomingCount(): number {
    if (!this.stats) return 0;
    return (this.stats.pending ?? 0) + (this.stats.confirmed ?? 0) + (this.stats.in_progress ?? 0);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadStats() {
    this.isLoadingStats = true;
    this.bookingService.getClientStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.stats = stats;
          this.isLoadingStats = false;
        },
        error: () => {
          this.isLoadingStats = false;
        }
      });
  }

  private loadSearchStats() {
    this.isLoadingSearchStats = true;
    this.http
      .get<{ searches_today: number; daily_limit: number | null }>(`${environment.apiUrl}/users/me/search-stats`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.searchesToday = res?.searches_today ?? 0;
          this.searchesDailyLimit = res?.daily_limit ?? null;
          this.isLoadingSearchStats = false;
        },
        error: () => {
          this.isLoadingSearchStats = false;
        }
      });
  }

  /** Plan activo (última transacción completed vigente) — mismo patrón que client-profile.page.ts (sin filtrar por sku) */
  private loadActivePlan() {
    this.isLoadingPlan = true;
    this.productService.getUserTransactions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (transactions) => {
          const now = Date.now();
          this.activePlan = (transactions ?? [])
            .filter(t => t.status === 'completed' && !!t.expires_at && new Date(t.expires_at!).getTime() > now)
            .sort((a, b) => new Date(b.expires_at!).getTime() - new Date(a.expires_at!).getTime())[0] ?? null;
          this.isLoadingPlan = false;
        },
        error: () => {
          this.activePlan = null;
          this.isLoadingPlan = false;
        }
      });
  }

  /** Días restantes hasta el vencimiento del plan activo */
  remainingDays(expiresAt: string): number {
    const expires = parseUtcDate(expiresAt);
    if (!expires) return 0;
    return Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86_400_000));
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  goToCategories() {
    this.router.navigate(['/client/categories']);
  }

  async openClientRegisterModal() {
    await this.openAccessAuthModal('register', 'client');
  }

  async openAccessAuthModal(mode: 'login' | 'register' = 'register', role: 'client' | 'provider' = 'client') {
    const modal = await this.modalCtrl.create({
      component: AccessAuthModalComponent,
      backdropDismiss: true,
      cssClass: 'access-auth-modal'
    });

    const instance = (modal as any).componentInstance as AccessAuthModalComponent | undefined;
    if (instance) {
      instance.configure({
        mode,
        role,
        appleSignInAvailable: false
      });
      instance.open(mode, role);
    }

    await modal.present();
  }

  handleQuickAccess(item: QuickAccessItem) {
    if (this.isGuestMode && (item.label === 'Crear cuenta' || item.label === 'Contactar proveedores')) {
      this.openClientRegisterModal();
      return;
    }

    this.goTo(item.route);
  }

  goTo(route: string[]) {
    if (this.isGuestMode && (route[0] === '/client/tabs/chats' || route[0] === '/client/tabs/bookings' || route[0] === '/client/tabs/profile' || route[0] === '/auth/login')) {
      this.openClientRegisterModal();
      return;
    }

    this.router.navigate(route);
  }

  goToCatalog() {
    // Evita reabrir el flujo de compra si ya hay un plan activo (el backend
    // igualmente lo bloquearía con 409, pero así no se le ofrece la opción).
    if (this.activePlan) return;
    this.paymentRedirect.openClientUnlock('/client/tabs/home');
  }

  goToCatalog30() {
    if (this.activePlan) return;
    this.paymentRedirect.openClientUnlock30('/client/tabs/home');
  }
}

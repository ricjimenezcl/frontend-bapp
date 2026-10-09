import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule, AlertController, ToastController, NavController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../../features/auth/services/auth.service';
import { ClientService } from '../../services/client.service';
import { DEFAULT_AVATAR_URL } from '../../../../core/constants/default-avatar';
import { MonetizationComponentsModule } from '../../../../components/monetization-components.module';
import { PaymentRedirectService } from '../../../../services/payment-redirect.service';
import { PlatformDetectionService } from '../../../../services/platform-detection.service';
import { ProductService, Transaction } from '../../../../services/product.service';
import { parseUtcDate } from '../../../../shared/utils/date.util';

@Component({
  selector: 'app-client-profile',
  templateUrl: './client-profile.page.html',
  styleUrls: ['./client-profile.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, MonetizationComponentsModule]
})
export class ClientProfilePage implements OnInit, OnDestroy {
  /**
   * Caché en memoria del plan activo (por usuario). La página se destruye al
   * cambiar de tab, así que sin esto se mostraba "Cuenta Gratuita" hasta que
   * respondía el backend.
   */
  private static planCache: { userId: string; plan: Transaction | null } | null = null;

  private readonly destroy$ = new Subject<void>();
  fullName = '';
  phone = '';
  email = '';
  bio = '';
  avatarPreview = DEFAULT_AVATAR_URL;
  avatar: string | null = null;

  /** true cuando ya hay nombre/avatar para pintar (caché o backend) */
  profileReady = false;
  /** true cuando ya se conoce el estado del plan (caché o backend) */
  planReady = false;

  user: {
    id: number;
    email: string;
    full_name: string;
    phone: string;
    avatar: string;
    role: string;
  } | null = null;

  profile: any = null;
  isLoading = false;
  /** Apple Guideline 3.1.1 — oculta el flujo de compra en iOS */
  canPurchase = true;

  /** Plan activo (última transacción completed con expires_at vigente) */
  activePlan: Transaction | null = null;

  constructor(
    private router: Router,
    private navCtrl: NavController,
    private authService: AuthService,
    private clientService: ClientService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private paymentRedirect: PaymentRedirectService,
    private platformDetection: PlatformDetectionService,
    private productService: ProductService
  ) {}

  ngOnInit() {
    this.canPurchase = this.platformDetection.canPurchaseInApp();
    // Pintar de inmediato lo que ya se conoce (sin esperar al backend)
    this.applyCachedProfile();
    this.applyCachedPlan();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refreshProfile() {
    this.loadUserData();
  }

  ionViewWillEnter() {
    // Refresco en segundo plano: los datos de caché ya están en pantalla
    this.loadUserData();
    this.loadActivePlan();
  }

  /** Siembra nombre/email/teléfono/avatar desde la sesión local (síncrono). */
  private applyCachedProfile() {
    const user: any = this.authService.getCurrentUser();
    const cached: any = this.authService.getUserProfile();
    const name = cached?.full_name || user?.full_name;

    this.email = cached?.email || user?.email || '';
    if (!name) return;

    this.fullName = name;
    this.phone = cached?.phone || user?.phone || '';
    this.bio = cached?.bio || '';
    this.avatar = cached?.avatar || user?.avatar || null;
    this.profileReady = true;
  }

  /** Siembra el plan activo desde la caché en memoria si sigue vigente. */
  private applyCachedPlan() {
    const cache = ClientProfilePage.planCache;
    if (!cache || cache.userId !== this.currentUserKey()) return;

    const plan = cache.plan;
    const stillValid = !plan || (parseUtcDate(plan.expires_at ?? '')?.getTime() ?? 0) > Date.now();
    if (!stillValid) return;

    this.activePlan = plan;
    this.planReady = true;
  }

  private currentUserKey(): string {
    return String(this.authService.getCurrentUser()?.id ?? '');
  }

  private loadActivePlan() {
    this.productService.getUserTransactions().subscribe({
      next: (transactions) => {
        const now = Date.now();
        this.activePlan = transactions.find(t =>
          t.status === 'completed' && !!t.expires_at && (parseUtcDate(t.expires_at)?.getTime() ?? 0) > now
        ) ?? null;
        ClientProfilePage.planCache = { userId: this.currentUserKey(), plan: this.activePlan };
        this.planReady = true;
      },
      error: () => {
        // Si hay caché se conserva; si no, se asume cuenta gratuita
        this.planReady = true;
      }
    });
  }

  /** Días restantes hasta el vencimiento del plan activo */
  remainingDays(expiresAt: string): number {
    const expires = parseUtcDate(expiresAt);
    if (!expires) return 0;
    return Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86_400_000));
  }

  /** Carga datos frescos y completos (incluyendo bio) y actualiza la caché local. */
  private loadUserData() {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    this.isLoading = true;
    this.clientService.getMyProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.isLoading = false;
          this.fullName = data.full_name || (currentUser as any)?.full_name || '';
          this.phone = data.phone || (currentUser as any)?.phone || '';
          this.email = data.email || currentUser.email || '';
          this.bio = data.bio || '';
          this.avatar = data.avatar || (currentUser as any)?.avatar || DEFAULT_AVATAR_URL;
          this.profileReady = true;

          this.user = {
            id: data.user_id,
            email: data.email,
            full_name: data.full_name,
            phone: data.phone || '',
            avatar: data.avatar || DEFAULT_AVATAR_URL,
            role: currentUser.role || 'client'
          };
          // Actualizar caché con datos frescos (incluyendo bio)
          const existing = this.authService.getUserProfile();
          this.authService.setUserProfile({
            ...existing,
            full_name: data.full_name,
            phone: data.phone || '',
            avatar: data.avatar || undefined,
            bio: data.bio || ''
          });
        },
        error: () => {
          this.isLoading = false;
          // Sin red: se mantiene la caché y se evita dejar el avatar en blanco
          this.avatar = this.avatar || DEFAULT_AVATAR_URL;
          this.profileReady = true;
        }
      });
  }

  async goLogout() {
    const alert = await this.alertCtrl.create({
      header: 'Cerrar Sesión',
      message: '¿Estás seguro de que deseas cerrar sesión?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Sí, salir',
          handler: () => {
            this.authService.logout();
            this.navCtrl.navigateRoot(['/auth/login']);
          }
        }
      ]
    });
    await alert.present();
  }

  goToEditProfile() {
    this.router.navigate(['/client/edit-profile']);
  }

  goToBookings() {
    this.router.navigate(['/client/tabs/bookings']);
  }

  /**
   * Eliminación de cuenta in-app (Apple Guideline 5.1.1(v)).
   */
  async confirmDeleteAccount() {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar cuenta',
      message: 'Esta acción es permanente: se eliminarán tu perfil y tus datos de BAPP. ¿Deseas continuar?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar mi cuenta',
          role: 'destructive',
          handler: () => this.executeDeleteAccount()
        }
      ]
    });
    await alert.present();
  }

  private executeDeleteAccount() {
    this.authService.deleteAccount().subscribe({
      next: async () => {
        this.authService.logout();
        await this.navCtrl.navigateRoot(['/auth/login']);
      },
      error: async () => {
        await this.presentToast('No se pudo eliminar la cuenta. Intenta nuevamente.', 'danger');
      }
    });
  }

  goToSettings() {
    this.router.navigate(['/client/settings']);
  }

  goToTransactions() {
    this.router.navigate(['/transactions']);
  }

  goToTerms() {
    this.router.navigate(['/terms']);
  }

  goToCatalog() {
    // Evita reabrir el flujo de compra si ya hay un plan activo (el backend
    // igualmente lo bloquearía con 409, pero así no se le ofrece la opción).
    if (this.activePlan) return;
    this.paymentRedirect.openClientUnlock('/client/tabs/profile');
  }

  goToCatalog30() {
    if (this.activePlan) return;
    this.paymentRedirect.openClientUnlock30('/client/tabs/profile');
  }

  async inviteFriends() {
    const user = this.authService.getCurrentUser();
    const inviteUrl = `https://bapp.app/invite/${user?.id ?? ''}`;
    const shareData = {
      title: 'Únete a BAPP',
      text: 'Descarga BAPP y encuentra los mejores servicios cerca de ti.',
      url: inviteUrl
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try { await navigator.share(shareData); } catch { /* cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        await this.presentToast('Enlace copiado al portapapeles');
      } catch {
        await this.presentToast('No se pudo copiar el enlace', 'danger');
      }
    }
  }

  private async presentToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'top'
    });
    await toast.present();
  }
}

import { Component,  OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, AlertController, ModalController, ActionSheetController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { ProviderService, ProviderStats } from '../../services/provider.service';
import { ProviderProfile } from '../../../../core/models/provider.model';
import { WebSocketService } from '../../../../core/services/websocket.service';
import { AuthService } from '../../../../features/auth/services/auth.service';
import { NotificationType } from '../../../../core/models/chat.model';
import { DocumentUploadService } from '../../../../shared/services/document-upload.service';
import { ServiceViewersModalComponent } from '../../modals/service-viewers-modal/service-viewers-modal.component';
import { ReviewService } from '../../../../core/services/review.service';
import { Review } from '../../../../core/models/review.model';
import { ProductService, Transaction } from '../../../../services/product.service';
import { PaymentRedirectService } from '../../../../services/payment-redirect.service';
import { PlatformDetectionService } from '../../../../services/platform-detection.service';
import { parseUtcDate } from '../../../../shared/utils/date.util';

@Component({
  selector: 'app-provider-home',
  templateUrl: './provider-home.page.html',
  styleUrls: ['./provider-home.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class ProviderHomePage implements OnInit, OnDestroy {
  isLoading = false;
  providerName = 'Provider';
  providerProfile: ProviderProfile | null = null;
  validationStatus: string = 'not_submitted';
  showVerificationAlert = false;
  verificationMessage = '';
  isProfileIncomplete = false;
  missingFields: string[] = [];
  stats: ProviderStats | null = null;
  reviews: Review[] = [];
  reviewsLoading = false;
  showReviewsModal = false;

  // Plan contratado (misma información que provider-profile: transacción activa de /transactions/me)
  activePlan: Transaction | null = null;
  isLoadingPlan = false;
  /** Apple Guideline 3.1.1 — oculta el flujo de compra en iOS */
  canPurchase = true;

  metrics = {
    profileViews: 0,
    serviceViews: 0,
    zoneSearches: 0,
    activeServices: 0,
    pendingServices: 0,
  };

  private readonly destroy$ = new Subject<void>();

  constructor(
    public router: Router,
    private readonly providerService: ProviderService,
    private readonly wsService: WebSocketService,
    private readonly toastCtrl: ToastController,
    private readonly alertCtrl: AlertController,
    private readonly documentService: DocumentUploadService,
    private readonly modalCtrl: ModalController,
    private readonly actionSheetCtrl: ActionSheetController,
    private readonly reviewService: ReviewService,
    private readonly authService: AuthService,
    private readonly productService: ProductService,
    private readonly paymentRedirect: PaymentRedirectService,
    private readonly platformDetection: PlatformDetectionService
  ) { }

  ngOnInit() {
    console.log('ProviderHomePage cargado');
    this.canPurchase = this.platformDetection.canPurchaseInApp();
    this.loadProviderProfile();
    this.subscribeToReviewReceived();
    this.checkVerificationStatus();
    this.loadActivePlan();
  }

  private subscribeToReviewReceived() {
    this.wsService.getNotifications$()
      .pipe(
        filter((n: any) => n.notificationType === NotificationType.REVIEW_RECEIVED),
        takeUntil(this.destroy$)
      )
      .subscribe(async (notification: any) => {
        const content = notification.content || 'Nueva reseña recibida';
        const toast = await this.toastCtrl.create({
          message: `⭐ ${content}`,
          duration: 4000,
          position: 'top',
          color: 'warning',
        });
        await toast.present();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar perfil del proveedor autenticado
   */
  private loadProviderProfile() {
    this.isLoading = true;
    
    this.providerService.getMyProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profile: ProviderProfile) => {
          console.log('✅ Perfil del proveedor cargado:', profile);
          this.providerProfile = profile;
          this.providerName = profile.full_name || 'Provider';
          this.isLoading = false;
          
          // Verificar si el perfil está incompleto (RUT o Teléfono)
          this.checkProfileCompletion(profile);
          
          // Cargar métricas reales después de obtener el perfil
          this.loadProviderMetrics(profile.id.toString());
          // Cargar reseñas del proveedor
          this.loadReviews(profile.id);
        },
        error: (error) => {
          console.error('❌ Error cargando perfil del proveedor:', error);
          this.isLoading = false;
          
          // Si el perfil no se encuentra (404), es probable que el usuario
          // esté logueado accidentalmente como client o falte su registro de provider
          if (error.status === 404 || error.status === 401) {
            this.handleMissingProfile();
          }
        }
      });
  }

  /**
   * Manejar caso de perfil faltante o error de autorización
   */
  private async handleMissingProfile() {
    const alert = await this.alertCtrl.create({
      header: 'No se encontró tu perfil',
      message: 'Parece que tu cuenta no está registrada como proveedor o tu sesión ha expirado.',
      buttons: [
        {
          text: 'Completar Registro',
          handler: () => {
            this.router.navigate(['/auth/register-provider']);
          }
        },
        {
          text: 'Ir a Inicio',
          handler: () => {
            this.authService.logout();
            this.router.navigate(['/auth/login']);
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Verificar si el perfil tiene los datos mínimos para operar
   */
  private checkProfileCompletion(profile: ProviderProfile) {
    this.missingFields = [];
    if (!profile.run) this.missingFields.push('RUN');
    if (!profile.phone) this.missingFields.push('Teléfono');
    
    this.isProfileIncomplete = this.missingFields.length > 0;
  }

  /**
   * Ir a completar perfil
   */
  goToCompleteProfile() {
    this.router.navigate(['/provider/account-info']);
  }

  /**
   * Cargar métricas del proveedor
   */
  private loadProviderMetrics(providerId: string) {
    this.providerService.getProviderStats(providerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats: ProviderStats) => {
          console.log('✅ Métricas del proveedor cargadas:', stats);
          this.stats = stats; // Guardar stats completas
          this.metrics = {
            profileViews:    stats.profile_views    ?? 0,
            serviceViews:    stats.service_views    ?? 0,
            zoneSearches:    stats.zone_searches    ?? 0,
            activeServices:  stats.active_services  ?? stats.total_services ?? 0,
            pendingServices: stats.pending_services ?? 0,
          };
        },
        error: (error) => {
          console.warn('⚠️ Error cargando métricas del proveedor:', error);
          this.metrics = {
            profileViews: 0,
            serviceViews: 0,
            zoneSearches: 0,
            activeServices: 0,
            pendingServices: 0,
          };
        }
      });
  }

  /**
   * Cargar reseñas recibidas por el proveedor
   */
  private loadReviews(providerId: number) {
    this.reviewsLoading = true;
    this.reviewService.getProviderReviews(providerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (reviews) => {
          this.reviews = reviews;
          this.reviewsLoading = false;
        },
        error: (err) => {
          console.warn('⚠️ Error cargando reseñas:', err);
          this.reviewsLoading = false;
        }
      });
  }

  /** Abrir panel de reseñas */
  openReviews() {
    this.showReviewsModal = true;
  }

  /** Cerrar panel de reseñas */
  closeReviews() {
    this.showReviewsModal = false;
  }

  /** Genera un arreglo de N enteros para usar en *ngFor de estrellas */
  starArray(n: number): number[] {
    return Array(Math.min(Math.max(Math.round(n), 0), 5)).fill(0);
  }

  /**
   * Obtener el saludo dinámico según la hora
   */
  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  /**
   * Obtener emoji basado en la hora
   */
  getGreetingEmoji(): string {
    const hour = new Date().getHours();
    if (hour < 12) return '👋';
    if (hour < 18) return '😊';
    return '🌙';
  }

  /**
   * Verificar estado de verificación del proveedor
   */
  private checkVerificationStatus() {
    this.documentService.getVerificationStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (verification: any) => {
          console.log('✅ Estado de verificación:', verification);
          
          if (verification && verification.face_match_status) {
            this.validationStatus = verification.face_match_status === 'APPROVED' ? 'approved' : verification.face_match_status?.toLowerCase();
          }
          
          // Si no hay verificación o no está aprobada, mostrar banner
          if (!verification || verification.face_match_status !== 'APPROVED') {
            this.showVerificationBanner(verification);
          }
        },
        error: (error) => {
          console.warn('⚠️ Error al verificar estado de verificación:', error);
          
          // Si el error es 403, significa que no tiene registro de provider
          if (error.status === 403) {
            return;
          }
          
          // Si no hay verificación, mostrar banner
          this.showVerificationBanner(null);
        }
      });
  }

  /**
   * Mostrar banner de verificación pendiente (sin alert modal)
   */
  private showVerificationBanner(verification: any) {
    let message = 'Para poder agregar servicios, debes completar la verificación de identidad.';
    
    if (!verification) {
      message = 'Para poder agregar servicios, debes completar la verificación de identidad.';
      this.validationStatus = 'not_submitted';
    } else if (verification.face_match_status === 'PENDING') {
      message = 'Tu verificación está pendiente de procesamiento.';
      this.validationStatus = 'pending';
    } else if (verification.face_match_status === 'PROCESSING') {
      message = 'Tu verificación está siendo procesada por nuestro sistema.';
      this.validationStatus = 'processing';
    } else if (verification.face_match_status === 'REJECTED') {
      message = 'Tu verificación fue rechazada. Por favor, intenta nuevamente con fotos más claras.';
      this.validationStatus = 'rejected';
    }

    this.verificationMessage = message;
    this.showVerificationAlert = true;
  }

  /**
   * Ir a verificación de identidad
   */
  goToVerifyIdentity() {
    this.router.navigate(['/auth/verify-identity']);
  }

  /**
   * Cerrar banner de verificación
   */
  dismissVerificationAlert() {
    this.showVerificationAlert = false;
  }

  /**
   * Abrir modal de clientes interesados
   */
  async openServiceViewers() {
    const modal = await this.modalCtrl.create({
      component: ServiceViewersModalComponent,
      cssClass: 'service-viewers-modal',
      breakpoints: [0, 0.5, 0.8, 1],
      initialBreakpoint: 0.8
    });

    await modal.present();
  }

  /** Plan activo (última transacción completed vigente) — mismo patrón que provider-profile.page.ts */
  private loadActivePlan() {
    this.isLoadingPlan = true;
    this.productService.getUserTransactions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (transactions) => {
          const now = Date.now();
          this.activePlan = (transactions ?? [])
            .filter(t => t.status === 'completed' && !!t.expires_at && (parseUtcDate(t.expires_at)?.getTime() ?? 0) > now)
            .sort((a, b) => (parseUtcDate(b.expires_at)?.getTime() ?? 0) - (parseUtcDate(a.expires_at)?.getTime() ?? 0))[0] ?? null;
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

  goToCatalog() {
    // Evita reabrir el flujo de compra si ya hay un plan activo (el backend
    // igualmente lo bloquearía con 409, pero así no se le ofrece la opción).
    if (this.activePlan) return;
    void this.presentPlanOptions();
  }

  /** Selector de las 3 modalidades de plan proveedor (7 días / mensual / anual) */
  private async presentPlanOptions() {
    const sheet = await this.actionSheetCtrl.create({
      header: 'Elige tu plan',
      buttons: [
        {
          text: '7 días',
          handler: () => this.paymentRedirect.openProviderPlan7Days('/provider/tabs/home')
        },
        {
          text: 'Mensual',
          handler: () => this.paymentRedirect.openProviderPlanMonthly('/provider/tabs/home')
        },
        {
          text: 'Anual',
          handler: () => this.paymentRedirect.openProviderPlanAnnual('/provider/tabs/home')
        },
        {
          text: 'Cancelar',
          role: 'cancel'
        }
      ]
    });
    await sheet.present();
  }
}
   

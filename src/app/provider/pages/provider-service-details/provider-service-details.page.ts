import { Component,  OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { IonButton, IonContent, IonToggle, IonIcon, AlertController, LoadingController, ModalController, ToastController, NavController } from '@ionic/angular/standalone';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { ProviderService, ProviderServices } from '../../services/provider.service';
import { AuthService } from '../../../auth/services/auth.service';
import { CoreService } from '../../../shared/services/core.service';
import { ProviderAddServicePage } from '../provider-add-service/provider-add-service.page';
import { DocumentUploadService } from '../../../shared/services/document-upload.service';
import { PaymentRedirectService } from '../../../services/payment-redirect.service';
import { environment } from '../../../../environments/environment';

type ServiceLimitProductType = 'PROVIDER_SERVICE_30' | 'PROVIDER_PREMIUM_MONTHLY' | 'PROVIDER_PREMIUM_ANNUAL';

interface ServiceLimitResult {
  canCreate: boolean;
  suggestedProductType: ServiceLimitProductType;
  message: string;
}

@Component({
  selector: 'app-provider-service-details',
  templateUrl: './provider-service-details.page.html',
  styleUrls: ['./provider-service-details.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IonContent, IonButton, IonToggle, IonIcon
  ]
})
export class ProviderServiceDetailsPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly authService = inject(AuthService);
  private readonly providerService = inject(ProviderService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly alertCtrl = inject(AlertController);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly navCtrl = inject(NavController);
  private readonly coreService = inject(CoreService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly http = inject(HttpClient);
  private readonly documentService = inject(DocumentUploadService);
  private readonly paymentRedirect = inject(PaymentRedirectService);

  currentUser: any;
  servicios: ProviderServices[] = [];
  isLoading: boolean = true;
  error: string = '';
  private pendingOpenModal = false;

  ngOnInit() {
    // Datos estáticos de sesión: se cargan una sola vez en la vida del componente
    this.loadUserData();
    // CSS-based tabs — ionViewWillEnter nunca se dispara en este contexto
    this.loadServicios();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ionViewWillEnter() {
    // Detectar retorno desde product-catalog después de pago exitoso
    const action = this.route.snapshot.queryParamMap.get('action');
    if (action === 'add-service') {
      this.pendingOpenModal = true;
      // Limpiar el query param de la URL sin navegar
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
    this.loadServicios();
  }

  private loadUserData() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.presentAlert('Error', 'Usuario no autenticado');
      this.router.navigate(['/auth/login']);
    }
  }

  loadServicios() {
    if (!this.currentUser) return;
    this.isLoading = true;
    this.error = '';
    this.providerService.getMyProfile().pipe(
      switchMap(profile => this.providerService.getProviderServices(profile.id.toString())),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (services) => {
        this.servicios = services || [];
        this.isLoading = false;
        // Si venimos de pago exitoso, abrir modal directamente (omitir pre-chequeo de límite)
        if (this.pendingOpenModal) {
          this.pendingOpenModal = false;
          this.verificarYAbrirModal();
        }
      },
      error: (error: any) => {
        console.error('Error al cargar servicios:', error);
        this.isLoading = false;
        this.servicios = [];
        this.error = 'Error al cargar servicios. Por favor, intenta nuevamente.';
        this.pendingOpenModal = false;
      }
    });
  }

  getEstadoServicio(servicio: ProviderServices): string {
    if (servicio.validation_status === 'rejected') return 'Rechazado';
    if (servicio.is_available) return 'Activo';
    return 'Deshabilitado';
  }

  getEstadoColor(servicio: ProviderServices): string {
    if (servicio.validation_status === 'rejected') return 'danger';
    if (servicio.is_available) return 'success';
    return 'medium';
  }

  getServiceIcon(servicio: ProviderServices): string {
    return servicio.service_category?.icon || 'construct';
  }

  truncateText(text: string, maxLength: number): string {
    if (text && text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text || '';
  }

  async toggleDisponibilidad(servicio: ProviderServices, event: any) {
    // Leer la intención del usuario directamente del evento (más fiable que calcular estado)
    const wantsEnabled: boolean = !!event?.detail?.checked;

    if (wantsEnabled) {
      // ── El usuario quiere HABILITAR ───────────────────────────────────────
      await this.ejecutarHabilitar(servicio);
    } else {
      // ── El usuario quiere DESHABILITAR ────────────────────────────────────
      const confirmed = await this.mostrarConfirmacionDeshabilitar();
      if (!confirmed) {
        // Forzar re-evaluación del [checked] para revertir el toggle visualmente
        this.cdr.detectChanges();
        return;
      }
      await this.ejecutarDeshabilitar(servicio);
    }
  }

  private mostrarConfirmacionDeshabilitar(): Promise<boolean> {
    return new Promise((resolve) => {
      this.alertCtrl.create({
        header: 'Deshabilitar servicio',
        message: 'Si deshabilitas este servicio, dejará de aparecer en las búsquedas de los clientes. ¿Deseas continuar?',
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          { text: 'Confirmar', role: 'confirm' }
        ]
      }).then(alert => {
        alert.present();
        alert.onDidDismiss().then(({ role }) => {
          resolve(role === 'confirm');
        });
      });
    });
  }

  /** Reemplaza el objeto en this.servicios por referencia nueva para forzar re-render */
  private actualizarServicioEnLista(id: number, changes: Partial<ProviderServices>) {
    const idx = this.servicios.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.servicios[idx] = { ...this.servicios[idx], ...changes };
    }
    this.cdr.detectChanges();
  }

  private async ejecutarDeshabilitar(servicio: ProviderServices) {
    this.actualizarServicioEnLista(servicio.id, { is_available: false });
    this.presentToast('Servicio deshabilitado', 'warning');
    try {
      await firstValueFrom(
        this.providerService.toggleServiceAvailability(servicio.id, false)
      );
    } catch (error) {
      this.actualizarServicioEnLista(servicio.id, { is_available: true });
      console.error('Error al deshabilitar servicio:', error);
      this.presentToast('Error al deshabilitar el servicio', 'danger');
    }
  }

  private async ejecutarHabilitar(servicio: ProviderServices) {
    this.actualizarServicioEnLista(servicio.id, { is_available: true });
    this.presentToast('Servicio habilitado exitosamente', 'success');
    try {
      await firstValueFrom(
        this.providerService.toggleServiceAvailability(servicio.id, true)
      );
    } catch (error: any) {
      this.actualizarServicioEnLista(servicio.id, { is_available: false });
      const httpStatus = error?.status;
      if (httpStatus === 402) {
        await this.mostrarOfertaPlan(servicio);
      } else {
        console.error('Error al habilitar servicio:', error);
        this.presentToast('Error al habilitar el servicio', 'danger');
      }
    }
  }

  private async mostrarOfertaPlan(_servicio: ProviderServices) {
    const alert = await this.alertCtrl.create({
      header: 'Plan requerido',
      message: 'Para habilitar más de 2 servicios debes activar un plan de publicación. Activa tu plan para mostrar este servicio en las búsquedas durante 30 días.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Activar plan', role: 'confirm' }
      ]
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'confirm') {
      this.paymentRedirect.openProviderServicePlan('/provider/tabs/service-details');
    }
  }

  goEditServicio(servicio: ProviderServices) {
    this.router.navigate(['/provider/edit-service', servicio.id], {
      queryParams: {
        providerId: servicio.provider_id,
        serviceId: servicio.id
      }
    });
  }

  async delServicio(servicio: ProviderServices) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar Servicio',
      message: `¿Estás seguro de eliminar "${servicio.business_name}"?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'custom-alert-dark'
        },
        {
          text: 'Eliminar',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Eliminando...'
            });
            await loading.present();

            try {
              await firstValueFrom(this.providerService.deleteProviderService(servicio.id));
              await loading.dismiss();

              this.servicios = this.servicios.filter(s => s.id !== servicio.id);
              this.presentToast('Servicio eliminado correctamente', 'success');
            } catch (error) {
              await loading.dismiss();
              console.error('Error al eliminar servicio:', error);
              this.presentToast('Error al eliminar servicio', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async openAddServiceModal() {
    const entitlement = await this.evaluateServiceCreationEntitlement();
    if (!entitlement.canCreate) {
      await this.mostrarOfertaPlanServicio(entitlement);
      return;
    }
    await this.verificarYAbrirModal();
  }

  private async verificarYAbrirModal() {
    const loading = await this.loadingCtrl.create({
      message: 'Verificando estado...',
      duration: 5000
    });
    await loading.present();

    this.documentService.getVerificationStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async (verification: any) => {
          await loading.dismiss();
          if (verification?.face_match_status !== 'APPROVED') {
            await this.showVerificationRequired(verification);
            return;
          }
          await this.loadCategoriesAndOpenModal();
        },
        error: async (error) => {
          await loading.dismiss();
          console.error('Error verificando estado:', error);
          await this.showVerificationRequired(null);
        }
      });
  }

  private async mostrarOfertaPlanServicio(result: ServiceLimitResult) {
    const alert = await this.alertCtrl.create({
      header: 'Plan requerido',
      message: result.message,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Activar plan', role: 'confirm' }
      ]
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'confirm') {
      const returnTo = this.router.url.split('?')[0];
      this.paymentRedirect.openPayment({
        productType: result.suggestedProductType,
        returnTo,
        action: 'add-service',
      });
    }
  }

  private async evaluateServiceCreationEntitlement(): Promise<ServiceLimitResult> {
    const activeServices = this.servicios.filter(s => s.is_available).length;
    const transactions = await this.getMyTransactions();
    const now = Date.now();

    const activeTypes = (transactions ?? [])
      .filter((tx: any) => this.isActiveTransaction(tx, now))
      .map((tx: any) => this.readProductType(tx));

    const hasPremium = activeTypes.some((pt: string) =>
      pt.includes('PROVIDER_PREMIUM_MONTHLY') ||
      pt.includes('PROVIDER_PREMIUM_ANNUAL') ||
      (pt.includes('PROVIDER_PREMIUM') && (pt.includes('YEAR') || pt.includes('ANNUAL')))
    );

    const hasBasePlan = activeTypes.some((pt: string) =>
      pt.includes('PROVIDER_SERVICE_30') || pt.includes('PROVIDER_SERVICE_YEAR') || pt.includes('PROVIDER_SERVICE_ANNUAL')
    );

    const maxServices = hasPremium ? 7 : hasBasePlan ? 3 : 2;
    if (activeServices < maxServices) {
      return { canCreate: true, suggestedProductType: 'PROVIDER_SERVICE_30', message: '' };
    }

    if (!hasBasePlan && activeServices >= 2) {
      return {
        canCreate: false,
        suggestedProductType: 'PROVIDER_SERVICE_30',
        message: 'Ya alcanzaste los 2 servicios gratuitos. Activa un plan mensual o anual para crear tu tercer servicio.',
      };
    }

    if (!hasPremium && activeServices >= 3) {
      return {
        canCreate: false,
        suggestedProductType: 'PROVIDER_PREMIUM_ANNUAL',
        message: 'Tu plan actual permite hasta 3 servicios. Activa Premium mensual o anual para llegar hasta 7 servicios activos.',
      };
    }

    return {
      canCreate: false,
      suggestedProductType: 'PROVIDER_PREMIUM_ANNUAL',
      message: 'Ya alcanzaste el máximo de 7 servicios activos para planes Premium.',
    };
  }

  private async getMyTransactions(): Promise<any[]> {
    try {
      return await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/transactions/me`));
    } catch {
      return [];
    }
  }

  private isActiveTransaction(tx: any, nowMs: number): boolean {
    const status = String(tx?.status ?? '').toLowerCase();
    if (!(status === 'completed' || status === 'authorized')) return false;
    if (!tx?.expires_at) return true;
    const exp = new Date(tx.expires_at).getTime();
    return Number.isFinite(exp) && exp > nowMs;
  }

  private readProductType(tx: any): string {
    return String(tx?.product_type ?? tx?.product?.sku ?? tx?.product?.product_type ?? tx?.sku ?? '').toUpperCase();
  }

  private async loadCategoriesAndOpenModal() {
    const loading = await this.loadingCtrl.create({
      message: 'Cargando categorías...',
      duration: 5000
    });
    await loading.present();

    this.coreService.getMainCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async (categories) => {
          await loading.dismiss();
          await this.presentAddServiceModal(categories);
        },
        error: async (error) => {
          await loading.dismiss();
          console.error('Error loading categories:', error);
          this.presentToast('Error al cargar categorías', 'danger');
        }
      });
  }

  private async showVerificationRequired(verification: any) {
    let message = 'Para poder agregar servicios, debes completar la verificación de identidad. ';
    
    if (!verification) {
      message += 'Por favor, ve a la sección de Verificación de Identidad y sube tu selfie y documento de identidad.';
    } else if (verification.face_match_status === 'PENDING') {
      message += 'Tu verificación está pendiente de procesamiento. Te notificaremos cuando esté lista.';
    } else if (verification.face_match_status === 'PROCESSING') {
      message += 'Tu verificación está siendo procesada por nuestro sistema. Esto puede tomar unos minutos.';
    } else if (verification.face_match_status === 'REJECTED') {
      message += 'Tu verificación fue rechazada. Por favor, intenta nuevamente con fotos más claras.';
    } else if (verification.face_match_status === 'EXPIRED') {
      message += 'Tu verificación ha expirado. Por favor, realiza el proceso nuevamente.';
    }

    const alert = await this.alertCtrl.create({
      header: '📋 Verificación Requerida',
      message: message,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Ir a Verificación',
          handler: () => {
            this.router.navigate(['/auth/verify-identity']);
          }
        }
      ]
    });

    await alert.present();
  }

  async presentAddServiceModal(mainCategories: any[]) {
    const modal = await this.modalCtrl.create({
      component: ProviderAddServicePage,
      cssClass: 'fullscreen-modal',
      componentProps: {
        mainCategories: mainCategories || [],
        coreService: this.coreService,
        authService: this.authService,
        currentUser: this.currentUser
      },
      showBackdrop: true,
      backdropDismiss: true,
      mode: 'ios'
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.role === 'confirm' || result.data?.success) {
        await this.presentToast('Servicio agregado correctamente', 'success');
        this.loadServicios();
      } else if (result.role === 'cancel') {
        this.presentToast('Operación cancelada', 'warning');
      }
    });

    await modal.present();
  }

  async presentAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning' | 'primary' = 'primary') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }

  trackById(_index: number, servicio: ProviderServices): number {
    return servicio.id;
  }

  /**
   * Verifica si el proveedor necesita plan extra (tiene 2+ servicios)
   */
  needsExtraServicePlan(): boolean {
    return this.servicios.length >= 2;
  }

  /**
   * Obtiene la etiqueta del estado de validación
   */
  statusLabel(status: string): string {
    const map: Record<string, string> = {
      approved: 'Aprobado',
      pending: 'Pendiente',
      rejected: 'Rechazado',
    };
    return map[status] ?? status;
  }

  /**
   * Cuenta servicios por estado de validación
   */
  countByStatus(status: string): number {
    return this.servicios.filter(s => s.validation_status === status).length;
  }

  /**
   * Navega a la página de plan extra de servicios
   */
  goToExtraServicePlan(): void {
    this.paymentRedirect.openProviderServicePlan('/provider/tabs/service-details', 'add-service');
  }

  goBack() {
    this.navCtrl.back();
  }
}

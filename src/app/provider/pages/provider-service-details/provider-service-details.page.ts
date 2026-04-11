// src/app/provider/pages/provider-service-details/provider-service-details.page.ts
import { Component,  OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonCard, IonBadge, IonToggle, IonRow, IonCol, IonIcon, IonLabel, IonSpinner, IonBackButton, AlertController, LoadingController, ModalController, ToastController, NavController } from '@ionic/angular/standalone';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { ProviderService, ProviderServices } from '../../services/provider.service';
import { AuthService } from '../../../auth/services/auth.service';
import { CoreService } from '../../../shared/services/core.service';
import { ProviderAddServicePage } from '../provider-add-service/provider-add-service.page';
import { DocumentUploadService } from '../../../shared/services/document-upload.service';

@Component({
  selector: 'app-provider-service-details',
  templateUrl: './provider-service-details.page.html',
  styleUrls: ['./provider-service-details.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonContent, IonCard, IonBadge, IonToggle, IonRow, IonCol,
    IonIcon, IonLabel, IonSpinner, IonBackButton
  ]
})
export class ProviderServiceDetailsPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private providerService = inject(ProviderService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private alertCtrl = inject(AlertController);
  private loadingCtrl = inject(LoadingController);
  private navCtrl = inject(NavController);
  private coreService = inject(CoreService);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private documentService = inject(DocumentUploadService);

  currentUser: any;
  servicios: ProviderServices[] = [];
  isLoading: boolean = true;
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
        this.pendingOpenModal = false;
        this.presentAlert('Error', 'No se pudieron cargar los servicios');
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

    if (!wantsEnabled) {
      // ── El usuario quiere DESHABILITAR ────────────────────────────────────
      const confirmed = await this.mostrarConfirmacionDeshabilitar();
      if (!confirmed) {
        // Forzar re-evaluación del [checked] para revertir el toggle visualmente
        this.cdr.detectChanges();
        return;
      }
      await this.ejecutarDeshabilitar(servicio);
    } else {
      // ── El usuario quiere HABILITAR ───────────────────────────────────────
      await this.ejecutarHabilitar(servicio);
    }
  }

  private mostrarConfirmacionDeshabilitar(): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: 'Deshabilitar servicio',
        message: 'Si deshabilitas este servicio, dejará de aparecer en las búsquedas de los clientes. ¿Deseas continuar?',
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          { text: 'Confirmar', role: 'confirm' }
        ]
      });
      await alert.present();
      const { role } = await alert.onDidDismiss();
      resolve(role === 'confirm');
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
      this.router.navigate(['/product-catalog']);
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
              await this.providerService.deleteProviderService(servicio.id).toPromise();
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
    // Pre-chequeo de límite usando datos ya cargados (sin HTTP extra)
    const activeCount = this.servicios.filter(s => s.is_available).length;
    if (activeCount >= 2) {
      await this.mostrarOfertaPlanServicio();
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
          if (!verification || verification.face_match_status !== 'APPROVED') {
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

  private async mostrarOfertaPlanServicio() {
    const alert = await this.alertCtrl.create({
      header: 'Plan requerido',
      message: 'Ya tienes 2 servicios activos. Para agregar más servicios debes activar un plan de publicación.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Activar plan', role: 'confirm' }
      ]
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'confirm') {
      const returnTo = this.router.url.split('?')[0];
      this.router.navigate(['/product-catalog'], {
        queryParams: { returnTo, action: 'add-service' }
      });
    }
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

  goBack() {
    this.navCtrl.back();
  }
}

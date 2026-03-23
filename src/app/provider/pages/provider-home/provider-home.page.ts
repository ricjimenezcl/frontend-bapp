import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { ProviderService, ProviderStats } from '../../services/provider.service';
import { ProviderProfile } from '../../../core/models/provider.model';
import { WebSocketService } from '../../../core/services/websocket.service';
import { NotificationType } from '../../../core/models/chat.model';
import { DocumentUploadService } from '../../../shared/services/document-upload.service';

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

  metrics = {
    profileViews: 0,
    serviceViews: 0,
    zoneSearches: 0,
    activeServices: 0,
    pendingServices: 0,
  };

  private destroy$ = new Subject<void>();

  constructor(
    public router: Router,
    private providerService: ProviderService,
    private wsService: WebSocketService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private documentService: DocumentUploadService
  ) { }

  ngOnInit() {
    console.log('ProviderHomePage cargado');
    this.loadProviderProfile();
    this.subscribeToReviewReceived();
    this.checkVerificationStatus();
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
          
          // Cargar métricas reales después de obtener el perfil
          this.loadProviderMetrics(profile.id.toString());
        },
        error: (error) => {
          console.error('❌ Error cargando perfil del proveedor:', error);
          this.isLoading = false;
          // Mantener el valor por defecto
        }
      });
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
   * Obtener el saludo dinámico según la hora
   */
  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 18) return 'Afternoon';
    return 'Evening';
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
          
          // Si no hay verificación o no está aprobada, mostrar alerta
          if (!verification || verification.face_match_status !== 'APPROVED') {
            this.showVerificationWarning(verification);
          }
        },
        error: (error) => {
          console.warn('⚠️ Error al verificar estado de verificación:', error);
          
          // Si el error es 403, significa que no tiene registro de provider (ya manejado)
          if (error.status === 403) {
            return;
          }
          
          // Si no hay verificación, mostrar alerta
          this.showVerificationWarning(null);
        }
      });
  }

  /**
   * Mostrar alerta de verificación pendiente
   */
  private async showVerificationWarning(verification: any) {
    let message = 'Para poder agregar servicios, debes completar la verificación de identidad. ';
    
    if (!verification) {
      message += 'Por favor, ve a la sección de Verificación de Identidad y sube tu selfie y documento de identidad.';
    } else if (verification.face_match_status === 'PENDING') {
      message += 'Tu verificación está pendiente de procesamiento.';
    } else if (verification.face_match_status === 'PROCESSING') {
      message += 'Tu verificación está siendo procesada por nuestro sistema.';
    } else if (verification.face_match_status === 'REJECTED') {
      message += 'Tu verificación fue rechazada. Por favor, intenta nuevamente con fotos más claras.';
    }

    const alert = await this.alertCtrl.create({
      header: '📋 Verificación de Identidad Requerida',
      message: message,
      buttons: [
        {
          text: 'Más tarde',
          role: 'cancel'
        },
        {
          text: 'Verificar ahora',
          handler: () => {
            this.router.navigate(['/auth/verify-identity']);
          }
        }
      ]
    });

    await alert.present();
  }
}
   

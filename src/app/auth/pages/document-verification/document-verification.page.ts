import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonProgressBar,
  IonSpinner,
  LoadingController,
  ToastController,
} from '@ionic/angular/standalone';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { DocumentUploadService } from '../../../shared/services/document-upload.service';
import { FeedbackService } from '../../../shared/services/feedback.service';
import { AuthService } from '../../services/auth.service';
import { addIcons } from 'ionicons';
import { camera, checkmarkCircle, closeCircle, document } from 'ionicons/icons';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface VerificationState {
  selfieUrl: string | null;
  idDocumentUrl: string | null;
  selfieDocumentId: number | null;
  idDocumentId: number | null;
  uploading: boolean;
  uploadProgress: number;
  verificationInitiated: boolean;
  verificationStatus: 'IDLE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSING';
  step: 'UPLOAD' | 'VERIFY' | 'WAITING' | 'APPROVED' | 'REJECTED';
  confidenceScore: number | null;
  retryCount: number;
  maxRetries: number;
  
  // Face preview
  selfieFacePreview: string | null;
  idFacePreview: string | null;
  loadingPreview: boolean;
  facePreviewError: string | null;
}

@Component({
  selector: 'app-document-verification',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonProgressBar,
    IonSpinner,
  ],
  templateUrl: './document-verification.page.html',
  styleUrls: ['./document-verification.page.scss'],
})
export class DocumentVerificationPage implements OnInit, OnDestroy {
  state: VerificationState = {
    selfieUrl: null,
    idDocumentUrl: null,
    selfieDocumentId: null,
    idDocumentId: null,
    uploading: false,
    uploadProgress: 0,
    verificationInitiated: false,
    verificationStatus: 'IDLE',
    step: 'UPLOAD',
    confidenceScore: null,
    retryCount: 0,
    maxRetries: 3,
    selfieFacePreview: null,
    idFacePreview: null,
    loadingPreview: false,
    facePreviewError: null,
  };

  private readonly destroy$ = new Subject<void>();
  private statusCheckTimeout: any;

  constructor(
    private readonly uploadService: DocumentUploadService,
    private readonly router: Router,
    private readonly feedback: FeedbackService,
    private readonly toastController: ToastController,
    private readonly authService: AuthService
  ) {
    addIcons({ camera, checkmarkCircle, closeCircle, document });
  }

  ngOnInit(): void {
    this.subscribeToUploadProgress();
    this.checkVerificationStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.statusCheckTimeout) {
      clearTimeout(this.statusCheckTimeout);
    }
  }

  /**
   * Capturar selfie (cámara frontal)
   */
  async captureSelfie(): Promise<void> {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        direction: CameraDirection.Front,
      });

      if (image.webPath) {
        this.state.selfieUrl = image.webPath;
      }
    } catch (error) {
      console.error('Selfie capture failed:', error);
      await this.showToast('Error al capturar selfie');
    }
  }

  /**
   * Seleccionar documento de identidad
   */
  async selectIdDocument(): Promise<void> {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
      });

      if (image.webPath) {
        this.state.idDocumentUrl = image.webPath;
      }
    } catch (error) {
      console.error('ID document selection failed:', error);
      await this.showToast('Error al seleccionar documento');
    }
  }

  /**
   * Subir selfie a Cloudinary
   */
  async uploadSelfie(): Promise<void> {
    if (!this.state.selfieUrl) {
      this.feedback.showToast('Por favor captura una selfie');
      return;
    }

    try {
      this.state.uploading = true;
      const file = await this.fileUrlToFile(
        this.state.selfieUrl,
        'selfie.jpg'
      );
      
      // Validate image before upload
      const validation = await (this.uploadService as any).validateImage(file);
      if (!validation.valid) {
        this.feedback.showToast(`❌ ${validation.error}`);
        return;
      }

      if (validation.warnings && validation.warnings.length > 0) {
        validation.warnings.forEach((warning: string) => {
          console.warn('[UPLOAD] Warning:', warning);
        });
      }
      
      const result = await firstValueFrom(this.uploadService.uploadDocument(file, 'SELFIE'));
      this.state.selfieDocumentId = result.id;
      
      this.feedback.showToast('✅ Selfie subida correctamente');
    } catch (error) {
      console.error('Selfie upload failed:', error);
      this.feedback.showToast(`❌ Error al subir selfie: ${error}`);
    } finally {
      this.state.uploading = false;
      this.state.uploadProgress = 0;
    }
  }

  /**
   * Subir documento de identidad a Cloudinary
   */
  async uploadIdDocument(): Promise<void> {
    if (!this.state.idDocumentUrl) {
      this.feedback.showToast('Por favor selecciona tu documento');
      return;
    }

    try {
      this.state.uploading = true;
      const file = await this.fileUrlToFile(
        this.state.idDocumentUrl,
        'id_document.jpg'
      );
      
      // Validate image before upload
      const validation = await (this.uploadService as any).validateImage(file);
      if (!validation.valid) {
        this.feedback.showToast(`❌ ${validation.error}`);
        return;
      }

      if (validation.warnings && validation.warnings.length > 0) {
        validation.warnings.forEach((warning: string) => {
          console.warn('[UPLOAD] Warning:', warning);
        });
      }
      
      const result = await firstValueFrom(this.uploadService.uploadDocument(
        file,
        'IDENTITY_DOCUMENT'
      ));
      this.state.idDocumentId = result.id;
      
      this.feedback.showToast('✅ Documento subido correctamente');
      
      // Si ambos documentos están listos, cargar el preview de los rostros
      if (this.state.selfieDocumentId && this.state.idDocumentId) {
        await this.loadFacePreview();
      }
    } catch (error) {
      console.error('ID document upload failed:', error);
      this.feedback.showToast(`❌ Error al subir documento: ${error}`);
    } finally {
      this.state.uploading = false;
      this.state.uploadProgress = 0;
    }
  }

  /**
   * Cargar preview de los rostros cropped
   */
  async loadFacePreview(): Promise<void> {
    if (!this.state.selfieDocumentId || !this.state.idDocumentId) {
      return;
    }

    try {
      this.state.loadingPreview = true;
      this.state.facePreviewError = null;

      const result = await firstValueFrom(this.uploadService.getFacePreview(
        this.state.selfieDocumentId,
        this.state.idDocumentId
      ));

      if (result) {
        this.state.selfieFacePreview = result.selfie_preview;
        this.state.idFacePreview = result.id_preview;

        // Check if faces were detected successfully
        const facesDetected = result.success && 
          this.state.selfieFacePreview && 
          this.state.idFacePreview;
        
        if (facesDetected) {
          this.feedback.showToast('✅ Preview de rostros cargado');
        } else {
          // No mostrar error si es problema de configuración de AWS
          const errorMsg = result.error || 'No se pudieron detectar rostros';
          const isAwsConfigError = [
            'AWS_ACCESS_KEY_ID',
            'UnrecognizedClientException',
            'security token',
            'InvalidClientTokenId',
            'ExpiredTokenException',
          ].some(token => errorMsg.includes(token));
          if (!isAwsConfigError) {
            this.state.facePreviewError = errorMsg;
          }
          console.warn('Face preview no disponible:', errorMsg);
        }
      }
    } catch (error: any) {
      console.warn('Failed to load face preview:', error);
      // No mostrar error visual si es problema de AWS, solo en consola
      const errorMessage = error?.error?.detail || error?.message || 'Error';
      const isAwsConfigError = [
        'AWS_ACCESS_KEY_ID',
        'UnrecognizedClientException',
        'security token',
        'InvalidClientTokenId',
        'ExpiredTokenException',
      ].some(token => errorMessage.includes(token));
      if (!isAwsConfigError) {
        this.state.facePreviewError = `Error: ${errorMessage}`;
      }
    } finally {
      this.state.loadingPreview = false;
    }
  }

  /**
   * Iniciar verificación de rostro
   */
  async initiateVerification(): Promise<void> {
    if (!this.state.selfieDocumentId || !this.state.idDocumentId) {
      this.feedback.showToast('Debe subir selfie y documento de identidad');
      return;
    }

    this.feedback.showLoading('Iniciando verificación facial...');
    try {
      const result = await firstValueFrom(this.uploadService
        .initiateVerification(
          this.state.selfieDocumentId,
          this.state.idDocumentId
        ));
      
      this.state.verificationInitiated = true;
      
      // Actualizar estado basado en la respuesta del backend
      if (result && result.face_match_status) {
        this.state.verificationStatus = result.face_match_status;
        
        if (result.face_match_status === 'APPROVED') {
          this.state.step = 'APPROVED';
          this.state.confidenceScore = parseFloat(result.face_match_score || '0');
          this.feedback.showToast('✅ Verificación exitosa. Puedes continuar al panel de proveedor.');
        } else if (result.face_match_status === 'REJECTED') {
          this.state.step = 'REJECTED';
          this.state.confidenceScore = parseFloat(result.face_match_score || '0');
          this.feedback.showToast('❌ Verificación rechazada. Las caras no coinciden.');
        } else if (result.face_match_status === 'PROCESSING') {
          this.state.step = 'WAITING';
          this.state.verificationStatus = 'PROCESSING';
          this.feedback.showToast('⏳ Procesando verificación...');
          this.scheduleStatusCheck();
        } else {
          // PENDING u otro estado
          this.state.step = 'WAITING';
          this.feedback.showToast('⏳ Verificación en proceso...');
          this.scheduleStatusCheck();
        }
      }
    } catch (error) {
      console.error('Verification initiation failed:', error);
      this.feedback.showToast('Error al iniciar verificación. Intenta nuevamente.');
      this.state.step = 'UPLOAD';
    } finally {
      this.feedback.hideLoading();
    }
  }

  /**
   * Programar chequeo único de estado después de 5 segundos
   * No usa polling infinito, solo una verificación
   */
  private scheduleStatusCheck(): void {
    // Cancelar cualquier timeout anterior
    if (this.statusCheckTimeout) {
      clearTimeout(this.statusCheckTimeout);
    }

    // Esperar 5 segundos (tiempo suficiente para que DeepFace procese)
    this.statusCheckTimeout = setTimeout(() => {
      this.checkVerificationStatus();
    }, 5000);
  }

  /**
   * Reintentar con delay exponencial si sigue PENDING
   */
  private retryWithExponentialBackoff(): void {
    if (this.state.retryCount < this.state.maxRetries) {
      this.state.retryCount++;
      const delayMs = 2000 * Math.pow(2, this.state.retryCount - 1); // 2s, 4s, 8s
      
      this.statusCheckTimeout = setTimeout(() => {
        this.checkVerificationStatus();
      }, delayMs);
    } else {
      // Máximo de reintentos alcanzado
      this.state.verificationStatus = 'REJECTED';
      this.state.step = 'REJECTED';
      this.showToast('❌ No se pudo completar la verificación. Intenta nuevamente.');
    }
  }

  /**
   * Verificar estado actual de la verificación
   */
  private checkVerificationStatus(): void {
    this.uploadService
      .getVerificationStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          if (!status) {
            this.state.verificationStatus = 'IDLE';
            return;
          }

          this.state.verificationStatus = status.face_match_status;
          
          // Extraer confidence score si existe
          if (status.face_match_score) {
            this.state.confidenceScore = Number.parseFloat(status.face_match_score);
          }

          if (status.face_match_status === 'APPROVED') {
            this.state.step = 'APPROVED';
            if (this.statusCheckTimeout) {
              clearTimeout(this.statusCheckTimeout);
            }
            const scoreText = this.state.confidenceScore 
              ? `Confianza: ${this.state.confidenceScore.toFixed(1)}% - ` 
              : '';
            this.showToast(`✅ ${scoreText}¡Verificación Aprobada!`);
          } else if (status.face_match_status === 'REJECTED') {
            this.state.step = 'REJECTED';
            if (this.statusCheckTimeout) {
              clearTimeout(this.statusCheckTimeout);
            }
            const scoreText = this.state.confidenceScore 
              ? `Confianza: ${this.state.confidenceScore.toFixed(1)}% - ` 
              : '';
            this.showToast(`❌ ${scoreText}Verificación Rechazada`);
          } else if (status.face_match_status === 'PENDING') {
            // Si sigue PENDING, reintentar con backoff
            this.retryWithExponentialBackoff();
          }
        },
        error: (error) => {
          console.error('Status check failed:', error);
          // En caso de error de red, reintentar
          this.retryWithExponentialBackoff();
        },
      });
  }

  /**
   * Convertir URL a File para upload
   */
  private async fileUrlToFile(
    url: string,
    filename: string
  ): Promise<File> {
    const response = await fetch(url);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  }

  /**
   * Continuar a siguiente paso (solo cuando APPROVED)
   * Actualiza el status del usuario a ACTIVE antes de navegar para evitar
   * que el providerVerificationGuard bloquee la navegación
   */
  continueToDashboard(): void {
    try {
      // Obtener el usuario actual
      const currentUser = this.authService.getCurrentUser();
      
      if (!currentUser) {
        console.error('No hay usuario autenticado');
        this.showToast('Error: Usuario no encontrado');
        return;
      }

      // Actualizar el status del usuario a ACTIVE si la verificación fue aprobada
      if (this.state.verificationStatus === 'APPROVED') {
        console.log('✅ Verificación aprobada, actualizando status del usuario a ACTIVE');
        
        // Actualizar usuario con status ACTIVE y verified true
        const updatedUser = {
          ...currentUser,
          status: 'ACTIVE',
          verified: true
        };
        
        // Guardar el usuario actualizado
        this.authService.setUser(updatedUser, currentUser.token || currentUser.access_token);
        
        // Actualizar también en user_data de localStorage
        localStorage.setItem('user_data', JSON.stringify(updatedUser));
        
        console.log('✅ Usuario actualizado con status ACTIVE:', updatedUser);
        
        // Navegar al dashboard del proveedor con replaceUrl para evitar volver atrás
        this.router.navigate(['/provider/tabs'], { replaceUrl: true });
      } else {
        // Si no está aprobado, mostrar mensaje y no permitir continuar
        console.warn('⚠️ Verificación no aprobada, status:', this.state.verificationStatus);
        this.showToast('Debes completar la verificación primero');
      }
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      this.showToast('Error al procesar la verificación');
    }
  }

  /**
   * Reintentar verificación
   */
  async retryVerification(): Promise<void> {
    this.state = {
      ...this.state,
      selfieUrl: null,
      idDocumentUrl: null,
      selfieDocumentId: null,
      idDocumentId: null,
      uploading: false,
      uploadProgress: 0,
      verificationInitiated: false,
      verificationStatus: 'IDLE',
      step: 'UPLOAD',
      confidenceScore: null,
      retryCount: 0,
    };
    await this.showToast('Puedes intentar nuevamente');
  }

  /**
   * Obtener color de estado
   */
  getStatusColor(): string {
    switch (this.state.verificationStatus) {
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'danger';
      case 'PENDING':
      case 'PROCESSING':
        return 'warning';
      default:
        return 'medium';
    }
  }

  /**
   * Obtener mensaje de estado
   */
  getStatusMessage(): string {
    const messages = {
      IDLE: 'Por favor completa la verificación',
      PENDING: '⏳ Esperando revisión del administrador',
      PROCESSING: '⏳ Analizando documentos...',
      APPROVED: '✅ ¡Verificación Aprobada!',
      REJECTED: '❌ Verificación Rechazada - Intenta de nuevo',
    };
    return messages[this.state.verificationStatus];
  }

  /**
   * Suscribirse a progreso de upload
   */
  private subscribeToUploadProgress(): void {
    this.uploadService.uploadProgress$
      .pipe(takeUntil(this.destroy$))
      .subscribe((progress) => {
        this.state.uploadProgress = progress.percentage;
      });
  }

  /**
   * Mostrar toast
   */
  private async showToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
    });
    await toast.present();
  }

  /**
   * Validaciones
   */
  get bothDocumentsUploaded(): boolean {
    return this.state.selfieDocumentId !== null && this.state.idDocumentId !== null;
  }

  get canInitiateVerification(): boolean {
    return (
      this.bothDocumentsUploaded &&
      !this.state.uploading &&
      !this.state.verificationInitiated
    );
  }

  get isApproved(): boolean {
    return this.state.verificationStatus === 'APPROVED';
  }

  get isRejected(): boolean {
    return this.state.verificationStatus === 'REJECTED';
  }

  get isWaiting(): boolean {
    return (
      this.state.verificationInitiated &&
      ['PENDING', 'PROCESSING'].includes(this.state.verificationStatus)
    );
  }
}

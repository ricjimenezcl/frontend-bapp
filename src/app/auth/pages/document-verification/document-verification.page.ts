import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
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
  ToastController,
} from '@ionic/angular/standalone';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { DocumentUploadService } from '../../../shared/services/document-upload.service';
import { FeedbackService } from '../../../shared/services/feedback.service';
import { AuthService } from '../../services/auth.service';
import { SelfieCaptureComponent } from '../../../shared/components/selfie-capture/selfie-capture.component';
import { addIcons } from 'ionicons';
import { camera, checkmarkCircle, closeCircle, document, cloudUpload, image, alertCircle, arrowForward, refresh, shieldCheckmarkOutline, cameraOutline, cloudUploadOutline, documentOutline, imageOutline, alertCircleOutline, checkmarkCircleOutline, arrowForwardOutline, refreshOutline } from 'ionicons/icons';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface VerificationState {
  selfieUrl: string | null;
  idDocumentFrontUrl: string | null;
  idDocumentBackUrl: string | null;
  selfieDocumentId: number | null;
  idDocumentFrontId: number | null;
  idDocumentBackId: number | null;
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
  // Detección de problemas específicos
  faceDetectionFailed: boolean;   // true cuando no se detectó rostro (bloquea verificación)
  rejectionReason: string | null; // razón descriptiva de rechazo del backend
  idCardValidationError: string | null;
  idCardValidated: boolean;
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
    SelfieCaptureComponent,
  ],
  templateUrl: './document-verification.page.html',
  styleUrls: ['./document-verification.page.scss'],
})
export class DocumentVerificationPage implements OnInit, OnDestroy {
  @ViewChild(SelfieCaptureComponent) selfieCaptureModal!: SelfieCaptureComponent;

  state: VerificationState = {
    selfieUrl: null,
    idDocumentFrontUrl: null,
    idDocumentBackUrl: null,
    selfieDocumentId: null,
    idDocumentFrontId: null,
    idDocumentBackId: null,
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
    faceDetectionFailed: false,
    rejectionReason: null,
    idCardValidationError: null,
    idCardValidated: false,
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
    addIcons({shieldCheckmarkOutline,cameraOutline,checkmarkCircle,cloudUploadOutline,documentOutline,imageOutline,alertCircleOutline,checkmarkCircleOutline,arrowForwardOutline,closeCircle,refreshOutline,camera,cloudUpload,document,image,alertCircle,arrowForward,refresh});
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
   * Capturar selfie con liveness detection
   */
  async captureSelfie(): Promise<void> {
    try {
      const hasCameraPermission = await this.ensurePermission('camera');
      if (!hasCameraPermission) {
        await this.showToast('Debes permitir el acceso a la cámara para validar tu identidad');
        return;
      }

      await this.selfieCaptureModal.open();
    } catch (error) {
      console.error('Error abriendo modal de captura:', error);
      await this.showToast('Error al abrir la captura de selfie');
    }
  }

  /**
   * Handler cuando se captura la selfie exitosamente
   */
  onSelfieCaptured(dataUrl: string): void {
    this.state.selfieUrl = dataUrl;
    this.showToast('✅ Selfie capturada con verificación de liveness');
  }

  /**
   * Seleccionar documento de identidad
   */
  async selectIdDocument(side: 'front' | 'back'): Promise<void> {
    try {
      const hasPhotosPermission = await this.ensurePermission('photos');
      if (!hasPhotosPermission) {
        await this.showToast('Debes permitir acceso a tus fotos para seleccionar el documento');
        return;
      }

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
      });

      if (image.webPath) {
        if (side === 'front') {
          this.state.idDocumentFrontUrl = image.webPath;
          this.state.idDocumentFrontId = null;
        } else {
          this.state.idDocumentBackUrl = image.webPath;
          this.state.idDocumentBackId = null;
        }

        this.state.idCardValidated = false;
        this.state.idCardValidationError = null;
      }
    } catch (error) {
      console.error('ID document selection failed:', error);
      await this.showToast('Error al seleccionar documento');
    }
  }

  private async ensurePermission(kind: 'camera' | 'photos'): Promise<boolean> {
    try {
      const current = await Camera.checkPermissions();
      const currentState = kind === 'camera' ? current.camera : current.photos;

      if (this.isPermissionGranted(currentState)) {
        return true;
      }

      const requested = await Camera.requestPermissions({ permissions: [kind] });
      const requestedState = kind === 'camera' ? requested.camera : requested.photos;

      return this.isPermissionGranted(requestedState);
    } catch (error) {
      console.error(`Error solicitando permiso de ${kind}:`, error);
      return false;
    }
  }

  private isPermissionGranted(state?: string): boolean {
    return state === 'granted' || state === 'limited';
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
  async uploadIdDocument(side: 'front' | 'back'): Promise<void> {
    const docUrl = side === 'front' ? this.state.idDocumentFrontUrl : this.state.idDocumentBackUrl;

    if (!docUrl) {
      this.feedback.showToast(
        side === 'front'
          ? 'Por favor selecciona el frente del documento'
          : 'Por favor selecciona el reverso del documento'
      );
      return;
    }

    try {
      this.state.uploading = true;
      const file = await this.fileUrlToFile(
        docUrl,
        side === 'front' ? 'id_document_front.jpg' : 'id_document_back.jpg'
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
      if (side === 'front') {
        this.state.idDocumentFrontId = result.id;
      } else {
        this.state.idDocumentBackId = result.id;
      }

      this.feedback.showToast(
        side === 'front'
          ? '✅ Frente del documento subido correctamente'
          : '✅ Reverso del documento subido correctamente'
      );

      if (this.state.idDocumentFrontUrl && this.state.idDocumentBackUrl) {
        const [frontFile, backFile] = await Promise.all([
          this.fileUrlToFile(this.state.idDocumentFrontUrl, 'id_document_front.jpg'),
          this.fileUrlToFile(this.state.idDocumentBackUrl, 'id_document_back.jpg')
        ]);

        const idValidation = await this.uploadService.validateChileanIdPair(frontFile, backFile);
        if (!idValidation.valid) {
          this.state.idCardValidated = false;
          this.state.idCardValidationError = idValidation.error || 'No se pudo validar la cédula chilena.';
          this.feedback.showToast(`❌ ${this.state.idCardValidationError}`);
          return;
        }

        this.state.idCardValidated = true;
        this.state.idCardValidationError = null;
      }
      
      // Si ambos documentos están listos, cargar el preview de los rostros
      if (this.state.selfieDocumentId && this.state.idDocumentFrontId) {
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
    if (!this.state.selfieDocumentId || !this.state.idDocumentFrontId) {
      return;
    }

    try {
      this.state.loadingPreview = true;
      this.state.facePreviewError = null;
      this.state.faceDetectionFailed = false;

      const result = await firstValueFrom(this.uploadService.getFacePreview(
        this.state.selfieDocumentId,
        this.state.idDocumentFrontId
      ));

      if (result) {
        // Convert base64 strings to Data URLs for proper display
        this.state.selfieFacePreview = result.selfie_preview 
          ? `data:image/jpeg;base64,${result.selfie_preview}` 
          : null;
        this.state.idFacePreview = result.id_preview 
          ? `data:image/jpeg;base64,${result.id_preview}` 
          : null;

        // Check if faces were detected successfully
        const facesDetected = result.success && 
          this.state.selfieFacePreview && 
          this.state.idFacePreview;
        
        if (facesDetected) {
          this.feedback.showToast('✅ Rostros detectados correctamente');
        } else {
          const rawError = result.error || '';
          const isAwsConfigError = this.isAwsError(rawError);
          if (!isAwsConfigError) {
            this.state.facePreviewError = this.mapFacePreviewError(rawError, result);
            this.state.faceDetectionFailed = true;
            this.feedback.showToast(`⚠️ ${this.state.facePreviewError}`);
          }
          console.warn('Face preview no disponible:', rawError);
        }
      }
    } catch (error: any) {
      console.warn('Failed to load face preview:', error);
      const errorMessage = error?.error?.detail || error?.message || 'Error';
      if (!this.isAwsError(errorMessage)) {
        this.state.facePreviewError = this.mapFacePreviewError(errorMessage, null);
        this.state.faceDetectionFailed = true;
      }
    } finally {
      this.state.loadingPreview = false;
    }
  }

  /**
   * Verifica si un mensaje de error corresponde a un problema de configuración AWS
   */
  private isAwsError(msg: string): boolean {
    return [
      'AWS_ACCESS_KEY_ID',
      'UnrecognizedClientException',
      'security token',
      'InvalidClientTokenId',
      'ExpiredTokenException',
    ].some(token => msg.includes(token));
  }

  /**
   * Mapea mensajes de error del backend a mensajes descriptivos en español
   */
  private mapFacePreviewError(msg: string, result: any): string {
    const lower = msg.toLowerCase();
    const noSelfie = !result?.selfie_preview;
    const noDoc = !result?.id_preview;

    if (noSelfie && noDoc) {
      return 'No se detectó un rostro ni en la selfie ni en el documento. Vuelve a capturarlos asegurándote de que el rostro sea visible y con buena iluminación.';
    }
    if (noSelfie || lower.includes('selfie') && (lower.includes('no face') || lower.includes('not detected'))) {
      return 'No se detectó un rostro en tu selfie. Vuelve a capturarla de frente, con buena iluminación y sin obstrucciones en la cara.';
    }
    if (noDoc || lower.includes('document') || lower.includes('id') && (lower.includes('no face') || lower.includes('not detected'))) {
      return 'No se detectó un rostro en el documento de identidad. Asegúrate de fotografiar tu cédula de identidad chilena mostrando claramente la foto.';
    }
    if (lower.includes('multiple') || lower.includes('more than one')) {
      return 'Se detectaron múltiples rostros. La selfie debe mostrar únicamente tu rostro.';
    }
    if (lower.includes('blurry') || lower.includes('blur') || lower.includes('quality')) {
      return 'La imagen es de baja calidad o está borrosa. Captura nuevamente con mejor iluminación.';
    }
    if (msg) {
      return `No se pudieron detectar los rostros: ${msg}`;
    }
    return 'No se pudieron detectar los rostros en las imágenes. Verifica que ambas muestren rostros con claridad.';
  }

  /**
   * Mapea la razón de rechazo del backend a un mensaje descriptivo en español
   */
  private mapRejectionReason(result: any): string {
    const reason = (result?.rejection_reason || result?.error || result?.detail || '').toLowerCase();
    const score = result?.face_match_score ? parseFloat(result.face_match_score) : null;

    if (reason.includes('no face') && reason.includes('selfie')) {
      return 'No se detectó un rostro en tu selfie.';
    }
    if (reason.includes('no face') && (reason.includes('document') || reason.includes('id'))) {
      return 'No se detectó un rostro en el documento de identidad. Asegúrate de usar tu cédula de identidad chilena.';
    }
    if (reason.includes('no face')) {
      return 'No se detectaron rostros en las imágenes proporcionadas.';
    }
    if (reason.includes('match') || reason.includes('differ') || reason.includes('not the same')) {
      const scoreText = score !== null ? ` (similitud: ${score.toFixed(1)}%)` : '';
      return `Los rostros de la selfie y el documento no corresponden a la misma persona${scoreText}.`;
    }
    if (reason.includes('quality') || reason.includes('blurry') || reason.includes('blur')) {
      return 'La calidad de las imágenes no es suficiente. Intenta con mejores condiciones de iluminación.';
    }
    if (reason.includes('expired') || reason.includes('vencid')) {
      return 'El documento de identidad parece estar vencido o no es válido.';
    }
    if (score !== null && score < 50) {
      return `Los rostros no coinciden (similitud: ${score.toFixed(1)}%). Asegúrate de que la selfie y el documento correspondan a la misma persona.`;
    }
    if (result?.face_match_status === 'REJECTED') {
      return 'La verificación fue rechazada. Asegúrate de usar una cédula de identidad chilena vigente y que tu selfie muestre tu rostro con claridad.';
    }
    return 'La verificación no pudo completarse. Verifica que hayas subido tu cédula de identidad chilena y una selfie clara.';
  }

  /**
   * Iniciar verificación de rostro
   */
  async initiateVerification(): Promise<void> {
    if (!this.state.selfieDocumentId || !this.state.idDocumentFrontId || !this.state.idDocumentBackId) {
      this.feedback.showToast('Debe subir selfie, frente y reverso del documento de identidad');
      return;
    }

    if (!this.state.idCardValidated) {
      this.feedback.showToast(this.state.idCardValidationError || 'La cédula no está validada. Revisa frente/reverso y RUN.');
      return;
    }

    this.feedback.showLoading('Iniciando verificación facial...');
    try {
      const result = await firstValueFrom(this.uploadService
        .initiateVerification(
          this.state.selfieDocumentId,
          this.state.idDocumentFrontId
        ));
      
      this.state.verificationInitiated = true;
      
      // Actualizar estado basado en la respuesta del backend
      if (result && result.face_match_status) {
        this.state.verificationStatus = result.face_match_status;
        
        if (result.face_match_status === 'APPROVED') {
          this.state.step = 'APPROVED';
          this.state.confidenceScore = parseFloat(result.face_match_score || '0');
          this.state.rejectionReason = null;
          this.feedback.showToast('✅ Verificación exitosa. Puedes continuar al panel de proveedor.');
        } else if (result.face_match_status === 'REJECTED') {
          this.state.step = 'REJECTED';
          this.state.confidenceScore = parseFloat(result.face_match_score || '0');
          this.state.rejectionReason = this.mapRejectionReason(result);
          this.feedback.showToast(`❌ ${this.state.rejectionReason}`);
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
            this.state.rejectionReason = this.mapRejectionReason(status);
            this.showToast(`❌ ${this.state.rejectionReason}`);
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

  closeVerification(): void {
    const currentUser = this.authService.getCurrentUser();

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    if (!currentUser) {
      this.router.navigate(['/auth/login'], { replaceUrl: true });
      return;
    }

    if (currentUser.role === 'CLIENT') {
      this.router.navigate(['/client/categories'], { replaceUrl: true });
      return;
    }

    if (currentUser.role === 'PROVIDER' && currentUser.status === 'ACTIVE') {
      this.router.navigate(['/provider/tabs'], { replaceUrl: true });
      return;
    }

    this.router.navigate(['/auth/login'], { replaceUrl: true });
  }

  /**
   * Reintentar verificación (limpia el estado para volver al paso de subida)
   */
  retryVerification(): void {
    this.state = {
      selfieUrl: null,
      idDocumentFrontUrl: null,
      idDocumentBackUrl: null,
      selfieDocumentId: null,
      idDocumentFrontId: null,
      idDocumentBackId: null,
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
      faceDetectionFailed: false,
      rejectionReason: null,
      idCardValidationError: null,
      idCardValidated: false,
    };
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
    return (
      this.state.selfieDocumentId !== null &&
      this.state.idDocumentFrontId !== null &&
      this.state.idDocumentBackId !== null
    );
  }

  get canInitiateVerification(): boolean {
    return (
      this.bothDocumentsUploaded &&
      !this.state.uploading &&
      !this.state.verificationInitiated &&
      !this.state.faceDetectionFailed &&
      this.state.idCardValidated
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

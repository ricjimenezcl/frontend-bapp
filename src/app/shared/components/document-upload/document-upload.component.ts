import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  IonLabel,
  IonSpinner,
  IonAlert,
  IonProgressBar,
  IonText,
  ToastController,
  LoadingController,
  AlertController,
} from '@ionic/angular/standalone';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { DocumentUploadService } from '../../services/document-upload.service';
import { FeedbackService } from '../../services/feedback.service';
import { addIcons } from 'ionicons';
import { camera, checkmarkCircle, closeCircle, document } from 'ionicons/icons';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface DocumentUploadState {
  selfieUrl: string | null;
  selfieFile: File | null;
  idDocumentUrl: string | null;
  idDocumentFile: File | null;
  selfieDocumentId: number | null;
  idDocumentId: number | null;
  uploading: boolean;
  uploadProgress: number;
  verificationStatus: string; // PENDING, APPROVED, REJECTED, PROCESSING
  verificationMessage: string;
}

@Component({
  selector: 'app-document-upload',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
    IonSpinner,
    IonProgressBar,
    IonText,
  ],
  templateUrl: './document-upload.component.html',
  styleUrls: ['./document-upload.component.scss'],
})
export class DocumentUploadComponent implements OnInit, OnDestroy {
  state: DocumentUploadState = {
    selfieUrl: null,
    selfieFile: null,
    idDocumentUrl: null,
    idDocumentFile: null,
    selfieDocumentId: null,
    idDocumentId: null,
    uploading: false,
    uploadProgress: 0,
    verificationStatus: 'PENDING',
    verificationMessage: '',
  };

  private destroy$ = new Subject<void>();

  constructor(
    private uploadService: DocumentUploadService,
    private feedback: FeedbackService,
    private alertController: AlertController
  ) {
    addIcons({ camera, checkmarkCircle, closeCircle, document });
  }

  ngOnInit(): void {
    this.loadVerificationStatus();
    this.subscribeToUploadProgress();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Capture or select selfie
   */
  async captureSelfie(): Promise<void> {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        direction: CameraDirection.Front, // Front camera for selfie
      });
      if (image.webPath) {
        this.state.selfieUrl = image.webPath;
      }
    } catch (error) {
      console.error('Selfie capture failed:', error);
      this.feedback.showToast('Error al capturar selfie');
    }
  }

  /**
   * Select ID document (photo or existing file)
   */
  async selectIdDocument(): Promise<void> {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos, // Gallery only for ID
      });
      if (image.webPath) {
        this.state.idDocumentUrl = image.webPath;
      }
    } catch (error) {
      console.error('ID document selection failed:', error);
      this.feedback.showToast('Error al seleccionar documento');
    }
  }

  /**
   * Convert blob/file to File object
   */
  // Eliminada la conversión a File/Blob. Ahora solo se almacena la URL de la imagen en el estado.

  /**
   * Upload selfie
   */
  uploadSelfie(): void {
    if (!this.state.selfieFile) {
      this.feedback.showToast('Por favor captura una selfie');
      return;
    }
    this.uploadDocument(this.state.selfieFile, 'SELFIE', 'selfie');
  }

  /**
   * Upload ID document
   */
  uploadIdDocument(): void {
    if (!this.state.idDocumentFile) {
      this.feedback.showToast('Por favor selecciona tu documento');
      return;
    }
    this.uploadDocument(this.state.idDocumentFile, 'IDENTITY_DOCUMENT', 'id');
  }

  /**
   * Main upload document flow
   */
  private uploadDocument(
    file: File,
    documentType: string,
    fieldName: string
  ): void {
    this.feedback.showLoading('Subiendo documento...');
    this.state.uploading = true;
    this.uploadService.uploadDocument(file, documentType).subscribe({
      next: (result) => {
        if (fieldName === 'selfie') {
          this.state.selfieDocumentId = result.id;
        } else {
          this.state.idDocumentId = result.id;
        }
        this.feedback.showToast(`${documentType} subida exitosamente`);
      },
      error: (error) => {
        console.error(`Upload failed for ${documentType}:`, error);
        this.feedback.showToast('Error al subir documento');
      },
      complete: () => {
        this.state.uploading = false;
        this.state.uploadProgress = 0;
        this.feedback.hideLoading();
      }
    });
  }

  /**
   * Initiate face matching verification
   */
  async initiateVerification(): Promise<void> {
    if (!this.state.selfieDocumentId || !this.state.idDocumentId) {
      this.feedback.showToast('Debe subir selfie y documento de identidad');
      return;
    }
    this.feedback.showLoading('Iniciando verificación de rostro...');
    this.uploadService
      .initiateVerification(this.state.selfieDocumentId, this.state.idDocumentId)
      .subscribe({
        next: (result) => {
          this.state.verificationStatus = result.face_match_status;
          this.feedback.showToast('Verificación iniciada. Por favor espera.');
          this.loadVerificationStatus();
        },
        error: (error) => {
          console.error('Verification initiation failed:', error);
          this.feedback.showToast('Error al iniciar verificación');
        },
        complete: () => {
          this.feedback.hideLoading();
        }
      });
  }

  /**
   * Load current verification status
   */
  private loadVerificationStatus(): void {
    this.uploadService.getVerificationStatus().subscribe({
      next: (status) => {
        if (status) {
          this.state.verificationStatus = status.face_match_status;
          this.updateVerificationMessage();
        }
      },
      error: (error) => {
        console.error('Failed to load verification status:', error);
      }
    });
  }

  /**
   * Update verification message based on status
   */
  private updateVerificationMessage(): void {
    const messages = {
      PENDING: '⏳ Esperando revisión del administrador',
      PROCESSING: '⏳ Analizando rostros...',
      APPROVED: '✅ ¡Verificación aprobada! Puedes agregar servicios',
      REJECTED: '❌ Verificación rechazada. Intenta nuevamente',
      EXPIRED: '⏰ Verificación expirada. Actualiza tus documentos',
    };

    this.state.verificationMessage = messages[this.state.verificationStatus as keyof typeof messages] || 'Estado desconocido';
  }

  /**
   * Check if provider can add services
   */
  async checkCanAddServices(): Promise<void> {
    try {
      const result = await this.uploadService
        .canAddServices()
        .toPromise();

      if (result.can_add_services) {
        await this.showToast('✅ Puedes agregar servicios');
      } else {
        await this.showAlert('Requisito no cumplido', result.reason);
      }
    } catch (error) {
      console.error('Check failed:', error);
    }
  }

  /**
   * Subscribe to upload progress
   */
  private subscribeToUploadProgress(): void {
    this.uploadService.uploadProgress$
      .pipe(takeUntil(this.destroy$))
      .subscribe((progress) => {
        this.state.uploadProgress = progress.percentage;
      });
  }

  /**
   * Show toast notification
   */
  private async showToast(message: string): Promise<void> {
    const toast = await (this as any).toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
    });
    await toast.present();
  }

  /**
   * Show alert dialog
   */
  private async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  /**
   * Get status color
   */
  getStatusColor(): string {
    const colors = {
      PENDING: 'warning',
      PROCESSING: 'warning',
      APPROVED: 'success',
      REJECTED: 'danger',
      EXPIRED: 'danger',
    };
    return colors[this.state.verificationStatus as keyof typeof colors] || 'medium';
  }

  /**
   * Check if all documents are uploaded
   */
  get allDocumentsUploaded(): boolean {
    return this.state.selfieFile !== null && this.state.idDocumentFile !== null;
  }

  /**
   * Check if documents can be verified
   */
  get canVerify(): boolean {
    return (
      this.allDocumentsUploaded &&
      this.state.selfieDocumentId !== null &&
      this.state.idDocumentId !== null &&
      !this.state.uploading
    );
  }
}

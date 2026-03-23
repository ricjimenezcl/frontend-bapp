import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { CameraService } from 'src/app/shared/services/camera.service';
import { FaceDetectionService } from 'src/app/shared/services/face-detection.service';
import { ProviderValidationService } from '../../services/provider-validation.service';
import { AuthService } from 'src/app/auth/services/auth.service';
import { interval, Subscription } from 'rxjs';
import { takeWhile } from 'rxjs/operators';

// Enum for verification states
enum VerificationState {
  UPLOAD = 'UPLOAD',
  VALIDATING = 'VALIDATING',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

@Component({
  selector: 'app-provider-validation',
  templateUrl: './provider-validation.component.html',
  styleUrls: ['./provider-validation.component.scss']
})
export class ProviderValidationComponent implements OnInit, OnDestroy {
  // Files
  selfieFile: File | null = null;
  docFile: File | null = null;
  selfiePreview: string | null = null;
  docPreview: string | null = null;

  // Face detection
  selfieFaceValid = false;
  docFaceValid = false;
  selfieFaceConfidence = 0;
  docFaceConfidence = 0;
  selfieError: string | null = null;
  docError: string | null = null;

  // Verification state
  verificationState = VerificationState.UPLOAD;
  VerificationState = VerificationState; // For template access
  isLoading = false;
  verificationId: number | null = null;
  rejectionReason: string | null = null;

  // Polling for verification status
  private statusPollingSubscription: Subscription | null = null;
  private pollingInterval = 3000; // 3 seconds
  private maxPollingTime = 300000; // 5 minutes

  constructor(
    private readonly cameraService: CameraService,
    private readonly faceDetectionService: FaceDetectionService,
    private readonly validationService: ProviderValidationService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController
  ) {}

  async ngOnInit() {
    // Initialize TensorFlow.js face detection model
    try {
      console.log('[PROVIDER_VALIDATION] Initializing face detection model...');
      await this.faceDetectionService.initializeModel();
      console.log('[PROVIDER_VALIDATION] Face detection model ready');
    } catch (error) {
      console.warn('[PROVIDER_VALIDATION] Face detection model initialization failed:', error);
      // Continue without face detection if it fails
    }
  }

  ngOnDestroy() {
    // Stop polling if active
    if (this.statusPollingSubscription) {
      this.statusPollingSubscription.unsubscribe();
    }
    // Cleanup face detection resources
    this.faceDetectionService.dispose();
  }

  async tomarSelfie() {
    try {
      this.isLoading = true;
      const blob = await this.cameraService.takePhotoAsBlob('front');
      this.selfieFile = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
      this.selfiePreview = URL.createObjectURL(blob);

      // Validate face in selfie
      await this.validateSelfie(blob);
    } catch (error: any) {
      this.mostrarAlerta('Error al tomar selfie: ' + error.message);
    } finally {
      this.isLoading = false;
    }
  }

  async tomarFotoDocumento() {
    try {
      this.isLoading = true;
      const blob = await this.cameraService.takePhotoAsBlob('rear');
      this.docFile = new File([blob], 'documento.jpg', { type: 'image/jpeg' });
      this.docPreview = URL.createObjectURL(blob);

      // Validate face in document
      await this.validateDocument(blob);
    } catch (error: any) {
      this.mostrarAlerta('Error al tomar foto del documento: ' + error.message);
    } finally {
      this.isLoading = false;
    }
  }

  private async validateSelfie(blob: Blob) {
    try {
      const result = await this.faceDetectionService.validateFaceQuality(
        blob,
        70 // 70% minimum confidence
      );

      if (result.isValid) {
        this.selfieFaceValid = true;
        this.selfieFaceConfidence = result.confidence;
        this.selfieError = null;
        console.log(`[VALIDATION] Selfie valid with ${result.confidence}% confidence`);
      } else {
        this.selfieFaceValid = false;
        this.selfieFaceConfidence = 0;
        this.selfieError = result.message;
        console.warn(`[VALIDATION] Selfie validation failed: ${result.message}`);
      }
    } catch (error) {
      console.warn('[VALIDATION] Selfie face detection error:', error);
      // If face detection fails, allow user to continue (might not have model)
      this.selfieFaceValid = true;
      this.selfieError = null;
    }
  }

  private async validateDocument(blob: Blob) {
    try {
      const result = await this.faceDetectionService.validateFaceQuality(
        blob,
        70 // 70% minimum confidence
      );

      if (result.isValid) {
        this.docFaceValid = true;
        this.docFaceConfidence = result.confidence;
        this.docError = null;
        console.log(`[VALIDATION] Document valid with ${result.confidence}% confidence`);
      } else {
        this.docFaceValid = false;
        this.docFaceConfidence = 0;
        this.docError = result.message;
        console.warn(`[VALIDATION] Document validation failed: ${result.message}`);
      }
    } catch (error) {
      console.warn('[VALIDATION] Document face detection error:', error);
      // If face detection fails, allow user to continue (might not have model)
      this.docFaceValid = true;
      this.docError = null;
    }
  }

  async enviarValidacion() {
    // Validate both files are present and faces are valid
    if (!this.selfieFile || !this.docFile) {
      this.mostrarAlerta('Por favor, toma ambas fotos (selfie y documento)');
      return;
    }

    if (!this.selfieFaceValid || !this.docFaceValid) {
      this.mostrarAlerta('Por favor, captura fotos claras con un rostro visible');
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) {
      this.mostrarAlerta('No autenticado');
      return;
    }

    const providerId = Number(user.provider_id);
    if (!providerId || Number.isNaN(providerId)) {
      this.mostrarAlerta('No se encontró el ID del proveedor');
      return;
    }

    try {
      this.isLoading = true;
      this.verificationState = VerificationState.VALIDATING;

      console.log('[PROVIDER_VALIDATION] Sending validation for provider:', providerId);

      // Upload documents and initiate verification
      const response = await this.validationService.validateIdentity(
        providerId,
        this.docFile,
        this.selfieFile
      ).toPromise();

      if (response && response.id) {
        this.verificationId = response.id;
        this.verificationState = VerificationState.PENDING;

        // Start polling for verification status
        this.startStatusPolling();
      }
    } catch (error: any) {
      this.verificationState = VerificationState.UPLOAD;
      this.mostrarAlerta('Error al enviar validación: ' + (error.error?.detail || error.message));
    } finally {
      this.isLoading = false;
    }
  }

  private startStatusPolling() {
    if (!this.verificationId) return;

    const startTime = Date.now();
    const verificationId = this.verificationId;

    this.statusPollingSubscription = interval(this.pollingInterval)
      .pipe(
        takeWhile(() => Date.now() - startTime < this.maxPollingTime)
      )
      .subscribe({
        next: () => this.checkVerificationStatus(verificationId),
        error: (err) => {
          console.error('[POLLING] Polling error:', err);
          this.stopStatusPolling();
        }
      });
  }

  private checkVerificationStatus(verificationId: number) {
    // This would call a backend endpoint to check verification status
    // For now, we'll assume the service has a method to get verification status
    this.validationService.getVerificationStatus(verificationId).subscribe({
      next: (result: any) => {
        console.log('[POLLING] Verification status:', result.face_match_status);

        switch (result.face_match_status) {
          case 'APPROVED':
            this.verificationState = VerificationState.APPROVED;
            this.stopStatusPolling();
            this.mostrarAlerta('¡Verificación aprobada! Bienvenido a tu perfil.', true);
            break;

          case 'REJECTED':
            this.verificationState = VerificationState.REJECTED;
            this.rejectionReason = result.rejection_reason || 'Los documentos no coinciden. Por favor, intenta nuevamente.';
            this.stopStatusPolling();
            this.mostrarAlertaRechazo();
            break;

          case 'PENDING':
          case 'PROCESSING':
            // Still waiting, continue polling
            break;

          default:
            console.warn('[POLLING] Unknown status:', result.face_match_status);
        }
      },
      error: (err) => {
        console.warn('[POLLING] Failed to check status:', err);
        // Continue polling even if this check fails
      }
    });
  }

  private stopStatusPolling() {
    if (this.statusPollingSubscription) {
      this.statusPollingSubscription.unsubscribe();
      this.statusPollingSubscription = null;
    }
  }

  async reintentar() {
    // Reset state and go back to upload step
    this.verificationState = VerificationState.UPLOAD;
    this.selfieFile = null;
    this.docFile = null;
    this.selfiePreview = null;
    this.docPreview = null;
    this.selfieFaceValid = false;
    this.docFaceValid = false;
    this.selfieFaceConfidence = 0;
    this.docFaceConfidence = 0;
    this.selfieError = null;
    this.docError = null;
    this.verificationId = null;
    this.rejectionReason = null;
  }

  async mostrarAlerta(mensaje: string, navegarPerfil: boolean = false) {
    const alert = await this.alertCtrl.create({
      header: 'Validación',
      message: mensaje,
      buttons: [{
        text: 'OK',
        handler: () => {
          if (navegarPerfil) {
            this.router.navigate(['/provider/tabs'], { replaceUrl: true });
          }
        }
      }]
    });
    await alert.present();
  }

  async mostrarAlertaRechazo() {
    const alert = await this.alertCtrl.create({
      header: 'Verificación Rechazada',
      message: this.rejectionReason || 'Los documentos no pudieron verificarse. Por favor, intenta nuevamente.',
      buttons: [{
        text: 'Entendido',
        role: 'cancel'
      }]
    });
    await alert.present();
  }
}

// src/app/provider/pages/provider-account-info/provider-account-info.page.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController, LoadingController, ActionSheetController } from '@ionic/angular';
import { ProviderService, ProviderProfile } from '../../services/provider.service';
import { AuthService } from '../../../auth/services/auth.service';
import { CameraService } from '../../../shared/services/camera.service';
import { Router } from '@angular/router';
import { DocumentUploadService } from '../../../shared/services/document-upload.service';

@Component({
  selector: 'app-provider-account-info',
  templateUrl: './provider-account-info.page.html',
  styleUrls: ['./provider-account-info.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class ProviderAccountInfoPage implements OnInit {

  currentUser: any;
  name: string = '';
  fono: string = '';
  email: string = '';
  id_contacto: number = 0;
  run: string = '';
  bio: string = '';
  avatar: string | null = null;
  avatarBase64: string | null = null;
  validationStatus: string = 'not_submitted';

  originalName: string = '';
  originalFono: string = '';
  originalEmail: string = '';
  originalRun: string = '';
  originalBio: string = '';
  originalAvatar: string | null = null;

  isLoading: boolean = true;
  isUpdating: boolean = false;
  isEditing: boolean = false;

  // Validación
  fieldTouched: Record<string, boolean> = {};
  fieldErrors: Record<string, string> = {};

  constructor(
    private modalController: ModalController,
    private providerService: ProviderService,
    private authService: AuthService,
    private alertCtrl: AlertController,
    private cameraService: CameraService,
    private loadingCtrl: LoadingController,
    private actionSheetCtrl: ActionSheetController,
    private router: Router,
    private documentService: DocumentUploadService
  ) { }

  async ngOnInit() {
    await this.loadUserData();
    this.checkVerificationStatus();
  }

  private checkVerificationStatus() {
    this.documentService.getVerificationStatus().subscribe({
      next: (verification: any) => {
        if (verification && verification.face_match_status) {
          this.validationStatus = verification.face_match_status === 'APPROVED' ? 'approved' : verification.face_match_status?.toLowerCase();
        }
      },
      error: (error) => {
        console.warn('Error al verificar estado:', error);
        this.validationStatus = 'not_submitted';
      }
    });
  }

  getStatusLabel(): string {
    switch (this.validationStatus) {
      case 'approved': return 'Verificado';
      case 'pending': return 'Pendiente';
      case 'processing': return 'Procesando';
      case 'rejected': return 'Rechazado';
      default: return 'No verificado';
    }
  }

  getStatusDesc(): string {
    switch (this.validationStatus) {
      case 'approved': return 'Tu identidad ha sido validada exitosamente.';
      case 'pending': return 'Estamos revisando tus documentos.';
      case 'processing': return 'La validación biométrica está en curso.';
      case 'rejected': return 'Hubo un problema con la validación. Por favor intenta de nuevo.';
      default: return 'Debes verificar tu identidad para publicar servicios.';
    }
  }

  goToVerification() {
    this.router.navigate(['/auth/verify-identity']);
  }

  private async loadUserData() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.presentAlert('Error', 'Usuario no autenticado');
      this.cancel();
      return;
    }

    try {
      const dataprov = await this.providerService.getMyProfile().toPromise();
      console.log('dataprov', dataprov);

      if (dataprov) {
        this.id_contacto = this.currentUser.id;
        this.name = dataprov.full_name || '';
        this.fono = dataprov.phone || '';
        this.email = dataprov.email || '';
        this.run = dataprov.run || '';
        this.bio = dataprov.bio || '';

        if (dataprov.avatar) {
          if (dataprov.avatar.startsWith('http')) {
            // URL de Cloudinary u otra URL externa
            this.avatar = dataprov.avatar;
          } else if (dataprov.avatar.startsWith('data:')) {
            this.avatar = dataprov.avatar;
          } else if (this.isValidBase64(dataprov.avatar)) {
            this.avatar = 'data:image/jpeg;base64,' + dataprov.avatar;
          } else {
            this.avatar = 'assets/images/default-avatar.png';
          }
        } else {
          this.avatar = 'assets/images/default-avatar.png';
        }

        this.saveOriginalData();
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private saveOriginalData() {
    this.originalName = this.name;
    this.originalFono = this.fono;
    this.originalEmail = this.email;
    this.originalRun = this.run;
    this.originalBio = this.bio;
    this.originalAvatar = this.avatar;
  }

  private isValidBase64(str: string): boolean {
    if (str.trim() === '') return false;

    try {
      return btoa(atob(str)) === str;
    } catch (err) {
      return false;
    }
  }

  async presentAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async cancel() {
    await this.modalController.dismiss(null, 'cancel');
  }

  updateField(fieldName: string, event: any) {
    const value = event.detail.value || '';
    
    switch(fieldName) {
      case 'name':
        this.name = value;
        break;
      case 'run':
        this.run = value;
        break;
      case 'fono':
        this.fono = value;
        break;
      case 'email':
        this.email = value;
        break;
    }
  }

  // ==================== FORMATEO EN TIEMPO REAL ====================

  formatRUT(event: any): void {
    let value = (event.target.value || '').toUpperCase();
    value = value.replace(/[^0-9K\.\-]/g, '');
    const rutLimpio = value.replace(/[\.\-\s]/g, '');

    // Limitar a 9 caracteres (8 dígitos + DV)
    const rutTruncado = rutLimpio.substring(0, 9);

    if (rutTruncado.length >= 2 && /^[0-9]+[0-9K]?$/.test(rutTruncado)) {
      this.run = this.aplicarFormatoRUT(rutTruncado);
    } else {
      this.run = rutTruncado;
    }
  }

  onRUTBlur(): void {
    if (this.run) {
      const rutLimpio = this.run.replace(/[\.\-\s]/g, '').toUpperCase();
      if (rutLimpio.length >= 8 && rutLimpio.length <= 9) {
        this.run = this.aplicarFormatoRUT(rutLimpio);
      }
    }
    this.fieldTouched['run'] = true;
    this.validateField('run');
  }

  private aplicarFormatoRUT(rut: string): string {
    let rutLimpio = rut.replace(/[\.\-\s]/g, '').toUpperCase();
    if (rutLimpio.length < 2) return rut;
    if (rutLimpio.length > 9) rutLimpio = rutLimpio.substring(0, 9);

    const numero = rutLimpio.slice(0, -1);
    const dv = rutLimpio.slice(-1);

    let numeroFormateado = '';
    const numeroReverso = numero.split('').reverse().join('');

    for (let i = 0; i < numeroReverso.length; i++) {
      if (i > 0 && i % 3 === 0) numeroFormateado = '.' + numeroFormateado;
      numeroFormateado = numeroReverso[i] + numeroFormateado;
    }

    return `${numeroFormateado}-${dv}`;
  }

  private calcularDigitoVerificador(numero: string): string {
    let suma = 0;
    let multiplo = 2;

    for (let i = numero.length - 1; i >= 0; i--) {
      suma += parseInt(numero.charAt(i)) * multiplo;
      multiplo = multiplo === 7 ? 2 : multiplo + 1;
    }

    const resto = suma % 11;
    const dv = 11 - resto;

    if (dv === 11) return '0';
    if (dv === 10) return 'K';
    return dv.toString();
  }

  formatPhone(event: any): void {
    let value = (event.target.value || '').replace(/\D/g, '');

    // Eliminar código de país si está al inicio
    if (value.startsWith('56')) {
      value = value.substring(2);
    }

    // Limitar a 9 dígitos
    value = value.substring(0, 9);

    // Formatear: +56 9 XXXX XXXX
    if (value.length > 0) {
      if (value.length <= 1) {
        value = `+56 ${value}`;
      } else if (value.length <= 5) {
        value = `+56 ${value.substring(0, 1)} ${value.substring(1)}`;
      } else {
        value = `+56 ${value.substring(0, 1)} ${value.substring(1, 5)} ${value.substring(5)}`;
      }
    }

    this.fono = value;
  }

  onPhoneBlur(): void {
    this.fieldTouched['fono'] = true;
    this.validateField('fono');
  }

  onPin() {
    this.isEditing = true;
  }

  cancelEdit() {
    this.name = this.originalName;
    this.fono = this.originalFono;
    this.email = this.originalEmail;
    this.run = this.originalRun;
    this.bio = this.originalBio;
    this.avatar = this.originalAvatar;
    this.avatarBase64 = null;
    this.isEditing = false;
  }

  async confirmEdit() {
    if (!this.validateAllFields()) {
      this.presentAlert('Validación', 'Por favor corrige los errores antes de continuar');
      return;
    }
    await this.putProviderEdit();
  }

  private async putProviderEdit() {
    if (this.isUpdating) return;
    this.isUpdating = true;

    const loading = await this.loadingCtrl.create({
      message: 'Actualizando perfil...'
    });
    await loading.present();

    try {
      const updateData: Partial<ProviderProfile> = {
        full_name: this.name,
        phone: this.fono,
        email: this.email,
        run: this.run,
        bio: this.bio
      };

      if (this.avatarBase64) {
        updateData.avatar = this.cameraService.extractBase64(this.avatarBase64);
      }

      console.log('Enviando datos de actualización:', {
        ...updateData,
        avatarLength: updateData.avatar?.length || 0
      });

      await this.providerService.updateProviderProfile(undefined, updateData).toPromise();

      this.saveOriginalData();
      this.isEditing = false;

      this.modalController.dismiss({
        success: true,
        data: {
          name: this.name,
          email: this.email,
          fono: this.fono,
          avatar: this.avatar
        }
      }, 'confirm');

      await this.presentAlert('Éxito', 'Perfil actualizado correctamente');

    } catch (error: any) {
      console.error('Error actualizando perfil:', error);
      await this.presentAlert('Error', error.message || 'No se pudo actualizar el perfil');
    } finally {
      await loading.dismiss().catch(() => {});
      this.isUpdating = false;
    }
  }

  async changeAvatar() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Seleccionar avatar',
      buttons: [
        {
          text: 'Tomar foto',
          icon: 'camera',
          handler: () => {
            this.takePhoto();
          }
        },
        {
          text: 'Elegir de galería',
          icon: 'images',
          handler: () => {
            this.selectFromGallery();
          }
        },
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  private async takePhoto() {
    try {
      const base64Data = await this.cameraService.takePicture();
      await this.processAvatar(base64Data);
    } catch (error) {
      console.error('Error tomando foto:', error);
      this.presentAlert('Error', 'No se pudo tomar la foto');
    }
  }

  private async selectFromGallery() {
    try {
      const base64Data = await this.cameraService.selectFromGallery();
      await this.processAvatar(base64Data);
    } catch (error) {
      console.error('Error seleccionando de galería:', error);
      this.presentAlert('Error', 'No se pudo seleccionar la imagen');
    }
  }

  private async processAvatar(base64Data: string) {
    try {
      const compressedData = await this.cameraService.compressImageForBlob(base64Data);

      this.avatarBase64 = compressedData;
      this.avatar = compressedData;

      console.log('Avatar procesado correctamente');
    } catch (error) {
      console.error('Error procesando avatar:', error);
      this.presentAlert('Error', 'Error al procesar la imagen');
    }
  }

  // ==================== VALIDACIÓN ====================

  onFieldBlur(fieldName: string) {
    this.fieldTouched[fieldName] = true;
    this.validateField(fieldName);
  }

  validateField(fieldName: string): string {
    let error = '';
    switch (fieldName) {
      case 'name':
        if (!this.name || this.name.trim().length === 0) {
          error = 'El nombre es requerido';
        } else if (this.name.trim().length < 2) {
          error = 'El nombre debe tener al menos 2 caracteres';
        }
        break;
      case 'fono':
        if (this.fono && this.fono.trim().length > 0) {
          const cleaned = this.fono.replace(/\D/g, '');
          const phoneRegex = /^(56)?9\d{8}$/;
          if (!phoneRegex.test(cleaned)) {
            error = 'Formato de teléfono chileno inválido (ej: +56 9 1234 5678)';
          }
        }
        break;
      case 'email':
        if (!this.email || this.email.trim().length === 0) {
          error = 'El email es requerido';
        } else {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(this.email)) {
            error = 'Ingresa un email válido';
          }
        }
        break;
      case 'run':
        if (this.run && this.run.trim().length > 0) {
          const runClean = this.run.replace(/[\.\-\s]/g, '').toUpperCase();
          if (runClean.length < 8) {
            error = 'El RUN debe tener al menos 8 caracteres';
          } else {
            const runRegex = /^\d{7,8}[\dkK]$/;
            if (!runRegex.test(runClean)) {
              error = 'Formato de RUN inválido (ej: 12.345.678-5)';
            } else {
              // Validar dígito verificador
              const numero = runClean.slice(0, -1);
              const dv = runClean.slice(-1);
              const dvCalculado = this.calcularDigitoVerificador(numero);
              if (dv !== dvCalculado) {
                error = 'El RUN ingresado no es válido';
              }
            }
          }
        }
        break;
      case 'bio':
        if (this.bio && this.bio.length > 500) {
          error = 'La biografía no puede exceder 500 caracteres';
        }
        break;
    }
    this.fieldErrors[fieldName] = error;
    return error;
  }

  validateAllFields(): boolean {
    const fields = ['name', 'fono', 'email', 'run', 'bio'];
    let allValid = true;
    for (const field of fields) {
      this.fieldTouched[field] = true;
      if (this.validateField(field)) {
        allValid = false;
      }
    }
    return allValid;
  }

  get isFormValid(): boolean {
    const nameValid = !!this.name && this.name.trim().length >= 2;
    const emailValid = !!this.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
    const phoneValid = !this.fono || this.fono.trim().length === 0 || /^(56)?9\d{8}$/.test(this.fono.replace(/\D/g, ''));
    
    let runValid = true;
    if (this.run && this.run.trim().length > 0) {
      const runClean = this.run.replace(/[\.\-\s]/g, '').toUpperCase();
      if (/^\d{7,8}[\dkK]$/.test(runClean)) {
        const numero = runClean.slice(0, -1);
        const dv = runClean.slice(-1);
        runValid = dv === this.calcularDigitoVerificador(numero);
      } else {
        runValid = false;
      }
    }
    
    const bioValid = !this.bio || this.bio.length <= 500;
    return nameValid && emailValid && phoneValid && runValid && bioValid;
  }
}

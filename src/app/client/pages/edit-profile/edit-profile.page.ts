import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController, AlertController, ActionSheetController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../auth/services/auth.service';
import { environment } from '../../../../environments/environment';
import { DEFAULT_AVATAR_URL } from '../../../core/constants/default-avatar';
import { ClientService, ClientProfile } from '../../services/client.service';
import { CameraService } from '../../../shared/services/camera.service';
import { ContentFilterService } from '../../../shared/services/content-filter.service';

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.page.html',
  styleUrls: ['./edit-profile.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class EditProfilePage implements OnInit {
  currentUser: any;
  fullName = '';
  phone = '';
  email = '';
  bio = '';
  avatarPreview = DEFAULT_AVATAR_URL;
  avatar: string | null = null;
  isSaving = false;
   originalName: string = '';
  originalFono: string = '';
  originalEmail: string = '';
  originalRun: string = '';
  originalBio: string = '';
  originalAvatar: string | null = null;

  isLoading: boolean = true;
  isUpdating: boolean = false;
  isEditing: boolean = false;
  isCheckingContent = false;
  contentError = '';

  // Validación
  fieldTouched: Record<string, boolean> = {};
  fieldErrors: Record<string, string> = {};

  private avatarChanged = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private http: HttpClient,
    private toastCtrl: ToastController,
    private clientService: ClientService,
    private alertCtrl: AlertController,
    private cameraService: CameraService,
    private actionSheetCtrl: ActionSheetController,
    private contentFilterService: ContentFilterService
  ) {}

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.isLoading = false;
      return;
    }

    // ✅ Usar /clients/me (endpoint basado en token, no en ID)
    // ⚠️ CORRECCIÓN: user.id = user_id (no client_id). getClientById(user_id) falla en mobile
    // porque el backend espera el client profile ID, no el auth user ID.
    this.clientService.getMyProfile().subscribe({
      next: (profile) => {
        this.fullName = profile?.full_name || '';
        this.phone = profile?.phone || '';
        this.email = profile?.email || user?.email || '';
        this.bio = profile?.bio || '';
        
        // ✅ Manejo robusto de avatar
        if (profile?.avatar) {
          if (profile.avatar.startsWith('http') || profile.avatar.startsWith('data:')) {
            this.avatar = profile.avatar;
          } else if (this.isValidBase64(profile.avatar)) {
            this.avatar = 'data:image/jpeg;base64,' + profile.avatar;
          } else {
            this.avatar = DEFAULT_AVATAR_URL;
          }
        } else {
          this.avatar = DEFAULT_AVATAR_URL;
        }
        
        this.avatarPreview = this.avatar ?? DEFAULT_AVATAR_URL;
        this.isLoading = false;
        this.saveOriginalData();
      },
      error: (err) => {
        console.error('❌ [EditProfile] Error loading profile:', err);
        // ✅ Fallback a datos del token
        this.fullName = (user as any)?.full_name || '';
        this.phone = (user as any)?.phone || '';
        this.email = user?.email || '';
        this.avatar = (user as any)?.avatar || DEFAULT_AVATAR_URL;
        this.avatarPreview = this.avatar ?? DEFAULT_AVATAR_URL;
        this.isLoading = false;
        this.saveOriginalData();
        
        // ✅ Toast informativo
        this.presentToast('Usando datos básicos del perfil', 'warning');
      }
    });
  }

  private async loadUserData() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.presentAlert('Error', 'Usuario no autenticado');
      this.cancel();
      return;
    }

    try {
      // ✅ CORRECCIÓN: usar /clients/me en lugar de /clients/{user_id}
      const dataprov = await this.clientService.getMyProfile().toPromise();
      console.log('dataprov', dataprov);

      if (dataprov) {

        this.fullName = dataprov.full_name || '';
        this.phone = dataprov.phone || '';
        this.email = dataprov.email || '';

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



  goBack() {
    this.router.navigate(['/client/tabs'], { state: { activeTab: 'client-profile' } });
  }

  onPhotoSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.avatarPreview = reader.result as string;
      this.avatarChanged = true;
    };
    reader.readAsDataURL(file);
  }

  async saveProfile() {
    if (!this.fullName.trim()) {
      await this.presentToast('El nombre es requerido', 'warning');
      return;
    }

    this.isSaving = true;

    const payload: any = {
      full_name: this.fullName.trim(),
      phone: this.phone.trim(),
      bio: this.bio.trim()
    };

    if (this.avatarChanged && this.avatarPreview.startsWith('data:')) {
      payload.avatar = this.avatarPreview;
    }

    this.http.patch(`${environment.apiUrl}/users/me`, payload).subscribe({
      next: () => {
        const existing = this.authService.getUserProfile();
        this.authService.setUserProfile({
          ...existing,
          full_name: this.fullName.trim(),
          phone: this.phone.trim(),
          bio: this.bio.trim(),
          avatar: this.avatarChanged ? this.avatarPreview : (existing?.avatar ?? undefined)
        });
        this.isSaving = false;
        this.presentToast('Perfil actualizado correctamente', 'success');
        this.router.navigate(['/client/tabs'], { state: { activeTab: 'client-profile' } });
      },
      error: () => {
        this.isSaving = false;
        this.presentToast('Error al actualizar el perfil', 'danger');
      }
    });
  }

  private async presentToast(message: string, color: string = 'primary'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'top'
    });
    await toast.present();
  }


 /*********************************/



  private saveOriginalData() {
    this.originalName = this.fullName;
    this.originalFono = this.phone;
    this.originalEmail = this.email;
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

  cancel() {
    this.router.navigate(['/client/tabs'], { state: { activeTab: 'client-profile' } });
  }

  updateField(fieldName: string, event: any) {
    const value = event.detail.value || '';
    
    switch(fieldName) {
      case 'fullName':
        this.fullName = value;
        break;
      case 'phone':
        this.phone = value;
        break;
      case 'email':
        this.email = value;
        break;
      case 'bio':
        this.bio = value;
        break;
    }
  }

  // ==================== FORMATEO EN TIEMPO REAL ====================









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

    this.phone = value;
  }

  onPhoneBlur(): void {
    this.fieldTouched['phone'] = true;
    this.validateField('phone');
  }

  onPin() {
    this.isEditing = true;
  }

  async cancelEdit() {
    const alert = await this.alertCtrl.create({
      header: 'Descartar cambios',
      message: '¿Estás seguro de que quieres descartar los cambios?',
      buttons: [
        { text: 'Seguir editando', role: 'cancel' },
        {
          text: 'Descartar',
          handler: () => {
            this.fullName = this.originalName;
            this.phone = this.originalFono;
            this.email = this.originalEmail;
            this.bio = this.originalBio;
            this.avatar = this.originalAvatar;
            this.avatarChanged = false;
            this.isEditing = false;
          }
        }
      ]
    });
    await alert.present();
  }

  async confirmEdit() {
    if (!this.validateAllFields()) {
      this.presentAlert('Validación', 'Por favor corrige los errores antes de continuar');
      return;
    }

    if (!(await this.validateEditableContent())) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Guardar cambios',
      message: '¿Confirmas los cambios en tu perfil?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: () => { this.putProviderEdit(); }
        }
      ]
    });
    await alert.present();
  }

  private async validateEditableContent(): Promise<boolean> {
    this.contentError = '';
    this.fieldErrors['fullName'] = this.fieldErrors['fullName'] && !this.fieldErrors['fullName'].includes('lenguaje')
      ? this.fieldErrors['fullName']
      : '';
    this.fieldErrors['bio'] = this.fieldErrors['bio'] && !this.fieldErrors['bio'].includes('lenguaje')
      ? this.fieldErrors['bio']
      : '';
    this.isCheckingContent = true;

    try {
      const fullName = this.fullName.trim();
      if (fullName.length >= 2) {
        const nameResult = await firstValueFrom(this.contentFilterService.validateText(fullName, 'profile'));
        if (nameResult.blocked) {
          this.fieldTouched['fullName'] = true;
          this.fieldErrors['fullName'] = 'El nombre contiene lenguaje no permitido';
          this.contentError = 'Corrige el nombre para continuar.';
          return false;
        }
      }

      const bio = this.bio.trim();
      if (bio.length >= 2) {
        const bioResult = await firstValueFrom(this.contentFilterService.validateText(bio, 'profile'));
        if (bioResult.blocked) {
          this.fieldTouched['bio'] = true;
          this.fieldErrors['bio'] = 'La descripción contiene lenguaje no permitido';
          this.contentError = 'Corrige la sección Sobre mí para continuar.';
          return false;
        }
      }

      return true;
    } catch {
      return true;
    } finally {
      this.isCheckingContent = false;
    }
  }

  private async putProviderEdit() {
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      const updateData: Partial<ClientProfile> = {
        full_name: this.fullName.trim(),
        phone: this.phone,
        bio: this.bio
      };

      // Solo enviar avatar si fue modificado y es base64
      if (this.avatarChanged && this.avatar && this.avatar.startsWith('data:')) {
        updateData.avatar = this.avatar;
      }

      console.log('[EditProfile] Sending PATCH...', updateData);
      await this.clientService.updateClientProfile(undefined, updateData).toPromise();
      console.log('[EditProfile] PATCH success!');

      this.saveOriginalData();
      this.avatarChanged = false;
      this.isEditing = false;

      await this.presentToast('Perfil actualizado correctamente', 'success');
      this.router.navigate(['/client/tabs'], { state: { activeTab: 'client-profile' } });

    } catch (error: any) {
      console.error('[EditProfile] Error en PATCH:', error);
      const msg = (error?.error?.detail) || (error?.message) || 'No se pudo actualizar el perfil';
      await this.presentToast(msg, 'danger');
    } finally {
      this.isUpdating = false;
    }
  }

  async changeAvatar() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Cambiar foto de perfil',
      subHeader: 'Selecciona una opción',
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
      // Comprimir imagen para optimizar el tamaño
      const compressedData = await this.cameraService.compressImageForBlob(base64Data, 400, 0.7);

      // Actualizar avatar y preview
      this.avatar = compressedData;
      this.avatarChanged = true;

      console.log('✅ Avatar procesado correctamente');
      
      // Si no está en modo edición, ofrecer guardar automáticamente
      if (!this.isEditing) {
        const alert = await this.alertCtrl.create({
          header: 'Foto actualizada',
          message: '¿Deseas guardar el cambio ahora?',
          buttons: [
            {
              text: 'Más tarde',
              role: 'cancel',
              handler: () => {
                this.presentToast('Foto actualizada. Recuerda guardar los cambios', 'warning');
              }
            },
            {
              text: 'Guardar ahora',
              handler: async () => {
                await this.saveAvatarOnly();
              }
            }
          ]
        });
        await alert.present();
      } else {
        await this.presentToast('Foto actualizada. Recuerda guardar los cambios', 'success');
      }
    } catch (error) {
      console.error('❌ Error procesando avatar:', error);
      await this.presentToast('Error al procesar la imagen', 'danger');
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
      case 'fullName':
        if (!this.fullName || this.fullName.trim().length === 0) {
          error = 'El nombre es requerido';
        } else if (this.fullName.trim().length < 2) {
          error = 'El nombre debe tener al menos 2 caracteres';
        }
        break;
      case 'phone':
        if (this.phone && this.phone.trim().length > 0) {
          const cleaned = this.phone.replace(/\D/g, '');
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
    const fields = ['fullName', 'phone', 'bio'];
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
    const nameValid = !!this.fullName && this.fullName.trim().length >= 2;
    const phoneValid = !this.phone || this.phone.trim().length === 0 || /^(56)?9\d{8}$/.test(this.phone.replace(/\D/g, ''));
    const bioValid = !this.bio || this.bio.length <= 500;
    return nameValid && phoneValid && bioValid;
  }

  /**
   * Guardar solo el avatar sin entrar en modo edición
   */
  private async saveAvatarOnly() {
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      const updateData: Partial<ClientProfile> = {};

      if (this.avatarChanged && this.avatar && this.avatar.startsWith('data:')) {
        updateData.avatar = this.avatar;
      }

      console.log('[EditProfile] Guardando solo avatar...');
      await this.clientService.updateClientProfile(undefined, updateData).toPromise();
      console.log('[EditProfile] Avatar guardado!');

      this.originalAvatar = this.avatar;
      this.avatarChanged = false;

      await this.presentToast('Foto de perfil actualizada', 'success');

    } catch (error: any) {
      console.error('[EditProfile] Error guardando avatar:', error);
      const msg = error?.error?.detail || error?.message || 'No se pudo actualizar la foto';
      await this.presentToast(msg, 'danger');
    } finally {
      this.isUpdating = false;
    }
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { IonicModule, ModalController, AlertController, LoadingController, ActionSheetController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../auth/services/auth.service';
import { environment } from '../../../../environments/environment';
import { DEFAULT_AVATAR_URL } from '../../../core/constants/default-avatar';
import { ClientService, ClientProfile } from '../../services/client.service';
import { CameraService } from '../../../shared/services/camera.service';

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
    private modalController: ModalController,

    private alertCtrl: AlertController,
    private cameraService: CameraService,
    private loadingCtrl: LoadingController,
    private actionSheetCtrl: ActionSheetController
  ) {}

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    const userId = typeof user?.id === 'string'
      ? parseInt(user?.id, 10)
      : user?.id as number;
    this.clientService.getClientById(userId).subscribe(profile => {
      this.fullName = profile?.full_name || (user as any)?.full_name || '';
      this.phone = profile?.phone || (user as any)?.phone || '';
      this.email = profile?.email || user?.email || '';
      this.bio = profile?.bio || '';
      this.avatar = profile?.avatar || (user as any)?.avatar || DEFAULT_AVATAR_URL;
      this.saveOriginalData();
    });

    console.log('Perfil obtenido en EditProfilePage:', user);
  }

  private async loadUserData() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.presentAlert('Error', 'Usuario no autenticado');
      this.cancel();
      return;
    }

    try {
      const user = this.authService.getCurrentUser();
    const userId = typeof user?.id === 'string'
      ? parseInt(user?.id, 10)
      : user?.id as number;
    
      const dataprov = await this.clientService.getClientById(userId).toPromise();
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
    this.router.navigate(['/client/tabs/profile']);
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
        this.presentToast('Perfil actualizado correctamente', 'success').then(() => {
          this.router.navigate(['/client/tabs/profile']);
        });
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
    this.router.navigate(['/client/tabs/profile']);
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

  cancelEdit() {
    this.fullName = this.originalName;
    this.phone = this.originalFono;
    this.email = this.originalEmail;

    this.bio = this.originalBio;
    this.avatar = this.originalAvatar;

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
      const updateData: Partial<ClientProfile> = {
        full_name: this.fullName,
        phone: this.phone,
        email: this.email,
        bio: this.bio
      };

      // Incluir avatar solo si fue cambiado (es data URI de cámara/galería)
      if (this.avatar && this.avatar.startsWith('data:')) {
        updateData.avatar = this.avatar;
      }

      console.log('Enviando datos de actualización:', {
        ...updateData,
        avatarLength: updateData.avatar?.length || 0
      });

      await this.clientService.updateClientProfile(undefined, updateData).toPromise();

      this.saveOriginalData();
      this.isEditing = false;

      this.modalController.dismiss({
        success: true,
        data: {
          fullName: this.fullName,
          email: this.email,
          phone: this.phone,
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
    const fields = ['fullName', 'phone', 'email', 'run', 'bio'];
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
    const emailValid = !!this.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
    const phoneValid = !this.phone || this.phone.trim().length === 0 || /^(56)?9\d{8}$/.test(this.phone.replace(/\D/g, ''));
    
    let runValid = true;

    const bioValid = !this.bio || this.bio.length <= 500;
    return nameValid && emailValid && phoneValid && runValid && bioValid;
  }
}

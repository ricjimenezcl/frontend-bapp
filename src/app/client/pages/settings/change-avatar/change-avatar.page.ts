import { Component } from '@angular/core';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from '../../../../auth/services/auth.service';

@Component({
  selector: 'app-change-avatar',
  templateUrl: './change-avatar.page.html',
  styleUrls: ['./change-avatar.page.scss'],
  standalone: true,
  imports: [IonicModule]
})
export class ChangeAvatarPage {
  selectedFile: File | null = null;
  previewUrl: string | ArrayBuffer | null = null;
  uploading = false;

  constructor(private authService: AuthService, private toastCtrl: ToastController) {}

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = e => this.previewUrl = reader.result;
      reader.readAsDataURL(file);
    }
  }

  async uploadAvatar() {
    if (!this.selectedFile) return;
    this.uploading = true;
    try {
      // Aquí deberías llamar a tu servicio que sube la imagen a Cloudinary y actualiza el perfil
      await this.authService.uploadAvatar(this.selectedFile);
      const toast = await this.toastCtrl.create({
        message: 'Foto de perfil actualizada',
        duration: 2000,
        color: 'success'
      });
      toast.present();
    } catch (e) {
      const toast = await this.toastCtrl.create({
        message: 'Error al subir la foto',
        duration: 2000,
        color: 'danger'
      });
      toast.present();
    }
    this.uploading = false;
  }
}

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from '../../../../auth/services/auth.service';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.page.html',
  styleUrls: ['./change-password.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class ChangePasswordPage {
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  showOldPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  loading = false;
  submitted = false;

  constructor(private authService: AuthService, private toastCtrl: ToastController) {}

  get passwordErrors(): string[] {
    const errors: string[] = [];
    if (!this.newPassword) return errors;
    if (this.newPassword.length < 8) errors.push('Mínimo 8 caracteres');
    if (!/[A-Z]/.test(this.newPassword)) errors.push('Debe contener al menos una mayúscula');
    if (!/[0-9]/.test(this.newPassword)) errors.push('Debe contener al menos un número');
    return errors;
  }

  get passwordsMatch(): boolean {
    return this.newPassword === this.confirmPassword;
  }

  get isFormValid(): boolean {
    return !!this.oldPassword && !!this.newPassword && !!this.confirmPassword
      && this.passwordErrors.length === 0 && this.passwordsMatch;
  }

  togglePasswordVisibility(field: 'old' | 'new' | 'confirm'): void {
    if (field === 'old') {
      this.showOldPassword = !this.showOldPassword;
      return;
    }
    if (field === 'new') {
      this.showNewPassword = !this.showNewPassword;
      return;
    }
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async changePassword() {
    this.submitted = true;

    if (!this.isFormValid) {
      const toast = await this.toastCtrl.create({
        message: 'Por favor corrige los errores del formulario',
        duration: 2000,
        color: 'warning'
      });
      toast.present();
      return;
    }
    this.loading = true;
    try {
      await this.authService.changePassword(this.oldPassword, this.newPassword);
      const toast = await this.toastCtrl.create({
        message: 'Contraseña actualizada',
        duration: 2000,
        color: 'success'
      });
      toast.present();
      this.oldPassword = this.newPassword = this.confirmPassword = '';
    } catch (e) {
      const toast = await this.toastCtrl.create({
        message: 'Error al cambiar la contraseña',
        duration: 2000,
        color: 'danger'
      });
      toast.present();
    }
    this.loading = false;
  }
}

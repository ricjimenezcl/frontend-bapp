import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, AlertController, LoadingController } from '@ionic/angular';
import { ThemeService } from '../../../shared/services/theme.service';
import { I18nService } from '../../../shared/services/i18n.service';
import { UserSettingsService } from '../../../shared/services/user-settings.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ApiService } from '../../../shared/services/api.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class SettingsPage implements OnInit {
  darkMode = false;
  currentLanguage = 'es';
  availableLanguages: any[] = [];

  constructor(
    private router: Router,
    private themeService: ThemeService,
    private i18nService: I18nService,
    private userSettingsService: UserSettingsService,
    private authService: AuthService,
    private apiService: ApiService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  private loadSettings(): void {
    // Cargar tema
    this.themeService.darkMode$.subscribe(isDark => {
      this.darkMode = isDark;
    });

    // Cargar idioma
    this.currentLanguage = this.i18nService.getLanguage();
    this.availableLanguages = this.i18nService.getAvailableLanguages();
  }

  onDarkModeToggle(event: any): void {
    const isDark = event.detail.checked;
    this.themeService.toggleDarkMode(isDark);
    this.userSettingsService.updateSettings({
      darkMode: isDark,
      theme: isDark ? 'dark' : 'light',
    });
  }

  onLanguageChange(): void {
    this.i18nService.setLanguage(this.currentLanguage);
    this.userSettingsService.updateSettings({ preferredLanguage: this.currentLanguage });
  }

  onPage(page: string): void {
    this.router.navigate([`/client/settings/${page}`]);
  }

  async onChangeAvatar(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Cambiar Foto de Perfil',
      inputs: [
        {
          name: 'url',
          type: 'text',
          placeholder: 'Ingresa URL de imagen o carga una...',
          value: ''
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cargar Foto',
          handler: async (data) => {
            await this.uploadAvatar(data.url);
          }
        }
      ]
    });
    await alert.present();
  }

  private async uploadAvatar(imageUrl: string): Promise<void> {
    if (!imageUrl || imageUrl.trim().length === 0) {
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'Ingresa una URL de imagen',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'La URL debe comenzar con http:// o https://',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Subiendo foto...' });
    await loading.present();

    try {
      const response = await this.apiService.put('/users/me/avatar', {
        avatar_url: imageUrl
      }).toPromise();

      if (response) {
        // Actualizar usuario en localStorage
        const currentUser = this.authService.getCurrentUser();
        if (currentUser) {
          (currentUser as any).avatar = imageUrl;
          // Guardar en localStorage
          localStorage.setItem('user_data', JSON.stringify(currentUser));
        }

        const success = await this.alertCtrl.create({
          header: 'Éxito',
          message: 'Foto de perfil actualizada correctamente',
          buttons: ['OK']
        });
        await success.present();
      }
    } catch (error) {
      const errorAlert = await this.alertCtrl.create({
        header: 'Error',
        message: 'No se pudo actualizar la foto de perfil',
        buttons: ['OK']
      });
      await errorAlert.present();
    } finally {
      await loading.dismiss();
    }
  }

  async onChangePassword(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Cambiar Contraseña',
      inputs: [
        {
          name: 'currentPassword',
          type: 'password',
          placeholder: 'Contraseña actual'
        },
        {
          name: 'newPassword',
          type: 'password',
          placeholder: 'Nueva contraseña'
        },
        {
          name: 'confirmPassword',
          type: 'password',
          placeholder: 'Confirmar contraseña'
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cambiar',
          handler: async (data) => {
            await this.updatePassword(data.currentPassword, data.newPassword, data.confirmPassword);
          }
        }
      ]
    });
    await alert.present();
  }

  private async updatePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
    // Validaciones
    if (!currentPassword || !newPassword || !confirmPassword) {
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'Todos los campos son requeridos',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    if (newPassword !== confirmPassword) {
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'Las nuevas contraseñas no coinciden',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    if (newPassword.length < 8) {
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'La contraseña debe tener al menos 8 caracteres',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'La contraseña debe contener al menos una mayúscula',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'La contraseña debe contener al menos un número',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Cambiando contraseña...' });
    await loading.present();

    try {
      await this.apiService.put('/users/me/password', {
        current_password: currentPassword,
        new_password: newPassword
      }).toPromise();

      const success = await this.alertCtrl.create({
        header: 'Éxito',
        message: 'Contraseña actualizada correctamente',
        buttons: [
          {
            text: 'OK',
            handler: () => {
              // Redirigir a login para reautenticarse
              this.authService.logout();
              this.router.navigate(['/auth/login']);
            }
          }
        ]
      });
      await success.present();
    } catch (error: any) {
      const errorAlert = await this.alertCtrl.create({
        header: 'Error',
        message: error?.error?.detail || 'No se pudo cambiar la contraseña',
        buttons: ['OK']
      });
      await errorAlert.present();
    } finally {
      await loading.dismiss();
    }
  }

  cancel() {
    this.router.navigate(['/client/tabs/profile']);
  }
}

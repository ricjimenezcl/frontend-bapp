import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, IonicModule } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../features/auth/services/auth.service';
import { CameraService } from '../../services/camera.service';
import { ContentFilterService } from '../../services/content-filter.service';
import { PhoneFormatter } from '../../formatters';
import { CustomValidators } from '../../validators/custom-validators';

@Component({
  selector: 'app-access-auth-modal',
  templateUrl: './access-auth-modal.component.html',
  styleUrls: ['./access-auth-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class AccessAuthModalComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);
  private readonly cameraService = inject(CameraService);
  private readonly contentFilterService = inject(ContentFilterService);

  isOpen = false;
  mode: 'login' | 'register' = 'login';
  role: 'client' | 'provider' = 'client';
  providerRegistrationStep: 1 | 2 = 1;
  loading = false;
  error = '';
  avatarPreview: string | null = null;
  isTakingPhoto = false;

  loginEmail = '';
  loginPassword = '';

  registerFullName = '';
  registerEmail = '';
  registerPhone = '';
  registerPassword = '';
  registerConfirmPassword = '';
  registerRun = '';
  registerBio = '';
  registerTermsAccepted = false;
  registerEmailOptIn = false;

  appleSignInAvailable = false;

  open(mode: 'login' | 'register' = 'login', role: 'client' | 'provider' = this.role): void {
    this.mode = mode;
    this.role = role;
    this.providerRegistrationStep = 1;
    this.isOpen = true;
  }

  closeModal(): void {
    this.isOpen = false;
    this.providerRegistrationStep = 1;
    this.loading = false;
    this.error = '';
    this.isTakingPhoto = false;
    this.avatarPreview = null;
  }

  configure(options: {
    mode?: 'login' | 'register';
    role?: 'client' | 'provider';
    loginEmail?: string;
    loginPassword?: string;
    registerFullName?: string;
    registerEmail?: string;
    registerPhone?: string;
    registerPassword?: string;
    registerConfirmPassword?: string;
    registerRun?: string;
    registerBio?: string;
    registerTermsAccepted?: boolean;
    registerEmailOptIn?: boolean;
    appleSignInAvailable?: boolean;
  } = {}): void {
    this.mode = options.mode ?? this.mode;
    this.role = options.role ?? this.role;
    this.providerRegistrationStep = 1;
    this.loginEmail = options.loginEmail ?? this.loginEmail;
    this.loginPassword = options.loginPassword ?? this.loginPassword;
    this.registerFullName = options.registerFullName ?? this.registerFullName;
    this.registerEmail = options.registerEmail ?? this.registerEmail;
    this.registerPhone = options.registerPhone ?? this.registerPhone;
    this.registerPassword = options.registerPassword ?? this.registerPassword;
    this.registerConfirmPassword = options.registerConfirmPassword ?? this.registerConfirmPassword;
    this.registerRun = options.registerRun ?? this.registerRun;
    this.registerBio = options.registerBio ?? this.registerBio;
    this.registerTermsAccepted = options.registerTermsAccepted ?? this.registerTermsAccepted;
    this.registerEmailOptIn = options.registerEmailOptIn ?? this.registerEmailOptIn;
    this.appleSignInAvailable = options.appleSignInAvailable ?? this.appleSignInAvailable;
  }

  async submitAuth(): Promise<void> {
    if (this.loading) return;

    if (this.mode === 'login') {
      await this.handleLogin();
      return;
    }

    if (this.role === 'provider' && this.providerRegistrationStep === 1) {
      await this.goToProviderOptionalStep();
      return;
    }

    await this.handleRegister();
  }

  private async goToProviderOptionalStep(): Promise<void> {
    const requiredError = await this.validateProviderRequiredFields();
    if (requiredError) {
      this.error = requiredError;
      return;
    }

    this.error = '';
    this.providerRegistrationStep = 2;
  }

  private async validateProviderRequiredFields(): Promise<string | null> {
    const commonError = await this.validateCommonRegistrationFields();
    if (commonError) {
      return commonError;
    }

    const run = this.normalizeRun(this.registerRun);
    if (!run) {
      return 'El RUT es obligatorio para perfiles de proveedor.';
    }

    if (!this.isValidRut(run)) {
      return 'Ingresa un RUT válido.';
    }

    const bioError = await this.validateForbiddenText(this.registerBio.trim(), 'biografía');
    if (bioError) {
      return bioError;
    }

    return null;
  }

  private async validateCommonRegistrationFields(): Promise<string | null> {
    const fullName = this.registerFullName.trim();
    const email = this.registerEmail.trim();
    const phone = this.registerPhone.trim();
    const password = this.registerPassword;
    const confirmPassword = this.registerConfirmPassword;

    if (!fullName) {
      return 'El nombre completo es obligatorio.';
    }

    if (!this.isValidEmail(email)) {
      return 'Ingresa un correo electrónico válido.';
    }

    if (!this.isValidPhone(phone)) {
      return 'Ingresa un teléfono válido para Chile.';
    }

    if (!password || !confirmPassword) {
      return 'Debes completar la contraseña y su confirmación.';
    }

    const passwordError = this.validatePasswordStrength(password);
    if (passwordError) {
      return passwordError;
    }

    if (password !== confirmPassword) {
      return 'Las contraseñas no coinciden.';
    }

    if (!this.registerTermsAccepted) {
      return 'Debes aceptar los términos y políticas.';
    }

    const forbiddenName = await this.validateForbiddenText(fullName, 'nombre');
    if (forbiddenName) {
      return forbiddenName;
    }

    return null;
  }

  private validatePasswordStrength(password: string): string | null {
    const passwordValidator = CustomValidators.passwordStrength();
    const result = passwordValidator({ value: password } as any);

    if (!result) {
      return null;
    }

    if (result['minLength']) {
      return 'La contraseña debe tener al menos 8 caracteres.';
    }

    if (result['noUpperCase']) {
      return 'La contraseña debe incluir al menos una mayúscula.';
    }

    if (result['noNumber']) {
      return 'La contraseña debe incluir al menos un número.';
    }

    return 'La contraseña no cumple con los requisitos.';
  }

  private async validateForbiddenText(value: string, fieldName: string): Promise<string | null> {
    if (!value || !value.trim()) {
      return null;
    }

    try {
      const result = await firstValueFrom(this.contentFilterService.validateText(value, 'profile'));
      if (result?.blocked || result?.flagged) {
        return `El campo ${fieldName} contiene contenido no permitido.`;
      }
    } catch {
      return null;
    }

    return null;
  }

  private isValidEmail(email: string): boolean {
    const emailValidator = CustomValidators.strictEmail();
    const result = emailValidator({ value: email } as any);
    return !result;
  }

  private isValidPhone(phone: string): boolean {
    const phoneValidator = CustomValidators.phone();
    const result = phoneValidator({ value: phone } as any);
    return !result;
  }

  private normalizeRun(value: string): string {
    const cleaned = (value ?? '').toUpperCase().replace(/[^0-9K]/g, '');
    if (cleaned.length < 8 || cleaned.length > 9) {
      return '';
    }
    return cleaned;
  }

  private isValidRut(value: string): boolean {
    const rutValidator = CustomValidators.rut();
    const result = rutValidator({ value } as any);
    return !result;
  }

  private async handleLogin(): Promise<void> {
    const email = this.loginEmail.trim();
    const password = this.loginPassword;

    if (!email || !password) {
      this.error = 'Ingresa tu correo y contraseña.';
      return;
    }

    this.loading = true;
    this.error = '';

    this.authService.loginClient({
      email,
      password,
      role: this.role === 'provider' ? 'PROVIDER' : 'CLIENT'
    }).subscribe({
      next: (response) => {
        this.loading = false;
        this.closeModal();
        const target = response?.role === 'PROVIDER' ? ['/provider/tabs/home'] : ['/client/tabs/home'];
        this.router.navigate(target);
      },
      error: (error) => {
        this.loading = false;
        this.error = error?.error?.detail || error?.error?.message || 'Credenciales inválidas.';
      }
    });
  }

  private async handleRegister(): Promise<void> {
    const fullName = this.registerFullName.trim();
    const email = this.registerEmail.trim();
    const phone = this.registerPhone.trim();
    const password = this.registerPassword;
    const confirmPassword = this.registerConfirmPassword;

    if (this.role === 'provider') {
      const providerError = await this.validateProviderRequiredFields();
      if (providerError) {
        this.error = providerError;
        return;
      }
    } else {
      const commonError = await this.validateCommonRegistrationFields();
      if (commonError) {
        this.error = commonError;
        return;
      }
    }

    this.loading = true;
    this.error = '';

    if (this.role === 'provider') {
      const run = this.normalizeRun(this.registerRun);

      const providerData = {
        email,
        password,
        full_name: fullName,
        phone: PhoneFormatter.normalizeToE164(phone),
        run,
        bio: this.registerBio || '',
        avatar: this.avatarPreview || null,
        rating_avg: 5,
        terms_accepted: true,
        email_opt_in: this.registerEmailOptIn
      };

      this.authService.registerProvider(providerData).subscribe({
        next: async () => {
          this.loading = false;
          this.closeModal();
          const alert = await this.alertCtrl.create({
            header: 'Verifica tu correo',
            message: 'Te enviamos un correo para validar tu cuenta de proveedor. Revisa tu bandeja de entrada y confirma tu cuenta antes de iniciar sesión.',
            buttons: [{
              text: 'Entendido',
              handler: () => this.router.navigate(['/auth/login'])
            }]
          });
          await alert.present();
        },
        error: (error) => {
          this.loading = false;
          this.error = error?.error?.detail || error?.error?.message || 'No se pudo registrar tu perfil de proveedor.';
        }
      });
      return;
    }

    const defaultAvatar = 'https://res.cloudinary.com/dghwotofx/image/upload/v1769918403/default-avatar_e2c4t0.png';
    this.authService.registerClient({
      email,
      password,
      full_name: fullName,
      phone: PhoneFormatter.normalizeToE164(phone),
      avatar: defaultAvatar,
      rating_avg: 5,
      terms_accepted: true,
      email_opt_in: this.registerEmailOptIn
    }).subscribe({
      next: async () => {
        this.loading = false;
        this.closeModal();
        const alert = await this.alertCtrl.create({
          header: 'Verifica tu correo',
          message: 'Te enviamos un correo para validar tu cuenta de cliente. Revisa tu bandeja de entrada y confirma tu cuenta antes de iniciar sesión.',
          buttons: [{
            text: 'Entendido',
            handler: () => this.router.navigate(['/auth/login'])
          }]
        });
        await alert.present();
      },
      error: (error) => {
        this.loading = false;
        this.error = error?.error?.detail || error?.error?.message || 'No se pudo registrar tu perfil de cliente.';
      }
    });
  }

  async takePhoto(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Foto de perfil',
      message: '¿Cómo quieres agregar tu foto de perfil?',
      buttons: [
        {
          text: 'Tomar foto',
          handler: async () => {
            await this.takeNewPhoto();
            return false;
          }
        },
        {
          text: 'Desde galería',
          handler: async () => {
            await this.selectFromGallery();
            return false;
          }
        },
        {
          text: 'Cancelar',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  private async takeNewPhoto(): Promise<void> {
    try {
      this.isTakingPhoto = true;
      const base64Data = await this.cameraService.takePicture();
      await this.processAvatar(base64Data);
    } catch (error) {
      console.error('No se pudo tomar la foto:', error);
      this.error = 'No se pudo tomar la foto de perfil.';
    } finally {
      this.isTakingPhoto = false;
    }
  }

  private async selectFromGallery(): Promise<void> {
    try {
      this.isTakingPhoto = true;
      const base64Data = await this.cameraService.selectFromGallery();
      await this.processAvatar(base64Data);
    } catch (error) {
      console.error('No se pudo seleccionar la foto:', error);
      this.error = 'No se pudo seleccionar la foto de perfil.';
    } finally {
      this.isTakingPhoto = false;
    }
  }

  private async processAvatar(base64Data: string): Promise<void> {
    if (!base64Data) {
      return;
    }

    const compressedData = await this.cameraService.compressImageForBlob(base64Data, 400, 0.5);
    this.avatarPreview = compressedData;
    this.error = '';
  }

  removeAvatar(): void {
    this.avatarPreview = null;
  }

  onEmailInput(event: any): void {
    const raw = (event?.target?.value ?? '').toString();
    this.registerEmail = raw.trim();
  }

  onPhoneInput(event: any): void {
    const raw = (event?.target?.value ?? '').toString();
    const digits = raw.replace(/\D/g, '').replace(/^56/, '').replace(/^9/, '').slice(0, 8);

    if (!digits) {
      this.registerPhone = '';
      return;
    }

    this.registerPhone = digits.length <= 4
      ? `+56 9 ${digits}`
      : `+56 9 ${digits.slice(0, 4)} ${digits.slice(4)}`;
  }

  onRutInput(event: any): void {
    const raw = (event?.target?.value ?? '').toString().toUpperCase();
    const cleaned = raw.replace(/[^0-9K]/g, '').slice(0, 9);

    if (!cleaned) {
      this.registerRun = '';
      return;
    }

    const body = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1);
    const formattedBody = body.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    this.registerRun = `${formattedBody}-${dv}`;
  }

  loginWithGoogle(): void {
    this.error = 'El flujo de Google se maneja desde la pantalla principal de autenticación.';
    this.loading = false;
  }

  loginWithFacebook(): void {
    this.error = 'El flujo de Facebook se maneja desde la pantalla principal de autenticación.';
    this.loading = false;
  }

  loginWithApple(): void {
    this.error = 'El flujo de Apple se maneja desde la pantalla principal de autenticación.';
    this.loading = false;
  }
}

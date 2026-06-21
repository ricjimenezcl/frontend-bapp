import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  FormsModule, 
  ReactiveFormsModule, 
  FormBuilder, 
  FormGroup, 
  FormControl, 
  Validators, 
  ValidationErrors 
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem,
  IonInput, IonSpinner, IonBackButton, AlertController, IonIcon, IonLabel,
  IonCheckbox } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { SocialAuthService, GoogleLoginProvider, FacebookLoginProvider } from '@abacritt/angularx-social-login';

@Component({
  selector: 'app-register-client',
  templateUrl: './register-client.page.html',
  styleUrls: ['./register-client.page.scss'],
  standalone: true,
  imports: [IonIcon,
    CommonModule, FormsModule, ReactiveFormsModule, RouterModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem,
    IonInput, IonSpinner, IonBackButton, IonIcon, IonLabel, IonCheckbox
  ]
})
export class RegisterClientPage {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private alertController = inject(AlertController);
  private socialAuthService = inject(SocialAuthService);

  registerForm: FormGroup;
  isLoading = false;

  constructor() {
    this.registerForm = this.createForm();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      email: ['', [Validators.required, Validators.email, this.strictEmailValidator]],
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(/^(\+56|56)?\s?9\s?[0-9]{4}\s?[0-9]{4}$/)]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        this.uppercaseValidator,
        this.numberValidator
      ]],
      confirmPassword: ['', [Validators.required]],
      termsAccepted: [false, [Validators.requiredTrue]],
      emailOptIn: [false]
    }, { validator: this.passwordMatchValidator });
  }

  // ==================== VALIDADORES ====================

  strictEmailValidator(control: FormControl): ValidationErrors | null {
    if (!control.value) return null;
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(control.value)) {
      return { strictEmail: true };
    }
    return null;
  }

  uppercaseValidator(control: FormControl): ValidationErrors | null {
    if (!control.value) return null;
    return /[A-Z]/.test(control.value) ? null : { uppercaseRequired: true };
  }

  numberValidator(control: FormControl): ValidationErrors | null {
    if (!control.value) return null;
    return /[0-9]/.test(control.value) ? null : { numberRequired: true };
  }

  passwordMatchValidator(g: FormGroup): ValidationErrors | null {
    const password = g.get('password')?.value;
    const confirmPassword = g.get('confirmPassword')?.value;
    if (password !== confirmPassword) {
      g.get('confirmPassword')?.setErrors({ mismatch: true });
      return { mismatch: true };
    }
    return null;
  }

  formatPhone(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    if (value.startsWith('56') && value.length === 11) {
      value = value.substring(2);
    }
    if (value.startsWith('9') && value.length === 9) {
      value = `+56 ${value.substring(0, 1)} ${value.substring(1, 5)} ${value.substring(5)}`;
    }
    this.registerForm.patchValue({ phone: value });
  }

  // ==================== SUBMIT ====================

  async onSubmit(): Promise<void> {
    if (this.registerForm.valid && !this.isLoading) {
      this.isLoading = true;
      
      const { confirmPassword, ...data } = this.registerForm.value;
      const phone = data.phone.replace(/\s/g, '');
      
      // ══ AVATAR POR DEFECTO ══════════════════════════════════════
      // Si el usuario NO subió avatar, asignar automáticamente el avatar por defecto
      const defaultAvatar = 'https://res.cloudinary.com/dghwotofx/image/upload/v1769918403/default-avatar_e2c4t0.png';
      const avatarToSend = data.avatar && data.avatar.trim() !== '' ? data.avatar : defaultAvatar;
      
      // ══ RATING INICIAL ═══════════════════════════════════════════
      // Asignar rating inicial = 5 (el backend debe manejarlo, pero lo enviamos por compatibilidad)
      const rating_avg = 5;
      
      this.authService.registerClient({
        email: data.email,
        password: data.password,
        full_name: data.fullName,
        phone: phone,
        avatar: avatarToSend,
        rating_avg: rating_avg,
        terms_accepted: data.termsAccepted,
        email_opt_in: data.emailOptIn
      }).subscribe({
        next: async () => {
          this.isLoading = false;
          const alert = await this.alertController.create({
            header: 'Registro Exitoso',
            message: 'Tu cuenta ha sido creada correctamente.',
            buttons: [{ 
              text: 'Continuar', 
              handler: () => this.router.navigate(['/auth/login']) 
            }]
          });
          await alert.present();
        },
        error: async (error) => {
          this.isLoading = false;
          const detail = error?.error?.detail;
          let errorMessage = 'Error al registrar. Intenta nuevamente.';
          
          if (detail === 'Email already registered') {
            errorMessage = 'Este email ya está registrado.';
          } else if (detail === 'Phone already registered') {
            errorMessage = 'Este teléfono ya está registrado.';
          } else if (detail) {
            errorMessage = detail;
          }
          
          const alert = await this.alertController.create({
            header: 'Error de Registro',
            message: errorMessage,
            buttons: ['OK']
          });
          await alert.present();
        }
      });
    } else {
      // Marcar todos los campos como tocados para mostrar errores
      Object.keys(this.registerForm.controls).forEach(key => {
        this.registerForm.get(key)?.markAsTouched();
      });
      this.showAlert('Error', 'Por favor completa todos los campos requeridos correctamente.');
    }
  }

  async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  // ==================== REGISTRO SOCIAL ====================

  registerWithGoogle(): void {
    this.isLoading = true;
    this.signInWithRetry(GoogleLoginProvider.PROVIDER_ID)
      .then((socialUser) => {
        this.authService.loginWithGoogle(socialUser.idToken || '', 'CLIENT').subscribe({
          next: (response) => {
            this.isLoading = false;
            this.handleOAuthNavigation(response.role, response.terms_accepted);
          },
          error: (error) => {
            this.isLoading = false;
            this.showAlert('Error', error.error?.detail || 'Error al registrarse con Google');
          }
        });
      })
      .catch((error) => {
        this.isLoading = false;
        if (error?.error !== 'popup_closed_by_user') {
          this.showAlert('Error', this.getSocialErrorMessage(error, 'Google'));
        }
      });
  }

  registerWithFacebook(): void {
    this.isLoading = true;
    this.signInWithRetry(FacebookLoginProvider.PROVIDER_ID)
      .then((socialUser) => {
        this.authService.loginWithFacebook(socialUser.authToken || '', 'CLIENT').subscribe({
          next: (response) => {
            this.isLoading = false;
            this.handleOAuthNavigation(response.role, response.terms_accepted);
          },
          error: (error) => {
            this.isLoading = false;
            this.showAlert('Error', error.error?.detail || 'Error al registrarse con Facebook');
          }
        });
      })
      .catch((error) => {
        this.isLoading = false;
        if (error?.error !== 'popup_closed_by_user') {
          this.showAlert('Error', this.getSocialErrorMessage(error, 'Facebook'));
        }
      });
  }

  private handleOAuthNavigation(role: string, termsAccepted: boolean = true): void {
    if (!termsAccepted) {
      this.router.navigate(['/auth/terms-acceptance']);
      return;
    }
    this.router.navigate(['/client/categories']);
  }

  private async signInWithRetry(providerId: string, retries = 2): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.socialAuthService.signIn(providerId);
      } catch (err: any) {
        if (err?.message?.toLowerCase().includes('not ready') && attempt < retries) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        throw err;
      }
    }
  }

  private getSocialErrorMessage(error: any, provider: string): string {
    const msg: string = error?.message ?? '';
    if (msg.toLowerCase().includes('not ready')) {
      return `El servicio de ${provider} no está disponible. Verifica tu conexión e intenta nuevamente.`;
    }
    return `No se pudo conectar con ${provider}`;
  }
}
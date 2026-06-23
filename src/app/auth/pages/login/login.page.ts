// src/app/auth/pages/login/login.page.ts
import { Component, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import {
  IonContent, IonLabel, IonItem, IonIcon, IonInput, IonButton,
  IonCheckbox, IonRow, IonCol, IonSpinner, IonModal, IonList, IonText,
  IonSegment, IonSegmentButton, ModalController // ¡AGREGAR ESTO!
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { SocialAuthService, GoogleLoginProvider, FacebookLoginProvider } from '@abacritt/angularx-social-login';
import { signal } from '@angular/core';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    IonContent,
    IonLabel,
    IonItem,
    IonIcon,
    IonInput,
    IonButton,
    IonCheckbox,
    IonRow,
    IonCol,
    IonSpinner,
    IonModal,
    IonList,
    IonText,
    IonSegment,
    IonSegmentButton
  ]
})
export class LoginPage implements OnInit, OnDestroy {
  @ViewChild(IonModal) modal!: IonModal;
  
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private modalController = inject(ModalController);
  private socialAuthService = inject(SocialAuthService);
  
  loginForm: FormGroup;
  registerForm: FormGroup;
  activeTab = signal<'login' | 'register'>('login');
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  sessionExpired = false;
  showPassword = false;
  showRegisterPassword = false;
  showConfirmPassword = false;
  isRetrying = false;
  retryCountdown = 0;
  private retryAttempts = 0;
  private readonly maxRetryAttempts = 2;
  private retryTimerRef: any = null;

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });

    this.registerForm = this.fb.group({
      full_name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      terms_accepted: [false, [Validators.requiredTrue]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  ngOnInit(): void {
    // Verificar si la sesión expiró
    this.route.queryParams.subscribe(params => {
      if (params['sessionExpired']) {
        this.sessionExpired = true;
        this.errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
      }
      if (params['tab'] === 'register') {
        this.activeTab.set('register');
      }
    });
  }

  setTab(tab: 'login' | 'register') {
    this.activeTab.set(tab);
    this.errorMessage = '';
    this.successMessage = '';
  }

  onRegisterSubmit() {
    if (this.registerForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const data = {
        email: this.registerForm.value.email,
        password: this.registerForm.value.password,
        full_name: this.registerForm.value.full_name,
        role: 'CLIENT'
      };

      console.log("📤 Registrando cliente:", data.email);

      this.authService.registerClient(data).subscribe({
        next: (resp) => {
          this.isLoading = false;
          console.log('✅ Registro exitoso', resp);
          this.successMessage = 'Cuenta creada exitosamente. Por favor, inicia sesión.';
          this.activeTab.set('login');
          this.loginForm.patchValue({ email: data.email });
        },
        error: (err) => {
          this.isLoading = false;
          console.error('❌ Error en registro:', err);
          this.errorMessage = err.error?.detail || err.error?.message || 'Error al crear la cuenta';
        }
      });
    } else {
      this.markFormGroupTouched(this.registerForm);
    }
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.sessionExpired = false;

      const credentials = {
        email: this.loginForm.value.email,
        password: this.loginForm.value.password
      };

      console.log("📤 Credenciales a enviar:", credentials.email);

      this.authService.loginClient(credentials).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.retryAttempts = 0;
          console.log('✅ Login exitoso', response);

          if (response.role === 'CLIENT') {
            console.log("👤 CLIENTE - Redirigiendo a categorías");
            this.router.navigate(['/client/categories']);
          } else if (response.role === 'PROVIDER') {
            console.log("🔧 PROVEEDOR - Redirigiendo a tabs");
            this.redirectToMainCategories();
          } else {
            this.router.navigate(['/home']);
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('❌ Error en login:', error);

          if (error.status === 0 && this.retryAttempts < this.maxRetryAttempts) {
            this.retryAttempts++;
            this.scheduleLoginRetry(credentials);
          } else if (error.status === 422) {
            this.retryAttempts = 0;
            this.errorMessage = 'Error de validación: ' + this.getValidationErrors(error);
          } else if (error.status === 401) {
            this.retryAttempts = 0;
            this.errorMessage = 'Email o contraseña incorrectos ¿Olvidaste tu contraseña?';
          } else if (error.status === 500) {
            this.retryAttempts = 0;
            this.errorMessage = 'Error del servidor. Intenta más tarde.';
          } else if (error.status === 0) {
            this.retryAttempts = 0;
            this.errorMessage = 'El servidor no responde. Espera unos segundos e inténtalo nuevamente.';
          } else {
            this.retryAttempts = 0;
            this.errorMessage = error.error?.detail || error.error?.message || 'Error desconocido';
          }
        }
      });
    } else {
      this.markFormGroupTouched();
      this.errorMessage = 'Por favor completa todos los campos correctamente';
    }
  }

  ngOnDestroy(): void {
    if (this.retryTimerRef) {
      clearInterval(this.retryTimerRef);
    }
  }

  private scheduleLoginRetry(credentials: { email: string; password: string }): void {
    this.isRetrying = true;
    this.retryCountdown = 10;

    this.retryTimerRef = setInterval(() => {
      this.retryCountdown--;
      if (this.retryCountdown <= 0) {
        clearInterval(this.retryTimerRef);
        this.retryTimerRef = null;
        this.isRetrying = false;
        this.isLoading = true;
        this.authService.loginClient(credentials).subscribe({
          next: (response) => {
            this.isLoading = false;
            this.retryAttempts = 0;
            if (response.role === 'CLIENT') {
              this.router.navigate(['/client/categories']);
            } else if (response.role === 'PROVIDER') {
              this.redirectToMainCategories();
            } else {
              this.router.navigate(['/home']);
            }
          },
          error: (error) => {
            this.isLoading = false;
            if (error.status === 0 && this.retryAttempts < this.maxRetryAttempts) {
              this.retryAttempts++;
              this.scheduleLoginRetry(credentials);
            } else {
              this.retryAttempts = 0;
              this.errorMessage = 'El servidor no responde. Espera unos segundos e inténtalo nuevamente.';
            }
          }
        });
      }
    }, 1000);
  }

  private redirectToMainCategories(): void {
    console.log('🔄 Redirigiendo a Provider Tabs');
    this.router.navigate(['/provider/tabs']);
  }

  private getValidationErrors(error: any): string {
    if (error.error && error.error.detail) {
      if (Array.isArray(error.error.detail)) {
        return error.error.detail.map((err: any) => err.msg).join(', ');
      }
      return error.error.detail;
    }
    return 'Datos de formulario inválidos';
  }

  onSubmitJson(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';

      const credentials = {
        email: this.loginForm.value.email,
        password: this.loginForm.value.password
      };

      console.log("📤 Usando método JSON:", credentials);

      this.authService.loginClientJson(credentials).subscribe({
        next: (response) => {
          this.isLoading = false;
          console.log('✅ Login JSON exitoso', response);
          this.redirectToMainCategories();
        },
        error: (error) => {
          this.isLoading = false;
          console.error('❌ Error en login JSON:', error);
          this.errorMessage = this.getErrorMessage(error);
        }
      });
    }
  }

  private getErrorMessage(error: any): string {
    if (error.status === 404) {
      return 'Endpoint no encontrado. El backend necesita actualizarse.';
    }
    return error.error?.detail || error.error?.message || 'Error en el login';
  }

  private markFormGroupTouched(form: FormGroup = this.loginForm): void {
    Object.keys(form.controls).forEach(key => {
      const control = form.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
  }

  loginWithFacebook(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const wasRegistering = this.activeTab() === 'register';
    
    this.signInWithRetry(FacebookLoginProvider.PROVIDER_ID)
      .then((socialUser) => {
        this.authService.loginWithFacebook(socialUser.authToken || '').subscribe({
          next: (response) => {
            this.isLoading = false;
            
            if (wasRegistering && !response.is_new_user) {
              this.successMessage = 'Ya tienes una cuenta con este correo. Hemos iniciado sesión por ti.';
              setTimeout(() => {
                this.handleOAuthNavigation(response.role, response.terms_accepted);
              }, 2000);
            } else {
              this.handleOAuthNavigation(response.role, response.terms_accepted);
            }
          },
          error: (error) => {
            this.isLoading = false;
            this.errorMessage = error.error?.detail || 'Error en login con Facebook';
          }
        });
      })
      .catch((error) => {
        this.isLoading = false;
        if (error?.error === 'popup_closed_by_user') return;
        this.errorMessage = this.getSocialErrorMessage(error, 'Facebook');
        console.error('Error en Facebook signIn:', error);
      });
  }

  loginWithGoogle(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const wasRegistering = this.activeTab() === 'register';

    this.signInWithRetry(GoogleLoginProvider.PROVIDER_ID)
      .then((socialUser) => {
        this.authService.loginWithGoogle(socialUser.idToken || '').subscribe({
          next: (response) => {
            this.isLoading = false;
            
            if (wasRegistering && !response.is_new_user) {
              this.successMessage = 'Ya tienes una cuenta con este correo. Hemos iniciado sesión por ti.';
              setTimeout(() => {
                this.handleOAuthNavigation(response.role, response.terms_accepted);
              }, 2000);
            } else {
              this.handleOAuthNavigation(response.role, response.terms_accepted);
            }
          },
          error: (error) => {
            this.isLoading = false;
            this.errorMessage = error.error?.detail || 'Error en login con Google';
          }
        });
      })
      .catch((error) => {
        this.isLoading = false;
        if (error?.error === 'popup_closed_by_user') return;
        this.errorMessage = this.getSocialErrorMessage(error, 'Google');
        console.error('Error en Google signIn:', error);
      });
  }

  /**
   * Intenta signIn y reintenta una vez si el SDK aún no está listo (timing).
   * El SDK de Google/Facebook puede tardar 1-2s en inicializarse tras cargar la página.
   */
  private async signInWithRetry(providerId: string, retries = 2): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.socialAuthService.signIn(providerId);
      } catch (err: any) {
        const notReady = err?.message?.toLowerCase().includes('not ready');
        if (notReady && attempt < retries) {
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
      return `El servicio de login con ${provider} no está disponible. Verifica tu conexión e intenta nuevamente.`;
    }
    return `No se pudo conectar con ${provider}`;
  }

  private handleOAuthNavigation(role: string, termsAccepted: boolean = true): void {
    // Usuario OAuth que aún no aceptó los T&C → pantalla de aceptación
    if (!termsAccepted) {
      this.router.navigate(['/auth/terms-acceptance']);
      return;
    }
    if (role === 'PROVIDER') {
      this.router.navigate(['/provider/tabs']);
    } else {
      this.router.navigate(['/client/categories']);
    }
  }

  // Getters para validación en template
  get emailControl() {
    return this.loginForm.get('email');
  }

  get passwordControl() {
    return this.loginForm.get('password');
  }

  getEmailError(): string {
    const control = this.emailControl;
    if (control?.touched && control.errors) {
      if (control.errors['required']) return 'Email es requerido';
      if (control.errors['email']) return 'Email no válido';
    }
    return '';
  }

  getPasswordError(): string {
    const control = this.passwordControl;
    if (control?.touched && control.errors) {
      if (control.errors['required']) return 'Contraseña es requerida';
      if (control.errors['minlength']) return 'Mínimo 6 caracteres';
    }
    return '';
  }

  // ========== CORRECCIÓN DEL MODAL ==========
  
  async onRegisterClient(): Promise<void> {
    try {
      // Primero cerrar el modal
      if (this.modal) {
        await this.modal.dismiss();
      }
      // Luego navegar después de que el modal se cierre
      setTimeout(() => {
        this.router.navigate(['/auth/register-client']);
      }, 100);
    } catch (error) {
      console.error('Error cerrando modal:', error);
      // Si hay error cerrando el modal, navegar de todos modos
      this.router.navigate(['/auth/register-client']);
    }
  }
  
  async onRegisterProvider(): Promise<void> {
    try {
      // Primero cerrar el modal
      if (this.modal) {
        await this.modal.dismiss();
      }
      // Luego navegar después de que el modal se cierre
      setTimeout(() => {
        this.router.navigate(['/auth/register-provider']);
      }, 100);
    } catch (error) {
      console.error('Error cerrando modal:', error);
      // Si hay error cerrando el modal, navegar de todos modos
      this.router.navigate(['/auth/register-provider']);
    }
  }

  // Método alternativo usando ModalController
  async closeModalAndNavigate(route: string): Promise<void> {
    try {
      // Intentar cerrar cualquier modal activo
      const topModal = await this.modalController.getTop();
      if (topModal) {
        await topModal.dismiss();
      }
      
      // Esperar un momento para que el modal se cierre completamente
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Navegar a la ruta
      this.router.navigate([route]);
    } catch (error) {
      console.error('Error cerrando modal:', error);
      // Si falla, navegar de todos modos
      this.router.navigate([route]);
    }
  }

  // Navegación
  onBack(): void {
    this.router.navigate(['/home']);
  }

  onHome(): void {
    this.router.navigate(['/home']);
  }

  onReset(): void {
    this.router.navigate(['/auth/reset-password']);
  }
}
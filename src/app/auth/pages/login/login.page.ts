// src/app/auth/pages/login/login.page.ts
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import {
  IonContent, IonLabel, IonIcon, IonInput, IonButton,
  IonCheckbox, IonSpinner,
  IonSegment, IonSegmentButton, ModalController, AlertController
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { SocialAuthService, GoogleLoginProvider, FacebookLoginProvider } from '@abacritt/angularx-social-login';

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
    IonIcon,
    IonInput,
    IonButton,
    IonCheckbox,
    IonSpinner,
    IonSegment,
    IonSegmentButton
  ]
})
export class LoginPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly modalController = inject(ModalController);
  private readonly alertController = inject(AlertController);
  private readonly socialAuthService = inject(SocialAuthService);
  
  loginForm: FormGroup;
  registerForm: FormGroup;
  activeTab = signal<'login' | 'register'>('login');
  registerRole = signal<'client' | 'provider'>('client');
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
  loginRolePrompt = false;
  loginRoleOptions: Array<'CLIENT' | 'PROVIDER'> = [];
  private pendingLoginCredentials: { email: string; password: string } | null = null;
  socialRolePrompt = false;
  socialRoleOptions: Array<'CLIENT' | 'PROVIDER'> = [];
  private pendingSocialLogin: { provider: 'google' | 'facebook'; token: string; email: string; wasRegistering: boolean } | null = null;

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });

    this.registerForm = this.fb.group({
      full_name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^(\+56|56)?\s?9\s?\d{4}\s?\d{4}$/)]],
      run: [''],
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
      if (params['emailVerified'] === 'true') {
        this.activeTab.set('login');
        this.successMessage = 'Correo verificado correctamente. Ahora puedes iniciar sesión.';
      }
    });
  }

  setTab(tab: 'login' | 'register') {
    this.activeTab.set(tab);
    if (tab === 'register') this.registerRole.set('client');
    this.loginRolePrompt = false;
    this.pendingLoginCredentials = null;
    this.socialRolePrompt = false;
    this.pendingSocialLogin = null;
    this.errorMessage = '';
    this.successMessage = '';
  }

  setRegisterRole(role: 'client' | 'provider') {
    this.registerRole.set(role);
  }

  onRegisterSubmit() {
    if (this.registerForm.valid) {
      if (this.registerRole() === 'provider' && !this.registerForm.value.run) {
        this.errorMessage = 'El RUT es requerido para proveedores';
        return;
      }

      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const data = {
        email: this.normalizeEmail(this.registerForm.value.email),
        password: this.registerForm.value.password,
        full_name: this.registerForm.value.full_name,
        phone: this.registerForm.value.phone,
        run: this.registerForm.value.run,
        terms_accepted: this.registerForm.value.terms_accepted,
        registration_source: 'mobile' as const,
        role: this.registerRole() === 'provider' ? 'PROVIDER' : 'CLIENT'
      };

      console.log("📤 Registrando usuario:", data.email, data.role);

      const register$ = data.role === 'PROVIDER'
        ? this.authService.registerProvider(data)
        : this.authService.registerClient(data);

      register$.subscribe({
        next: (resp) => {
          this.isLoading = false;
          console.log('✅ Registro exitoso', resp);
          this.successMessage = 'Cuenta creada exitosamente. Revisa tu correo y valida tu cuenta desde el enlace para iniciar sesión.';
          this.activeTab.set('login');
          this.loginForm.patchValue({ email: data.email });
        },
        error: (err) => {
          this.isLoading = false;
          console.error('❌ Error en registro:', err);
          
          const detail = err.error?.detail || err.error?.message;
          
          if (detail === 'Email already registered' || (typeof detail === 'string' && detail.includes('already registered'))) {
            this.errorMessage = this.registerRole() === 'provider'
              ? 'Este correo ya tiene perfil proveedor. Inicia sesión para continuar.'
              : 'Este correo ya tiene perfil cliente. Inicia sesión para continuar.';
            // Opcional: mover al tab de login automáticamente tras 2 segundos
            setTimeout(() => {
              this.activeTab.set('login');
              this.loginForm.patchValue({ email: this.registerForm.value.email });
            }, 2000);
          } else {
            this.errorMessage = detail || 'Error al crear la cuenta';
          }
        }
      });
    } else {
      this.markFormGroupTouched(this.registerForm);
    }
  }

  private normalizeEmail(value: string): string {
    return String(value || '').trim().toLowerCase();
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.sessionExpired = false;
      this.loginRolePrompt = false;

      const credentials = {
        email: this.loginForm.value.email,
        password: this.loginForm.value.password
      };

      console.log("📤 Credenciales a enviar:", credentials.email);

      this.authService.getLoginRoles(credentials.email).subscribe({
        next: (rolesResponse) => {
          const roles = rolesResponse.roles || [];
          if (roles.length > 1) {
            this.pendingLoginCredentials = credentials;
            this.loginRoleOptions = roles;
            this.loginRolePrompt = true;
            this.isLoading = false;
            return;
          }

          const role = roles.length === 1 ? roles[0] : undefined;
          this.executeLogin(credentials, role);
        },
        error: () => {
          this.executeLogin(credentials);
        }
      });
    } else {
      this.markFormGroupTouched();
      this.errorMessage = 'Por favor completa todos los campos correctamente';
    }
  }

  selectLoginRole(role: 'CLIENT' | 'PROVIDER'): void {
    if (!this.pendingLoginCredentials) return;
    this.isLoading = true;
    this.errorMessage = '';
    this.executeLogin(this.pendingLoginCredentials, role);
  }

  private executeLogin(credentials: { email: string; password: string }, role?: 'CLIENT' | 'PROVIDER'): void {
    this.authService.loginClient({ ...credentials, role }).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.retryAttempts = 0;
          this.loginRolePrompt = false;
          this.pendingLoginCredentials = null;
          console.log('✅ Login exitoso', response);
          this.handleRoleBasedNavigation(response.role);
        },
        error: (error) => {
          this.isLoading = false;
          console.error('❌ Error en login:', error);

          const authError = this.parseAuthError(error);
          if (error?.status === 409 && authError.code === 'ROLE_SELECTION_REQUIRED') {
            this.pendingLoginCredentials = credentials;
            this.loginRoleOptions = authError.roles || [];
            this.loginRolePrompt = true;
            return;
          }

          if (error?.status === 403 && (authError.code === 'EMAIL_NOT_VERIFIED' || authError.isEmailNotVerified)) {
            this.authService.resendVerificationEmail(credentials.email, 'mobile').subscribe({ error: () => {} });
            this.errorMessage = authError.message || 'Debes verificar tu correo electrónico para iniciar sesión.';
            this.successMessage = 'Te reenviamos un correo de verificación. Revisa tu bandeja de entrada y spam.';
            return;
          }

          if (error.status === 0 && this.retryAttempts < this.maxRetryAttempts) {
            this.retryAttempts++;
            this.scheduleLoginRetry({ ...credentials, role });
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
            this.errorMessage = authError.message || error.error?.detail || error.error?.message || 'Error desconocido';
          }
        }
      });
  }

  private parseAuthError(error: any): { code?: string; message?: string; roles?: Array<'CLIENT' | 'PROVIDER'>; isEmailNotVerified: boolean } {
    const response = error?.error ?? {};
    const detail = response?.detail;
    const detailObject = (detail && typeof detail === 'object') ? detail : undefined;
    const topLevelObject = (response && typeof response === 'object') ? response : undefined;

    const code = detailObject?.code ?? topLevelObject?.code;
    const rolesRaw = detailObject?.roles ?? topLevelObject?.roles;
    const messageFromDetail = typeof detail === 'string' ? detail : detailObject?.message;
    const message = messageFromDetail || topLevelObject?.message || '';

    const normalized = String(message || '').toLowerCase();
    const isEmailNotVerified =
      code === 'EMAIL_NOT_VERIFIED' ||
      normalized.includes('verificar tu correo') ||
      normalized.includes('email_not_verified');

    return {
      code,
      message: message || undefined,
      roles: Array.isArray(rolesRaw) ? rolesRaw : undefined,
      isEmailNotVerified,
    };
  }

  ngOnDestroy(): void {
    if (this.retryTimerRef) {
      clearInterval(this.retryTimerRef);
    }
  }

  private scheduleLoginRetry(credentials: { email: string; password: string; role?: 'CLIENT' | 'PROVIDER' }): void {
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
            this.handleRoleBasedNavigation(response.role);
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

  private handleRoleBasedNavigation(role: string): void {
    if (role === 'PROVIDER') {
      this.redirectToMainCategories();
      return;
    }
    if (role === 'CLIENT') {
      this.router.navigate(['/client/categories']);
      return;
    }
    this.router.navigate(['/home']);
  }

  private getValidationErrors(error: any): string {
    if (error.error?.detail) {
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
    
    this.signInWithRetry(FacebookLoginProvider.PROVIDER_ID, {
      scope: 'public_profile,email',
      return_scopes: true,
      auth_type: 'rerequest',
    })
      .then((socialUser) => {
        this.resolveSocialLoginRole('facebook', socialUser.authToken || '', socialUser.email || '', wasRegistering);
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
        this.resolveSocialLoginRole('google', socialUser.idToken || '', socialUser.email || '', wasRegistering);
      })
      .catch((error) => {
        this.isLoading = false;
        if (error?.error === 'popup_closed_by_user') return;
        this.errorMessage = this.getSocialErrorMessage(error, 'Google');
        console.error('Error en Google signIn:', error);
      });
  }

  selectSocialLoginRole(role: 'CLIENT' | 'PROVIDER'): void {
    if (!this.pendingSocialLogin) return;
    this.isLoading = true;
    this.errorMessage = '';
    this.continueSocialLogin(this.pendingSocialLogin, role);
  }

  private resolveSocialLoginRole(
    provider: 'google' | 'facebook',
    token: string,
    email: string,
    wasRegistering: boolean,
  ): void {
    const pending = { provider, token, email, wasRegistering };
    const requestedRole = (wasRegistering ? this.registerRole().toUpperCase() : 'CLIENT') as 'CLIENT' | 'PROVIDER';

    this.socialRolePrompt = false;
    this.pendingSocialLogin = null;

    if (wasRegistering) {
      this.continueSocialLogin(pending, requestedRole);
      return;
    }

    if (!email) {
      this.continueSocialLogin(pending, 'CLIENT');
      return;
    }

    this.authService.getLoginRoles(email).subscribe({
      next: (rolesResponse) => {
        const roles = rolesResponse.roles || [];
        if (roles.length > 1) {
          this.pendingSocialLogin = pending;
          this.socialRoleOptions = roles;
          this.socialRolePrompt = true;
          this.isLoading = false;
          return;
        }

        const role = roles.length === 1 ? roles[0] : 'CLIENT';
        this.continueSocialLogin(pending, role);
      },
      error: () => {
        this.continueSocialLogin(pending, 'CLIENT');
      }
    });
  }

  private continueSocialLogin(
    pending: { provider: 'google' | 'facebook'; token: string; email: string; wasRegistering: boolean },
    role: 'CLIENT' | 'PROVIDER'
  ): void {
    const request$ = pending.provider === 'google'
      ? this.authService.loginWithGoogle(pending.token, role)
      : this.authService.loginWithFacebook(pending.token, role, pending.email);

    request$.subscribe({
      next: (response) => {
        this.isLoading = false;
        this.socialRolePrompt = false;
        this.pendingSocialLogin = null;

        if (pending.wasRegistering && !response.is_new_user) {
          this.successMessage = 'Ya tienes una cuenta con este correo. Hemos iniciado sesión por ti.';
          setTimeout(() => {
            this.handleOAuthNavigation(response.role, response.terms_accepted);
          }, 2000);
        } else {
          this.handleOAuthNavigation(response.role, response.terms_accepted);
        }
      },
      error: (error) => {
        if (pending.provider === 'facebook' && this.isFacebookMissingEmailError(error)) {
          this.handleFacebookEmailFallback(pending, role);
          return;
        }

        this.isLoading = false;
        this.errorMessage = error.error?.detail || `Error en login con ${pending.provider === 'google' ? 'Google' : 'Facebook'}`;
      }
    });
  }

  private isFacebookMissingEmailError(error: any): boolean {
    const detail = String(error?.error?.detail ?? error?.message ?? '').toLowerCase();
    return detail.includes('facebook') && detail.includes('email') && detail.includes('no proporcion');
  }

  private async handleFacebookEmailFallback(
    pending: { provider: 'google' | 'facebook'; token: string; email: string; wasRegistering: boolean },
    role: 'CLIENT' | 'PROVIDER'
  ): Promise<void> {
    const manualEmail = await this.promptFacebookEmailFallback();
    if (!manualEmail) {
      this.isLoading = false;
      this.errorMessage = 'Facebook no devolvió tu correo. Debes ingresarlo para continuar.';
      return;
    }

    this.authService.loginWithFacebook(pending.token, role, manualEmail).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.socialRolePrompt = false;
        this.pendingSocialLogin = null;
        if (pending.wasRegistering && !response.is_new_user) {
          this.successMessage = 'Ya tienes una cuenta con este correo. Hemos iniciado sesión por ti.';
          setTimeout(() => {
            this.handleOAuthNavigation(response.role, response.terms_accepted);
          }, 2000);
        } else {
          this.handleOAuthNavigation(response.role, response.terms_accepted);
        }
      },
      error: (fallbackError) => {
        this.isLoading = false;
        this.errorMessage = fallbackError?.error?.detail || 'No fue posible completar el login con Facebook';
      }
    });
  }

  private async promptFacebookEmailFallback(): Promise<string | null> {
    const alert = await this.alertController.create({
      header: 'Correo requerido',
      message: 'Facebook no devolvió tu correo. Ingresa tu email para continuar.',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'tu@email.com',
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Continuar', role: 'confirm' },
      ],
    });

    await alert.present();
    const result = await alert.onDidDismiss();
    if (result.role !== 'confirm') return null;
    const email = String(result.data?.values?.email ?? '').trim().toLowerCase();
    if (!email) return null;
    return this.isBasicValidEmail(email) ? email : null;
  }

  private isBasicValidEmail(email: string): boolean {
    if (!email || email.includes(' ')) return false;
    const at = email.indexOf('@');
    const dot = email.lastIndexOf('.');
    return at > 0 && dot > at + 1 && dot < email.length - 1;
  }

  /**
   * Intenta signIn y reintenta una vez si el SDK aún no está listo (timing).
   * El SDK de Google/Facebook puede tardar 1-2s en inicializarse tras cargar la página.
   */
  private async signInWithRetry(providerId: string, options?: any, retries = 2): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.socialAuthService.signIn(providerId, options);
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
    await this.closeModalAndNavigate('/auth/register-client');
  }
  
  async onRegisterProvider(): Promise<void> {
    await this.closeModalAndNavigate('/auth/register-provider');
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
    // Evita dejar foco dentro de una vista que Ionic ocultará con aria-hidden al navegar.
    const activeEl = document.activeElement as HTMLElement | null;
    activeEl?.blur();
    this.router.navigate(['/auth/reset-password']);
  }
}
// src/app/auth/pages/register-provider/register-provider.page.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonIcon,
  IonInput, IonLabel, IonSpinner, AlertController, LoadingController,
  IonCheckbox
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { CameraService } from '../../../shared/services/camera.service';
import { SocialAuthService, GoogleLoginProvider, FacebookLoginProvider } from '@abacritt/angularx-social-login';
import { ContentFilterService } from '../../../shared/services/content-filter.service';
import { offensiveContentAsyncValidator } from '../../../shared/validators/content-filter.validators';

@Component({
  selector: 'app-register-provider',
  templateUrl: './register-provider.page.html',
  styleUrls: ['./register-provider.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonIcon,
    IonInput, IonLabel, IonSpinner, IonCheckbox
  ]
})
export class RegisterProviderPage implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private cameraService = inject(CameraService);
  private router = inject(Router);
  private alertController = inject(AlertController);
  private loadingController = inject(LoadingController);
  private socialAuthService = inject(SocialAuthService);
  private contentFilterService = inject(ContentFilterService);

  registerForm: FormGroup;
  isLoading = false;
  avatarPreview: string | null = null;
  isTakingPhoto = false;
  showPassword = false;
  showConfirmPassword = false;

  constructor() {
    this.registerForm = this.createForm();
  }

  ngOnInit(): void {}

  private createForm(): FormGroup {
    return this.fb.group({
      email: ['', [Validators.required, Validators.email, this.strictEmailValidator]],
      run: ['', [this.rutValidator]], // Eliminamos Validators.required
      password: ['', [
        Validators.required, 
        Validators.minLength(8),
        this.uppercaseValidator,
        this.numberValidator
      ]],
      confirmPassword: ['', [Validators.required]],
      fullName: ['', {
        validators: [Validators.required, Validators.minLength(2)],
        asyncValidators: [offensiveContentAsyncValidator(this.contentFilterService, 'profile')],
        updateOn: 'change',
      }],
      phone: ['', [this.phoneValidator.bind(this)]], // Eliminamos Validators.required
      bio: [''],
      avatar: [''],
      termsAccepted: [false, [Validators.requiredTrue]],
      emailOptIn: [false]
    }, { validator: this.passwordMatchValidator });
  }

  // ==================== AVATAR ====================

  async takePhoto(): Promise<void> {
    try {
      const alert = await this.alertController.create({
        header: 'Foto de Perfil',
        message: '¿Cómo quieres agregar tu foto de perfil?',
        cssClass: 'custom-alert-dark',
        buttons: [
          { 
            text: 'Tomar Foto', 
            handler: async () => {
              alert.dismiss();
              setTimeout(() => this.takeNewPhoto(), 100);
              return false;
            }
          },
          { 
            text: 'Desde Galería', 
            handler: async () => {
              alert.dismiss();
              setTimeout(() => this.selectFromGallery(), 100);
              return false;
            }
          },
          { 
            text: 'Cancelar', 
            role: 'cancel',
            handler: () => {
              this.isTakingPhoto = false;
            }
          }
        ]
      });
      
      await alert.present();
    } catch (error) {
      console.error('Error en alerta de foto:', error);
      this.showAlert('Error', 'No se pudo mostrar las opciones');
    }
  }

  async takeNewPhoto(): Promise<void> {
    try {
      this.isTakingPhoto = true;
      const base64Data = await this.cameraService.takePicture();
      await this.processAvatar(base64Data);
    } catch (error) {
      this.showAlert('Error', 'No se pudo tomar la foto');
    } finally {
      this.isTakingPhoto = false;
    }
  }

  async selectFromGallery(): Promise<void> {
    try {
      this.isTakingPhoto = true;
      const base64Data = await this.cameraService.selectFromGallery();
      await this.processAvatar(base64Data);
    } catch (error) {
      this.showAlert('Error', 'No se pudo seleccionar la imagen');
    } finally {
      this.isTakingPhoto = false;
    }
  }

  async processAvatar(base64Data: string): Promise<void> {
    const loading = await this.loadingController.create({
      message: 'Procesando imagen...'
    });
    await loading.present();

    try {
      let processedData = base64Data;
      if (!base64Data.startsWith('data:image')) {
        processedData = `data:image/jpeg;base64,${base64Data}`;
      }

      const compressedData = await this.cameraService.compressImageForBlob(processedData, 400, 0.5);
      
      this.avatarPreview = compressedData;
      this.registerForm.patchValue({ avatar: compressedData });
      
      await loading.dismiss();
      this.showAlert('Éxito', 'Foto de perfil agregada correctamente');
    } catch (error) {
      await loading.dismiss();
      this.showAlert('Error', 'No se pudo procesar la imagen');
    }
  }

  removeAvatar(): void {
    this.avatarPreview = null;
    this.registerForm.patchValue({ avatar: '' });
  }

  togglePasswordVisibility(field: 'password' | 'confirm'): void {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
      return;
    }
    this.showConfirmPassword = !this.showConfirmPassword;
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

  rutValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const rut = control.value.toString().toUpperCase();
    const formatoValido = /^[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9K]$|^[0-9]{7,8}-[0-9K]$|^[0-9]{7,8}[0-9K]$/.test(rut);
    
    if (!formatoValido) return { rutFormat: true };

    const rutLimpio = rut.replace(/[\.\-\s]/g, '');
    if (rutLimpio.length < 8 || rutLimpio.length > 9) return { rutFormat: true };
    if (!RegisterProviderPage.validarRUT(rutLimpio)) return { rutInvalid: true };

    return null;
  }

  private static validarRUT(rut: string): boolean {
    const rutLimpio = rut.replace(/[\.\s\-]/g, '').toUpperCase();
    if (!/^[0-9]+[0-9K]$/.test(rutLimpio)) return false;
    
    const numero = rutLimpio.slice(0, -1);
    const dv = rutLimpio.slice(-1);
    
    if (numero.length < 7 || numero.length > 8) return false;
    
    return dv === RegisterProviderPage.calcularDigitoVerificador(numero);
  }

  private static calcularDigitoVerificador(numero: string): string {
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

  formatRUT(event: any): void {
    let value = event.target.value.toUpperCase();
    value = value.replace(/[^0-9K\.\-]/g, '');
    const rutLimpio = value.replace(/[\.\-\s]/g, '');
    
    if (rutLimpio.length >= 8 && /^[0-9]+[0-9K]?$/.test(rutLimpio)) {
      if (rutLimpio.length === 8 || rutLimpio.length === 9) {
        value = this.aplicarFormatoRUT(rutLimpio);
      }
    }
    
    this.registerForm.patchValue({ run: value }, { emitEvent: false });
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

  onRUTBlur(): void {
    const rutControl = this.registerForm.get('run');
    if (rutControl?.value) {
      const rutLimpio = rutControl.value.toString().toUpperCase().replace(/[\.\-\s]/g, '');
      if (rutLimpio.length >= 8 && rutLimpio.length <= 9) {
        rutControl.setValue(this.aplicarFormatoRUT(rutLimpio), { emitEvent: false });
      }
      rutControl.updateValueAndValidity();
    }
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

  phoneValidator(control: FormControl): ValidationErrors | null {
    if (!control.value) return null;
    
    // Limpiar el número de teléfono
    const phone = control.value.toString().replace(/\D/g, '');
    
    // Validar que sea un número chileno válido
    // Debe tener 9 dígitos (sin contar código de país)
    if (phone.length < 9) return { phoneLength: true };
    
    // Si comienza con 56, debe tener 11 dígitos totales
    if (phone.startsWith('56') && phone.length !== 11) return { phoneLength: true };
    
    // Si tiene 11 dígitos, debe comenzar con 56
    if (phone.length === 11 && !phone.startsWith('56')) return { phoneFormat: true };
    
    // Si tiene 10 dígitos, debe comenzar con 9
    if (phone.length === 10 && !phone.startsWith('9')) return { phoneFormat: true };
    
    // Si tiene 9 dígitos, debe comenzar con 9
    if (phone.length === 9 && !phone.startsWith('9')) return { phoneFormat: true };
    
    return null;
  }
  formatPhone(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    
    // Eliminar código de país si está al inicio
    if (value.startsWith('56')) {
      value = value.substring(2);
    }
    
    // Asegurar que empieza con 9 (número chileno válido)
    if (value.length > 0 && !value.startsWith('9')) {
      if (value.startsWith('569')) {
        value = value.substring(1); // Eliminar 56 extra
      }
    }
    
    // Limitar a 9 dígitos
    value = value.substring(0, 9);
    
    // Formatear: +56 9 XXXX XXXX
    if (value.length > 0) {
      if (value.length <= 1) {
        value = `+56 9 ${value}`;
      } else if (value.length <= 5) {
        value = `+56 9 ${value.substring(1, 5)}`;
        if (value.length > 12) {
          value = `+56 9 ${value.substring(5, 9)} ${value.substring(9)}`;
        }
      } else {
        value = `+56 9 ${value.substring(1, 5)} ${value.substring(5, 9)}`;
      }
    }
    
    this.registerForm.patchValue({ phone: value });
  }

  // ==================== SUBMIT ====================

  async onSubmit(): Promise<void> {
    if (this.registerForm.pending) {
      return;
    }

    if (this.registerForm.valid && !this.isLoading) {
      this.isLoading = true;
      
      const { confirmPassword, ...formData } = this.registerForm.value;
      
      // Normalizar teléfono: eliminar espacios y signo +, dejar solo dígitos con código de país
      const phone = formData.phone.replace(/\D/g, '');
      const runLimpio = formData.run.replace(/[\.\-\s]/g, '').toUpperCase();
      const run = `${runLimpio.slice(0, -1)}-${runLimpio.slice(-1)}`;
      
      // ══ AVATAR ══════════════════════════════════════════════════
      // Si el usuario subió foto (base64), se envía como archivo.
      // Si no subió foto, se omite el campo y el backend asigna su default.
      const avatarToSend = formData.avatar && formData.avatar.startsWith('data:') ? formData.avatar : null;
      
      // ══ RATING INICIAL ═══════════════════════════════════════════
      // Asignar rating inicial = 5 (el backend debe manejarlo, pero lo enviamos por compatibilidad)
      const rating_avg = 5;
      
      const providerData = {
        email: formData.email,
        password: formData.password,
        full_name: formData.fullName,
        phone: phone,
        run: run,
        bio: formData.bio || "",
        avatar: avatarToSend,
        rating_avg: rating_avg,
        terms_accepted: formData.termsAccepted,
        email_opt_in: formData.emailOptIn
      };

      this.authService.registerProvider(providerData).subscribe({
        next: async () => {
          this.isLoading = true;
          // Auto-login para llevar al dashboard inmediatamente
          this.authService.loginClient({ email: formData.email, password: formData.password }).subscribe({
            next: () => {
              this.isLoading = false;
              this.router.navigate(['/provider/tabs'], { replaceUrl: true });
            },
            error: async () => {
              // Fallback: si el auto-login falla, ir al login con credenciales precargadas
              this.isLoading = false;
              const alert = await this.alertController.create({
                header: '✅ Registro Exitoso',
                message: 'Tu cuenta de proveedor ha sido creada. Inicia sesión para continuar.',
                buttons: [{
                  text: 'Ir al Login',
                  handler: () => {
                    this.router.navigate(['/auth/login']);
                  }
                }]
              });
              await alert.present();
            }
          });
        },
        error: async (error) => {
          this.isLoading = false;
          const detail = error?.error?.detail;
          let errorMessage = 'Error al registrar. Intenta nuevamente.';
          
          if (detail === 'Email already registered') {
            const alert = await this.alertController.create({
              header: 'Cuenta ya existe',
              message: 'Este correo electrónico ya está registrado. ¿Deseas iniciar sesión?',
              buttons: [
                {
                  text: 'No',
                  role: 'cancel'
                },
                {
                  text: 'Ir al Login',
                  handler: () => {
                    this.router.navigate(['/auth/login']);
                  }
                }
              ]
            });
            await alert.present();
            return;
          } else if (detail === 'RUN already registered') {
            errorMessage = 'Este RUT ya está registrado.';
          } else if (detail === 'Phone already registered') {
            errorMessage = 'Este teléfono ya está registrado.';
          } else if (error.status === 422 && Array.isArray(detail)) {
            errorMessage = detail.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join('\n');
          } else if (detail) {
            errorMessage = detail;
          }
          
          this.showAlert('Error de Registro', errorMessage);
        }
      });
    } else {
      Object.keys(this.registerForm.controls).forEach(key => {
        this.registerForm.get(key)?.markAsTouched();
      });
      this.showAlert('Error', 'Por favor completa todos los campos requeridos correctamente.');
    }
  }

  async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }

  async showConfirmExit(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Salir',
      message: '¿Está seguro de que desea salir?',
      buttons: [
        { text: 'No', role: 'cancel' },
        { text: 'Sí', handler: () => this.goSalir() }
      ]
    });
    await alert.present();
  }

  goSalir(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  // ==================== REGISTRO SOCIAL ====================

  registerWithGoogle(): void {
    this.isLoading = true;
    this.signInWithRetry(GoogleLoginProvider.PROVIDER_ID)
      .then((socialUser) => {
        this.authService.loginWithGoogle(socialUser.idToken || '', 'PROVIDER').subscribe({
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
    this.signInWithRetry(FacebookLoginProvider.PROVIDER_ID, {
      scope: 'public_profile,email',
      return_scopes: true,
      auth_type: 'rerequest',
    })
      .then((socialUser) => {
        this.authService.loginWithFacebook(
          socialUser.authToken || '',
          'PROVIDER',
          socialUser.email || ''
        ).subscribe({
          next: (response) => {
            this.isLoading = false;
            this.handleOAuthNavigation(response.role, response.terms_accepted);
          },
          error: (error) => {
            if (this.isFacebookMissingEmailError(error)) {
              this.retryFacebookWithManualEmail('PROVIDER', socialUser.authToken || '');
              return;
            }
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

    if (role !== 'PROVIDER') {
      this.showAlert('Cuenta de Cliente Detectada', 'Esta cuenta está registrada como Cliente. Para registrarte como Proveedor, utiliza un correo diferente o contacta a soporte.');
      // En lugar de ir a provider, lo mandamos a client o login
      this.authService.logout();
      this.router.navigate(['/auth/login']);
      return;
    }

    this.router.navigate(['/provider/tabs']);
  }

  private async signInWithRetry(providerId: string, options?: any, retries = 2): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.socialAuthService.signIn(providerId, options);
      } catch (err: any) {
        if (err?.message?.toLowerCase().includes('not ready') && attempt < retries) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        throw err;
      }
    }
  }

  private isFacebookMissingEmailError(error: any): boolean {
    const detail = String(error?.error?.detail ?? error?.message ?? '').toLowerCase();
    return detail.includes('facebook') && detail.includes('email') && detail.includes('no proporcion');
  }

  private async retryFacebookWithManualEmail(role: 'CLIENT' | 'PROVIDER', accessToken: string): Promise<void> {
    const manualEmail = await this.promptFacebookEmailFallback();
    if (!manualEmail) {
      this.isLoading = false;
      await this.showAlert('Correo requerido', 'Debes ingresar un correo válido para continuar con Facebook.');
      return;
    }

    this.authService.loginWithFacebook(accessToken, role, manualEmail).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.handleOAuthNavigation(response.role, response.terms_accepted);
      },
      error: (fallbackError) => {
        this.isLoading = false;
        this.showAlert('Error', fallbackError?.error?.detail || 'No fue posible completar el registro con Facebook');
      }
    });
  }

  private async promptFacebookEmailFallback(): Promise<string | null> {
    const alert = await this.alertController.create({
      header: 'Correo requerido',
      message: 'Facebook no devolvió tu correo. Ingresa tu email para continuar.',
      cssClass: 'custom-alert-dark',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'tu@email.com'
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Continuar', role: 'confirm' }
      ]
    });

    await alert.present();
    const result = await alert.onDidDismiss();
    if (result.role !== 'confirm') return null;

    const email = String(result.data?.values?.email ?? '').trim().toLowerCase();
    return this.isBasicValidEmail(email) ? email : null;
  }

  private isBasicValidEmail(email: string): boolean {
    if (!email || email.includes(' ')) return false;
    const at = email.indexOf('@');
    const dot = email.lastIndexOf('.');
    return at > 0 && dot > at + 1 && dot < email.length - 1;
  }

  private getSocialErrorMessage(error: any, provider: string): string {
    const msg: string = error?.message ?? '';
    if (msg.toLowerCase().includes('not ready')) {
      return `El servicio de ${provider} no está disponible. Verifica tu conexión e intenta nuevamente.`;
    }
    return `No se pudo conectar con ${provider}`;
  }
}

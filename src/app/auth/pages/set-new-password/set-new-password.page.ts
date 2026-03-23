import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { IonContent, IonInput, IonButton, IonLabel, IonText, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-set-new-password',
  templateUrl: './set-new-password.page.html',
  styleUrls: ['./set-new-password.page.scss'],
  standalone: true,
  imports: [IonSpinner, 
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    IonContent,
    IonInput,
    IonButton,
    IonLabel,
    IonText
  ]
})
export class SetNewPasswordPage {
  setPasswordForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  token = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.setPasswordForm = this.fb.group({
      password: ['', [
        Validators.required, 
        Validators.minLength(8),
        this.uppercaseValidator,
        this.numberValidator
      ]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordsMatchValidator });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
    });
  }

  uppercaseValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    return /[A-Z]/.test(control.value) ? null : { uppercaseRequired: true };
  }

  numberValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    return /[0-9]/.test(control.value) ? null : { numberRequired: true };
  }

  passwordsMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirm = form.get('confirmPassword')?.value;
    return password === confirm ? null : { mismatch: true };
  }

  onSubmit(): void {
    // if (this.setPasswordForm.valid && this.token) {
    //   this.isLoading = true;
    //   this.errorMessage = '';
    //   this.successMessage = '';
    //   const password = this.setPasswordForm.value.password;
    //   this.authService.setNewPassword(this.token, password).subscribe({
    //     next: () => {
    //       this.isLoading = false;
    //       this.successMessage = 'Contraseña restablecida correctamente. Ahora puedes iniciar sesión.';
    //       setTimeout(() => this.router.navigate(['/auth/login']), 2000);
    //     },
    //     error: (error) => {
    //       this.isLoading = false;
    //       this.errorMessage = error.error?.detail || 'Error al restablecer la contraseña.';
    //     }
    //   });
    // } else {
    //   this.errorMessage = 'Verifica los campos y el enlace de recuperación.';
    // }
  }

  onBack(): void {
    this.router.navigate(['/auth/login']);
  }
}

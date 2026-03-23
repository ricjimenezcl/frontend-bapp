import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IonContent, IonInput, IonButton, IonLabel, IonText, IonItem, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
  standalone: true,
  imports: [IonSpinner, IonItem, 
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
export class ResetPasswordPage {
  resetForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.resetForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit(): void {
    if (this.resetForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';
      const email: string = this.resetForm.value.email;
      // this.authService.resetPassword(email).subscribe({
      //   next: () => {
      //     this.isLoading = false;
      //     this.successMessage = 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña.';
      //   },
      //   error: (error: any) => {
      //     this.isLoading = false;
      //     this.errorMessage = error?.error?.detail || 'Error al solicitar el restablecimiento de contraseña.';
      //   }
      // });
    } else {
      this.errorMessage = 'Por favor ingresa un correo válido.';
    }
  }

  onBack(): void {
    this.router.navigate(['/auth/login']);
  }
}

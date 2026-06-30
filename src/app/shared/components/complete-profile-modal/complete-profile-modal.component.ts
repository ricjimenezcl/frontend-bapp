import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonItem, IonLabel, IonInput, IonButton,
  IonSpinner, IonIcon, IonNote
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline, checkmarkCircleOutline, lockClosedOutline } from 'ionicons/icons';
import { HttpClient } from '@angular/common/http';
import { ProfileCompletionService } from '../../../core/services/profile-completion.service';
import { AuthService } from '../../../auth/services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-complete-profile-modal',
  templateUrl: './complete-profile-modal.component.html',
  styleUrls: ['./complete-profile-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonItem, IonLabel, IonInput,
    IonButton, IonSpinner, IonIcon, IonNote
  ]
})
export class CompleteProfileModalComponent implements OnInit {
  phone = '';
  run = '';
  saving = signal(false);
  error = signal('');

  // Qué campos son obligatorios (determinado tras cargar el perfil actual)
  needPhone = true;
  needRun = true;

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    public completion: ProfileCompletionService,
    private authService: AuthService
  ) {
    addIcons({ alertCircleOutline, checkmarkCircleOutline, lockClosedOutline });
  }

  ngOnInit(): void {
    // Cargar perfil actual para saber qué falta
    this.http.get<any>(`${this.apiUrl}/providers/me`).subscribe({
      next: p => {
        this.needPhone = !p.phone;
        this.needRun   = !p.run;
      },
      error: () => { /* Si falla, mostrar ambos campos */ }
    });
  }

  async save(): Promise<void> {
    this.error.set('');

    if (this.needPhone && !this.phone.trim()) {
      this.error.set('Ingresa tu número de teléfono.');
      return;
    }
    if (this.needRun && !this.run.trim()) {
      this.error.set('Ingresa tu RUN (ej: 12345678-9).');
      return;
    }
    if (this.needRun && !this.isValidRun(this.run)) {
      this.error.set('El RUN ingresado no es válido.');
      return;
    }

    this.saving.set(true);
    const payload: any = {};
    if (this.needPhone) payload.phone = this.phone.trim();
    if (this.needRun)   payload.run   = this.run.trim().toUpperCase();

    this.http.patch<any>(`${this.apiUrl}/providers/me`, payload).subscribe({
      next: () => {
        this.saving.set(false);
        const user = this.authService.getCurrentUser();
        if (user?.id) {
          localStorage.setItem(`bapp_profile_ok_${user.id}`, '1');
        }
        this.completion.dismiss();
      },
      error: err => {
        this.saving.set(false);
        const detail = err?.error?.detail;
        this.error.set(detail || 'No se pudo guardar. Intenta de nuevo.');
      }
    });
  }

  /** Validación básica de RUN chileno: XXXXXXXX-X */
  private isValidRun(run: string): boolean {
    const cleaned = run.replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
    if (cleaned.length < 7 || cleaned.length > 9) return false;
    const digits = cleaned.slice(0, -1);
    const dv     = cleaned.slice(-1);
    if (!/^\d+$/.test(digits)) return false;
    let sum = 0, mul = 2;
    for (let i = digits.length - 1; i >= 0; i--) {
      sum += parseInt(digits[i]) * mul;
      mul = mul === 7 ? 2 : mul + 1;
    }
    const rem  = sum % 11;
    const calc = rem === 0 ? '0' : rem === 1 ? 'K' : String(11 - rem);
    return dv === calc;
  }
}

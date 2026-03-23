import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent,
  IonList, IonItem, IonLabel, IonToggle, IonSelect, IonSelectOption,
  IonButton, IonSpinner, IonIcon, ToastController, LoadingController
} from '@ionic/angular/standalone';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../auth/services/auth.service';

interface DayHours {
  dayOfWeek: number;
  dayName: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
}

const TIME_OPTIONS: string[] = Array.from({ length: 24 }, (_, h) =>
  `${String(h).padStart(2, '0')}:00`
);

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

@Component({
  selector: 'app-provider-working-hours',
  templateUrl: './provider-working-hours.page.html',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent,
    IonList, IonItem, IonLabel, IonToggle, IonSelect, IonSelectOption,
    IonButton, IonSpinner, IonIcon
  ]
})
export class ProviderWorkingHoursPage implements OnInit {
  private apiUrl = environment.apiUrl;
  days: DayHours[] = DAY_NAMES.map((dayName, i) => ({
    dayOfWeek: i,
    dayName,
    isActive: false,
    startTime: '09:00',
    endTime: '18:00',
  }));
  timeOptions = TIME_OPTIONS;
  isLoading = true;
  isSaving = false;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
  ) {}

  ngOnInit() {
    this.loadWorkingHours();
  }

  loadWorkingHours() {
    this.isLoading = true;
    this.http.get<any[]>(`${this.apiUrl}/working-hours/me`).subscribe({
      next: (serverHours) => {
        serverHours.forEach(sh => {
          const day = this.days.find(d => d.dayOfWeek === sh.day_of_week);
          if (day) {
            day.isActive = sh.is_active;
            day.startTime = sh.start_time.substring(0, 5); // "HH:MM:SS" → "HH:MM"
            day.endTime = sh.end_time.substring(0, 5);
          }
        });
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  async saveDay(day: DayHours) {
    this.isSaving = true;
    const payload = {
      day_of_week: day.dayOfWeek,
      start_time: day.startTime + ':00',
      end_time: day.endTime + ':00',
      is_active: day.isActive,
    };
    this.http.post(`${this.apiUrl}/working-hours/me`, payload).subscribe({
      next: async () => {
        this.isSaving = false;
        await this.showToast(`${day.dayName} actualizado`);
      },
      error: async (err) => {
        this.isSaving = false;
        const msg = err.error?.detail || 'Error al guardar';
        await this.showToast(msg);
      }
    });
  }

  async saveAll() {
    const loading = await this.loadingCtrl.create({ message: 'Guardando...' });
    await loading.present();
    const requests = this.days.map(day => ({
      day_of_week: day.dayOfWeek,
      start_time: day.startTime + ':00',
      end_time: day.endTime + ':00',
      is_active: day.isActive,
    }));
    let completed = 0;
    for (const req of requests) {
      await this.http.post(`${this.apiUrl}/working-hours/me`, req).toPromise()
        .catch(() => {});
      completed++;
    }
    await loading.dismiss();
    await this.showToast('Horarios guardados');
  }

  goBack() {
    this.router.navigate(['/provider/tabs/profile']);
  }

  private async showToast(message: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2000, position: 'bottom' });
    await toast.present();
  }
}

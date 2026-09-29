import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-email-verification',
  templateUrl: './email-verification.page.html',
  styleUrls: ['./email-verification.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
})
export class EmailVerificationPage implements OnInit {
  status: 'loading' | 'success' | 'error' | 'expired' = 'loading';
  message = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.status = 'error';
      this.message = 'Enlace de verificación inválido.';
      return;
    }
    this.authService.verifyEmail(token).subscribe({
      next: (res: any) => {
        this.status = 'success';
        this.message = res?.message ?? 'Correo verificado correctamente.';
      },
      error: (err) => {
        const detail: string = err?.error?.detail ?? '';
        if (detail.toLowerCase().includes('expirado')) {
          this.status = 'expired';
          this.message = 'El enlace expiró. Solicita uno nuevo desde la app.';
        } else {
          this.status = 'error';
          this.message = 'El enlace es inválido o ya fue utilizado.';
        }
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}

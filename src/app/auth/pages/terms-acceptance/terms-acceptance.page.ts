import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton,
  IonItem, IonCheckbox, IonLabel, IonIcon, IonSpinner,
  AlertController
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-terms-acceptance',
  templateUrl: './terms-acceptance.page.html',
  styleUrls: ['./terms-acceptance.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButton,
    IonItem, IonCheckbox, IonLabel, IonIcon, IonSpinner
  ]
})
export class TermsAcceptancePage {
  private authService = inject(AuthService);
  private router = inject(Router);
  private alertController = inject(AlertController);

  termsAccepted = false;
  emailOptIn = false;
  isLoading = false;

  get canContinue(): boolean {
    return this.termsAccepted;
  }

  async onAccept(): Promise<void> {
    if (!this.termsAccepted || this.isLoading) return;

    this.isLoading = true;
    this.authService.acceptTerms(this.emailOptIn).subscribe({
      next: () => {
        this.isLoading = false;
        const user = this.authService.getCurrentUser();
        if (user?.role === 'PROVIDER') {
          this.router.navigate(['/provider/tabs']);
        } else {
          this.router.navigate(['/client/categories']);
        }
      },
      error: async (err) => {
        this.isLoading = false;
        console.error('Error aceptando términos:', err);
        const alert = await this.alertController.create({
          header: 'Error',
          message: 'No se pudo registrar la aceptación. Intenta nuevamente.',
          buttons: ['OK']
        });
        await alert.present();
      }
    });
  }

  onDecline(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}

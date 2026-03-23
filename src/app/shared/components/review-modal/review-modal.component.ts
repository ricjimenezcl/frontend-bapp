import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
  IonItem, IonLabel, IonRange, IonTextarea, IonIcon, IonSpinner,
  ModalController, ToastController
} from '@ionic/angular/standalone';
import { CoreService } from '../../services/core.service';

@Component({
  selector: 'app-review-modal',
  templateUrl: './review-modal.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
    IonItem, IonLabel, IonRange, IonTextarea, IonIcon, IonSpinner,
  ]
})
export class ReviewModalComponent implements OnInit {
  @Input() bookingId!: number;
  @Input() providerId!: number;

  reviewForm: FormGroup;
  isSubmitting = false;
  selectedRating = 5;
  stars = [1, 2, 3, 4, 5];

  constructor(
    private fb: FormBuilder,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private coreService: CoreService,
  ) {
    this.reviewForm = this.fb.group({
      comment: ['', [Validators.maxLength(500)]],
    });
  }

  ngOnInit() {}

  setRating(star: number) {
    this.selectedRating = star;
  }

  async submit() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    const payload = {
      booking_id: this.bookingId,
      provider_id: this.providerId,
      rating: this.selectedRating,
      comment: this.reviewForm.value.comment?.trim() || undefined,
    };

    this.coreService.createReview(payload).subscribe({
      next: async () => {
        await this.showToast('¡Gracias por tu reseña!');
        this.modalCtrl.dismiss({ reviewed: true });
      },
      error: async (err) => {
        this.isSubmitting = false;
        const msg = err.error?.detail || 'No se pudo guardar la reseña';
        // 400 "Ya existe una reseña" is a soft error — dismiss anyway
        if (err.status === 400) {
          await this.showToast('Ya dejaste una reseña para esta reserva');
          this.modalCtrl.dismiss({ reviewed: false });
        } else {
          await this.showToast(msg);
        }
      }
    });
  }

  dismiss() {
    this.modalCtrl.dismiss({ reviewed: false });
  }

  private async showToast(message: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2500, position: 'bottom' });
    await toast.present();
  }
}

import { Injectable } from '@angular/core';
import { ToastController, LoadingController } from '@ionic/angular/standalone';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private loading: HTMLIonLoadingElement | null = null;

  constructor(
    private toastController: ToastController,
    private loadingController: LoadingController
  ) {}

  async showToast(message: string, duration = 3000, position: 'bottom' | 'top' | 'middle' = 'bottom') {
    const toast = await this.toastController.create({
      message,
      duration,
      position,
    });
    await toast.present();
  }

  async showLoading(message: string = 'Cargando...') {
    if (this.loading) {
      await this.hideLoading();
    }
    this.loading = await this.loadingController.create({
      message,
      spinner: 'crescent',
    });
    await this.loading.present();
  }

  async hideLoading() {
    if (this.loading) {
      await this.loading.dismiss();
      this.loading = null;
    }
  }
}

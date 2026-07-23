import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { I18nService } from '../../../../shared/services/i18n.service';
import { UserSettingsService } from '../../../../shared/services/user-settings.service';

@Component({
  selector: 'app-languages',
  templateUrl: './languages.page.html',
  styleUrls: ['./languages.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class LanguagesPage implements OnInit {
  currentLanguage = 'es';
  availableLanguages: Array<{ code: string; name: string }> = [];

  constructor(
    private readonly router: Router,
    private readonly i18nService: I18nService,
    private readonly userSettingsService: UserSettingsService,
    private readonly toastCtrl: ToastController,
  ) {}

  ngOnInit(): void {
    this.currentLanguage = this.i18nService.getLanguage();
    this.availableLanguages = this.i18nService.getAvailableLanguages();
  }

  async applyLanguage(languageCode: string): Promise<void> {
    this.currentLanguage = languageCode;
    this.i18nService.setLanguage(languageCode);
    this.userSettingsService.updateSettings({ preferredLanguage: languageCode });

    const toast = await this.toastCtrl.create({
      message: `Idioma actualizado a ${this.resolveLanguageName(languageCode)}`,
      duration: 1700,
      color: 'success',
      position: 'bottom',
    });
    await toast.present();
  }

  isSelected(languageCode: string): boolean {
    return this.currentLanguage === languageCode;
  }

  goBack(): void {
    this.router.navigate(['/client/settings']);
  }

  private resolveLanguageName(languageCode: string): string {
    return this.availableLanguages.find((item) => item.code === languageCode)?.name ?? languageCode;
  }
}

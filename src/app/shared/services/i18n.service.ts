import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private languageSubject = new BehaviorSubject<string>(this.loadLanguage());
  public language$ = this.languageSubject.asObservable();

  private translations: { [key: string]: { [key: string]: string } } = {
    es: {
      'settings.title': 'Configuración',
      'settings.languages': 'Idiomas',
      'settings.darkMode': 'Modo Oscuro',
      'settings.help': 'Centro de Ayuda',
      'settings.avatar': 'Cambiar Foto de Perfil',
      'settings.password': 'Cambiar Contraseña',
    },
    en: {
      'settings.title': 'Settings',
      'settings.languages': 'Languages',
      'settings.darkMode': 'Dark Mode',
      'settings.help': 'Help Center',
      'settings.avatar': 'Change Profile Photo',
      'settings.password': 'Change Password',
    }
  };

  constructor() {}

  private loadLanguage(): string {
    return localStorage.getItem('language') || 'es';
  }

  setLanguage(lang: string): void {
    if (this.translations[lang]) {
      this.languageSubject.next(lang);
      localStorage.setItem('language', lang);
      document.documentElement.lang = lang;
    }
  }

  getLanguage(): string {
    return this.languageSubject.value;
  }

  translate(key: string): string {
    const lang = this.languageSubject.value;
    return this.translations[lang]?.[key] || key;
  }

  getAvailableLanguages() {
    return [
      { code: 'es', name: 'Español' },
      { code: 'en', name: 'English' }
    ];
  }
}

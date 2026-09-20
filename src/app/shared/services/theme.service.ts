import { Injectable } from '@angular/core';

/**
 * BAPP es una aplicación dark-only: este servicio fuerza siempre el tema oscuro
 * y ya no expone un modo claro ni un toggle para el usuario.
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  constructor() {
    this.applyTheme();
  }

  isDarkMode(): boolean {
    return true;
  }

  private applyTheme(): void {
    const root = document.documentElement;
    const body = document.body;
    const app = document.querySelector('ion-app') as HTMLElement | null;

    root.classList.remove('theme-light', 'light-mode');
    body.classList.remove('theme-light', 'light-mode');
    if (app) {
      app.classList.remove('theme-light', 'light-mode');
    }

    root.classList.add('theme-dark', 'dark-mode', 'dark');
    body.classList.add('theme-dark', 'dark-mode', 'dark');
    if (app) {
      app.classList.add('theme-dark', 'dark-mode', 'dark');
    }

    root.style.backgroundColor = 'var(--bapp-bg-page)';
    root.style.color = 'var(--bapp-text-primary)';
    body.style.backgroundColor = 'var(--bapp-bg-page)';
    body.style.color = 'var(--bapp-text-primary)';
    if (app) {
      app.style.backgroundColor = 'var(--bapp-bg-page)';
      app.style.color = 'var(--bapp-text-primary)';
    }
  }
}

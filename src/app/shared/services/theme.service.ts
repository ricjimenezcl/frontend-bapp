import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'bapp_theme_preference';
  private readonly darkModeSubject = new BehaviorSubject<boolean>(this.loadDarkMode());
  public darkMode$ = this.darkModeSubject.asObservable();

  constructor() {
    this.initTheme();
  }

  private loadDarkMode(): boolean {
    const modernTheme = localStorage.getItem(this.THEME_KEY);
    if (modernTheme === 'dark') return true;
    if (modernTheme === 'light') return false;

    const legacyBoolean = localStorage.getItem('darkMode');
    if (legacyBoolean !== null) {
      try {
        const parsed = JSON.parse(legacyBoolean);
        if (typeof parsed === 'boolean') return parsed;
      } catch {
        // Ignorar y seguir con la política dark-first.
      }
    }

    const legacyTheme = localStorage.getItem('theme');
    if (legacyTheme === 'dark') return true;
    if (legacyTheme === 'light') return false;

    // La referencia web usa un tono neutro claro por defecto.
    return false;
  }

  private initTheme(): void {
    this.applyTheme(this.darkModeSubject.value);
  }

  toggleDarkMode(isDark: boolean): void {
    this.darkModeSubject.next(isDark);
    localStorage.setItem(this.THEME_KEY, isDark ? 'dark' : 'light');
    localStorage.setItem('darkMode', JSON.stringify(isDark));
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    this.applyTheme(isDark);
  }

  isDarkMode(): boolean {
    return this.darkModeSubject.value;
  }

  private applyTheme(isDark: boolean): void {
    const root = document.documentElement;
    const body = document.body;
    const app = document.querySelector('ion-app') as HTMLElement | null;

    root.classList.remove('theme-dark', 'theme-light', 'dark-mode', 'light-mode', 'dark');
    body.classList.remove('theme-dark', 'theme-light', 'dark-mode', 'light-mode', 'dark');
    if (app) {
      app.classList.remove('theme-dark', 'theme-light', 'dark-mode', 'light-mode', 'dark');
    }

    if (isDark) {
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
    } else {
      root.classList.add('theme-light', 'light-mode');
      body.classList.add('theme-light', 'light-mode');
      if (app) {
        app.classList.add('theme-light', 'light-mode');
      }

      root.style.backgroundColor = '#F3F1ED';
      root.style.color = '#111827';
      body.style.backgroundColor = '#F3F1ED';
      body.style.color = '#111827';
      if (app) {
        app.style.backgroundColor = '#F3F1ED';
        app.style.color = '#111827';
      }
    }
  }
}

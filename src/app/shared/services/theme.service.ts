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

    // La app es dark-first. Si no hay preferencia válida, arrancar en oscuro.
    return true;
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

    root.classList.remove('theme-dark', 'theme-light', 'dark-mode', 'light-mode', 'dark');
    body.classList.remove('theme-dark', 'theme-light', 'dark-mode', 'light-mode', 'dark');

    if (isDark) {
      root.classList.add('theme-dark', 'dark-mode', 'dark');
      body.classList.add('theme-dark', 'dark-mode', 'dark');
      document.body.style.background = '#1A1A1A';
      document.body.style.color = '#FFFFFF';
    } else {
      root.classList.add('theme-light', 'light-mode');
      body.classList.add('theme-light', 'light-mode');
      document.body.style.background = '#FFFFFF';
      document.body.style.color = '#141414';
    }
  }
}

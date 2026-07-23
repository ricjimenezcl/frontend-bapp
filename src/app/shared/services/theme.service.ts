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
        return JSON.parse(legacyBoolean);
      } catch {
        return false;
      }
    }

    // Compatibilidad con key legacy usada en web.
    const legacyTheme = localStorage.getItem('theme');
    if (legacyTheme === 'dark') return true;
    if (legacyTheme === 'light') return false;

    // App dark-first: si no hay preferencia guardada, arrancar en modo oscuro.
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
    } else {
      root.classList.add('theme-light', 'light-mode');
      body.classList.add('theme-light', 'light-mode');
    }
  }
}

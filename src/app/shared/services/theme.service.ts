import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private darkModeSubject = new BehaviorSubject<boolean>(this.loadDarkMode());
  public darkMode$ = this.darkModeSubject.asObservable();

  constructor() {
    this.initTheme();
  }

  private loadDarkMode(): boolean {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  }

  private initTheme(): void {
    if (this.darkModeSubject.value) {
      document.body.classList.add('dark');
    }
  }

  toggleDarkMode(isDark: boolean): void {
    this.darkModeSubject.next(isDark);
    localStorage.setItem('darkMode', JSON.stringify(isDark));
    
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }

  isDarkMode(): boolean {
    return this.darkModeSubject.value;
  }
}

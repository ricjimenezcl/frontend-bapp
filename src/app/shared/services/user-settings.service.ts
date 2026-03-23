import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserSettingsService {
  private settingsSubject = new BehaviorSubject<any>(this.loadSettings());
  public settings$ = this.settingsSubject.asObservable();

  constructor() {}

  private loadSettings(): any {
    const saved = localStorage.getItem('userSettings');
    return saved ? JSON.parse(saved) : {
      notifications: true,
      emailNotifications: true,
      pushNotifications: true,
      privacyLevel: 'medium'
    };
  }

  updateSettings(settings: any): void {
    const current = this.settingsSubject.value;
    const updated = { ...current, ...settings };
    this.settingsSubject.next(updated);
    localStorage.setItem('userSettings', JSON.stringify(updated));
  }

  getSetting(key: string): any {
    return this.settingsSubject.value[key];
  }

  getSettings(): any {
    return this.settingsSubject.value;
  }
}

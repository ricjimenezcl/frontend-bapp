import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';

interface WelcomeSlide {
  title: string;
  description: string;
  icon: string;
  accent: 'client' | 'provider';
}

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.page.html',
  styleUrls: ['./welcome.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
})
export class WelcomePage implements OnInit {
  private readonly storageKey = 'bapp_welcome_seen';
  private readonly selectedRoleKey = 'bapp_user_role';

  readonly slides: WelcomeSlide[] = [
    {
      title: 'Encuentra servicios cerca de ti',
      description: 'Busca profesionales verificados, compara perfiles y descubre opciones rápidas para tu día a día.',
      icon: 'search-outline',
      accent: 'client',
    },
    {
      title: 'Agenda y contacta sin fricción',
      description: 'Revisa disponibilidad, lee reseñas y avanza en tu reserva desde una sola experiencia.',
      icon: 'calendar-outline',
      accent: 'client',
    },
    {
      title: 'Elige cómo empezar hoy',
      description: 'Explora como invitado, entra con tu cuenta o ofrece tus servicios si eres proveedor.',
      icon: 'sparkles-outline',
      accent: 'provider',
    },
  ];

  activeSlide = 0;
  guestProfileSelectorVisible = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.clearWelcomeState();
  }

  private clearWelcomeState(): void {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.selectedRoleKey);
  }

  private saveSelectedRole(role: 'client' | 'provider'): void {
    localStorage.setItem(this.selectedRoleKey, role);
  }

  next(): void {
    if (this.activeSlide < this.slides.length - 1) {
      this.activeSlide += 1;
      return;
    }

    this.openGuestProfileSelector();
  }

  openGuestProfileSelector(): void {
    this.guestProfileSelectorVisible = true;
  }

  continueGuestExplore(role: 'client' | 'provider' = 'client'): void {
    this.guestProfileSelectorVisible = false;
    this.finishWelcome(role);
  }

  previous(): void {
    if (this.activeSlide > 0) {
      this.activeSlide -= 1;
    }
  }

  finishWelcome(role: 'client' | 'provider' = 'client'): void {
    this.clearWelcomeState();

    if (role === 'provider') {
      this.saveSelectedRole(role);
      this.router.navigate(['/provider/tabs/home']);
      return;
    }

    this.saveSelectedRole(role);
    this.router.navigate(['/client/categories']);
  }

  goToLogin(): void {
    this.clearWelcomeState();
    this.router.navigate(['/auth/login']);
  }

  goToProviderRegister(): void {
    this.clearWelcomeState();
    this.router.navigate(['/auth/login']);
  }

  get isLastSlide(): boolean {
    return this.activeSlide === this.slides.length - 1;
  }
}

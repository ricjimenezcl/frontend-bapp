import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../../features/auth/services/auth.service';
import { StateService, SelectedService } from '../../../../shared/services/state.service';

interface QuickAccessItem {
  label: string;
  icon: string;
  route: string[];
}

@Component({
  selector: 'app-client-home',
  templateUrl: './client-home.page.html',
  styleUrls: ['./client-home.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class ClientHomePage implements OnInit, OnDestroy {
  userName = '';
  selectedServices: SelectedService[] = [];

  readonly quickAccess: QuickAccessItem[] = [
    { label: 'Mis Reservas', icon: 'calendar-outline', route: ['/client/tabs/bookings'] },
    { label: 'Mensajes', icon: 'chatbubbles-outline', route: ['/client/tabs/chats'] },
    { label: 'Mi Perfil', icon: 'person-outline', route: ['/client/tabs/profile'] }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private authService: AuthService,
    private stateService: StateService
  ) {}

  ngOnInit() {
    const currentUser = this.authService.getCurrentUser();
    this.userName = currentUser?.name?.split(' ')[0] || '';

    this.stateService.selectedServices$
      .pipe(takeUntil(this.destroy$))
      .subscribe(services => { this.selectedServices = services; });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  goToCategories() {
    this.router.navigate(['/client/categories']);
  }

  goTo(route: string[]) {
    this.router.navigate(route);
  }
}

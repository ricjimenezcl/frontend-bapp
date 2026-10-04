import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../../features/auth/services/auth.service';
import { StateService, SelectedService } from '../../../../shared/services/state.service';
import { BookingService, BookingStats } from '../../../../core/services/booking.service';

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
  stats: BookingStats | null = null;
  isLoadingStats = false;

  readonly quickAccess: QuickAccessItem[] = [
    { label: 'Mis Reservas', icon: 'calendar-outline', route: ['/client/tabs/bookings'] },
    { label: 'Mensajes', icon: 'chatbubbles-outline', route: ['/client/tabs/chats'] },
    { label: 'Mi Perfil', icon: 'person-outline', route: ['/client/tabs/profile'] }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private authService: AuthService,
    private stateService: StateService,
    private bookingService: BookingService
  ) {}

  ngOnInit() {
    const currentUser = this.authService.getCurrentUser();
    this.userName = currentUser?.name?.split(' ')[0] || '';

    this.stateService.selectedServices$
      .pipe(takeUntil(this.destroy$))
      .subscribe(services => { this.selectedServices = services; });

    this.loadStats();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadStats() {
    this.isLoadingStats = true;
    this.bookingService.getClientStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.stats = stats;
          this.isLoadingStats = false;
        },
        error: () => {
          this.isLoadingStats = false;
        }
      });
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

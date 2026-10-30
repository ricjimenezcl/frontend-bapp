// src/app/client/pages/tabs/tabs.page.ts
import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonIcon,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonFabButton
} from '@ionic/angular/standalone';
import { StateService } from '../../../../shared/services/state.service';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { BappieChatbotComponent } from '../../../../shared/components/bappie-chatbot/bappie-chatbot.component';
import { AccessAuthModalComponent } from '../../../../shared/components/access-auth-modal/access-auth-modal.component';
import { AuthService } from '../../../../features/auth/services/auth.service';

@Component({
  selector: 'app-client-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  // IonTabBar/IonTabButton deben importarse como standalone (no basta con
  // IonicModule clásico) para que Angular los instancie y así se registren
  // como Custom Elements (customElements.define). Sin esto, el navegador
  // los trata como elementos desconocidos con display:inline por defecto.
  // NO mezclar con IonicModule clásico: provoca NG0300 (doble match del
  // mismo tag, ej. ion-tab-bar) porque ambos registran el mismo selector.
  imports: [
    CommonModule,
    RouterModule,
    BappieChatbotComponent,
    AccessAuthModalComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonIcon,
    IonRouterOutlet,
    IonTabBar,
    IonTabButton,
    IonFabButton
  ]
})
export class ClientTabsPage implements OnInit, OnDestroy {
  @ViewChild(AccessAuthModalComponent) accessAuthModal?: AccessAuthModalComponent;

  selectedServices: any[] = [];
  activeTab: string = 'home';
  accessAuthMode: 'login' | 'register' = 'register';
  accessAuthLoading = false;
  accessAuthError = '';
  private readonly destroy$ = new Subject<void>();

  // Maps tab names to child route segments defined in app.routes.ts
  private readonly tabRoutes: Record<string, string> = {
    'home':           'home',
    'service-search': 'service-search',
    'bookings':       'bookings',
    'chats':          'chats',
    'client-profile': 'profile'
  };

  constructor(
    private stateService: StateService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.stateService.selectedServices$
      .pipe(takeUntil(this.destroy$))
      .subscribe(services => { this.selectedServices = services; });

    // Derive activeTab from the URL on every navigation so the tab bar
    // always reflects the current route.
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntil(this.destroy$))
      .subscribe((e: NavigationEnd) => {
        this.updateActiveTabFromUrl(e.urlAfterRedirects || e.url);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async openGuestAccessPrompt() {
    const hasStoredUser = !!localStorage.getItem('user_data');
    this.accessAuthMode = hasStoredUser ? 'login' : 'register';
    this.accessAuthError = '';
    this.accessAuthLoading = false;

    this.accessAuthModal?.configure({
      mode: this.accessAuthMode,
      role: 'client',
      appleSignInAvailable: false
    });
    this.accessAuthModal?.open(this.accessAuthMode, 'client');
  }

  closeAccessAuthModal() {
    this.accessAuthModal?.closeModal();
    this.accessAuthError = '';
    this.accessAuthLoading = false;
  }

  changeTab(tabName: string) {
    const route = this.tabRoutes[tabName];
    if (!route) return;

    const isGuestClientRoute = !this.authService.isAuthenticated() && localStorage.getItem('bapp_user_role') === 'client';
    const guestProtectedRoutes = ['bookings', 'chats', 'profile'];

    if (isGuestClientRoute && guestProtectedRoutes.includes(route)) {
      this.openGuestAccessPrompt();
      return;
    }

    this.router.navigate(['/client/tabs', route]);
  }

  goToCategories() {
    this.router.navigate(['/client/categories']);
  }

  private updateActiveTabFromUrl(url: string) {
    if      (url.includes('/tabs/home'))            this.activeTab = 'home';
    else if (url.includes('/tabs/service-search'))  this.activeTab = 'service-search';
    else if (url.includes('/tabs/bookings'))        this.activeTab = 'bookings';
    else if (url.includes('/tabs/chats'))           this.activeTab = 'chats';
    else if (url.includes('/tabs/profile'))         this.activeTab = 'client-profile';
  }
}

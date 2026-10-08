// src/app/client/pages/tabs/tabs.page.ts
import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { IonTabBar, IonTabButton, IonFabButton } from '@ionic/angular/standalone';
import { StateService } from '../../../../shared/services/state.service';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { BappieChatbotComponent } from '../../../../shared/components/bappie-chatbot/bappie-chatbot.component';

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
  imports: [CommonModule, IonicModule, RouterModule, BappieChatbotComponent, IonTabBar, IonTabButton, IonFabButton]
})
export class ClientTabsPage implements OnInit, OnDestroy {
  selectedServices: any[] = [];
  activeTab: string = 'home';
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
    private router: Router
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

  changeTab(tabName: string) {
    const route = this.tabRoutes[tabName];
    if (!route) return;
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

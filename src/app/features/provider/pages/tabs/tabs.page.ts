// src/app/provider/pages/tabs/tabs.page.ts
import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { IonTabBar, IonTabButton, IonFabButton } from '@ionic/angular/standalone';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-provider-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  // IonTabBar/IonTabButton deben importarse como standalone (no basta con
  // IonicModule clásico) para que Angular los instancie y así se registren
  // como Custom Elements (customElements.define). Sin esto, el navegador
  // los trata como elementos desconocidos con display:inline por defecto.
  imports: [CommonModule, IonicModule, RouterModule, IonTabBar, IonTabButton, IonFabButton]
})
export class ProviderTabsPage implements OnInit, OnDestroy {
  activeTab: string = 'home';
  private readonly destroy$ = new Subject<void>();

  // Maps tab names to child route segments
  private readonly tabRoutes: Record<string, string> = {
    'home': 'home',
    'service-details': 'service-details',
    'inbox': 'inbox',
    'bookings': 'bookings',
    'profile': 'profile'
  };

  constructor(
    private router: Router
  ) {}

  ngOnInit() {
    // Derive activeTab from the URL on every navigation so the tab bar
    // always reflects the current route.
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntil(this.destroy$))
      .subscribe((e: NavigationEnd) => {
        this.updateActiveTabFromUrl(e.urlAfterRedirects || e.url);
      });

    // Sync with current URL on init
    this.updateActiveTabFromUrl(this.router.url);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  changeTab(tabName: string) {
    const route = this.tabRoutes[tabName];
    if (!route) return;
    this.router.navigate(['/provider/tabs', route]);
  }

  goToAddService() {
    // Reutiliza el mismo flujo del botón "Nuevo servicio" de service-details
    // (chequeo de límite de plan + verificación de identidad + modal), en vez
    // de navegar directo a la página ruteada (que no tiene currentUser/coreService).
    this.router.navigate(['/provider/tabs/service-details'], { queryParams: { action: 'open-add-service' } });
  }

  private updateActiveTabFromUrl(url: string) {
    if      (url.includes('/tabs/home')) this.activeTab = 'home';
    else if (url.includes('/tabs/service-details')) this.activeTab = 'service-details';
    else if (url.includes('/tabs/inbox')) this.activeTab = 'inbox';
    else if (url.includes('/tabs/bookings')) this.activeTab = 'bookings';
    else if (url.includes('/tabs/profile')) this.activeTab = 'profile';
  }
}
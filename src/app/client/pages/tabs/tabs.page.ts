// src/app/client/pages/tabs/tabs.page.ts
import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { StateService } from '../../../shared/services/state.service';
import { MapService } from '../../../core/services/map.service';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { BappieChatbotComponent } from '../../../shared/components/bappie-chatbot/bappie-chatbot.component';

@Component({
  selector: 'app-client-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [CommonModule, IonicModule, RouterModule, BappieChatbotComponent]
})
export class ClientTabsPage implements OnInit, OnDestroy {
  selectedServices: any[] = [];
  activeTab: string = 'service-search';
  private readonly destroy$ = new Subject<void>();

  // Maps tab names to child route segments defined in app.routes.ts
  private readonly tabRoutes: Record<string, string> = {
    'service-search': 'service-search',
    'service-map':    'service-map',
    'bookings':       'bookings',
    'chats':          'chats',
    'client-profile': 'profile'
  };

  constructor(
    private stateService: StateService,
    private router: Router,
    private mapService: MapService
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
    if (tabName === 'service-map') {
      setTimeout(() => this.mapService.resize(), 200);
    }
  }

  goToCategories() {
    this.router.navigate(['/client/categories']);
  }

  private updateActiveTabFromUrl(url: string) {
    if      (url.includes('/tabs/service-search')) this.activeTab = 'service-search';
    else if (url.includes('/tabs/service-map'))    this.activeTab = 'service-map';
    else if (url.includes('/tabs/bookings'))        this.activeTab = 'bookings';
    else if (url.includes('/tabs/chats'))           this.activeTab = 'chats';
    else if (url.includes('/tabs/profile'))         this.activeTab = 'client-profile';
  }
}

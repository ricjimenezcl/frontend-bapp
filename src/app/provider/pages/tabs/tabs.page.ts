import { Component, OnInit, OnDestroy, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

import { ProviderHomePage } from '../provider-home/provider-home.page';
import { ProviderBookingsPage } from '../provider-bookings/provider-bookings.page';
import { ProviderInboxPage } from '../provider-inbox/provider-inbox.page';
import { ProviderProfilePage } from '../provider-profile/provider-profile.page';
import { ProviderServiceDetailsPage } from '../provider-service-details/provider-service-details.page';

@Component({
  selector: 'app-provider-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    ProviderHomePage,
    ProviderBookingsPage,
    ProviderInboxPage,
    ProviderProfilePage,
    ProviderServiceDetailsPage
  ]
})
export class ProviderTabsPage implements OnInit, OnDestroy {
  activeTab = 'home';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Restore tab from router state (e.g. navigating back from sub-pages)
    const navState = history.state;
    if (navState?.activeTab) {
      this.activeTab = navState.activeTab;
    }

    // Keep activeTab in sync with URL (for external navigation / notifications)
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((e: NavigationEnd) => {
      this.updateTabFromUrl(e.urlAfterRedirects || e.url);
    });

    // Sync with current URL on init
    this.updateTabFromUrl(this.router.url);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  changeTab(tab: string) {
    this.activeTab = tab;
  }

  private updateTabFromUrl(url: string) {
    if (url.includes('/home')) {
      this.activeTab = 'home';
    } else if (url.includes('/service-details')) {
      this.activeTab = 'service-details';
    } else if (url.includes('/inbox')) {
      this.activeTab = 'inbox';
    } else if (url.includes('/bookings')) {
      this.activeTab = 'bookings';
    } else if (url.includes('/profile')) {
      this.activeTab = 'profile';
    }
  }
}

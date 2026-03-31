// src/app/client/pages/tabs/tabs.page.ts
import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { StateService } from '../../../shared/services/state.service';
import { MapService } from '../../../core/services/map.service';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

// Importa los componentes que usas en el template
import { ServiceSearchPage } from '../service-search/service-search.page';
import { ServiceMapPage } from '../service-map/service-map.page';
import { ClientBookingsPage } from '../bookings/bookings.page';
import { ClientProfilePage } from '../client-profile/client-profile.page';
import { ClientChatsPage } from '../client-chats/client-chats.page';

@Component({
  selector: 'app-client-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    // Agrega los componentes aquí
    ServiceSearchPage,
    ServiceMapPage,
    ClientBookingsPage,
    ClientProfilePage,
    ClientChatsPage
  ]
})
export class ClientTabsPage implements OnInit, OnDestroy {
  @ViewChild(ServiceMapPage) serviceMapPage?: ServiceMapPage;

  selectedServices: any[] = [];
  activeTab: string = 'service-search';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private stateService: StateService,
    private router: Router,
    private mapService: MapService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.stateService.selectedServices$
      .pipe(takeUntil(this.destroy$))
      .subscribe(services => {
        this.selectedServices = services;
        console.log('Servicios en tabs:', services);
      });

    console.log('TabsPage ngOnInit');

    // Actualizar pestaña activa basada en URL
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        this.updateActiveTabFromUrl(event.urlAfterRedirects || event.url);
      });
  }

  // Ionic lifecycle — fires after the entrance animation completes.
  // Ensures ion-content recalculates its scroll area by forcing a
  // display:none → flex transition on the active tab container, which
  // triggers Ionic v8's ResizeObserver. Uses cdr.detectChanges() for
  // synchronous CD + setTimeout to guarantee the browser commits the
  // layout change before restoring.
  ionViewDidEnter() {
    const tab = this.activeTab || 'service-search';
    this.activeTab = '';
    this.cdr.detectChanges();
    setTimeout(() => { this.activeTab = tab; }, 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  changeTab(tabName: string) {
    this.activeTab = tabName;
    if (tabName === 'service-map') {
      this.serviceMapPage?.initMapIfNeeded();
      setTimeout(() => this.mapService.resize(), 150);
    }
  }

  onSegmentChange(event: any) {
    console.log('Segment changed:', event.detail.value);
    this.activeTab = event.detail.value;
  }

  goToCategories() {
    this.router.navigate(['/client/categories']);
  }

  private updateActiveTabFromUrl(url: string) {
    if (url.includes('categories')) {
      this.activeTab = '';
    } else if (url.includes('service-search')) {
      this.activeTab = 'service-search';
    } else if (url.includes('service-map')) {
      this.activeTab = 'service-map';
    } else if (url.includes('bookings')) {
      this.activeTab = 'bookings';
    } else if (url.includes('chats')) {
      this.activeTab = 'chats';
    } else if (url.includes('client-profile')) {
      this.activeTab = 'client-profile';
    } else if (url.includes('tabs')) {
      // URL is /client/tabs with no specific tab segment (e.g. navigating
      // back from categories via router.navigate(['/client/tabs'])).
      // Default to service-search so the container is visible.
      this.activeTab = 'service-search';
    }
  }
}

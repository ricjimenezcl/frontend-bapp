// src/app/client/pages/service-search/service-search.page.ts
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, ToastController, InfiniteScrollCustomEvent, RefresherCustomEvent, ModalController, AlertController, LoadingController } from '@ionic/angular';
import { CoreService, ServiceCategory } from '../../../../shared/services/core.service';
import { SelectionService } from '../../../../shared/services/selection.service';
import { MapboxService } from '../../../../shared/services/mapbox.service';
import { ProviderImagePipe } from '../../../../shared/pipes/provider-image.pipe';
import { ProviderActionSheetComponent } from '../../../../shared/components/provider-action-sheet/provider-action-sheet.component';
import { StateService, SelectedService } from '../../../../shared/services/state.service';
import { AuthService } from '../../../../features/auth/services/auth.service';
import { GeoLocationService } from '../../../../shared/services/geo-location.service';
import { ContactLimitService } from '../../../../core/services/contact-limit.service';
import { PaymentRedirectService } from '../../../../services/payment-redirect.service';
import { ProductService } from '../../../../services/product.service';
import { Subject } from 'rxjs';
import { LoadingSkeletonComponent } from '../../../../shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { MapService } from '../../../../core/services/map.service';
import { ServiceMapPage } from '../service-map/service-map.page';

@Component({
  selector: 'app-service-search',
  templateUrl: './service-search.page.html',
  styleUrls: ['./service-search.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, ProviderImagePipe, ProviderActionSheetComponent, EmptyStateComponent, LoadingSkeletonComponent, ServiceMapPage]
})
export class ServiceSearchPage implements OnInit, OnDestroy {

  // Fusión service-search + service-map: alterna entre la lista de
  // proveedores y el mapa embebido sin perder el estado de ninguno de los dos.
  @ViewChild(ServiceMapPage) serviceMapPage?: ServiceMapPage;
  viewMode: 'list' | 'map' = 'list';

  categoryId: number = 0;
  categoryName: string = '';
  services: ServiceCategory[] = [];

  selectedServices: any[] = [];
  currentUser: any = null;
  providers: any[] = [];
  filteredProviders: any[] = [];

  userLocation: any = null;
  isLoading: boolean = false;
  searchTerm: string = '';
  selectedFilter: string = 'distance';
  filters = [
    { value: 'distance', label: 'Más cercanos' },
    { value: 'rating', label: 'Mejor calificados' }
  ];

  // ── Paginación ───────────────────────────────────────────────────────────
  private readonly PAGE_SIZE = 10;
  private currentSkip = 0;
  hasMore = true;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private coreService: CoreService,
    private selectionService: SelectionService,
    private stateService: StateService,
    private toastCtrl: ToastController,
    private authService: AuthService,
    private mapboxService: MapboxService,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private geoLocationService: GeoLocationService,
    private contactLimit: ContactLimitService,
    private paymentRedirect: PaymentRedirectService,
    private mapService: MapService,
    private productService: ProductService) {}

  /** Alterna entre la vista de lista y la de mapa (reemplaza el tab "service-map"). */
  setViewMode(mode: 'list' | 'map') {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    if (mode === 'map') {
      // Espera a que el contenedor del mapa quede visible antes de
      // inicializar/redimensionar MapLibre (necesita medir su tamaño real).
      setTimeout(() => {
        this.serviceMapPage?.initMapIfNeeded();
        this.mapService.resize();
      }, 150);
    }
  }

  /** true si el cliente autenticado tiene un plan premium activo (igual que provider-info.page / web) */
  hasPremiumAccess(): boolean {
    const currentUser = this.authService.getCurrentUser() as any;
    const profile = this.authService.getUserProfile() as any;
    return Boolean(currentUser?.has_premium || profile?.has_premium || this.productService.hasActivePlanSync());
  }

  /**
   * Marca cada proveedor de filteredProviders como locked/unlocked replicando
   * la regla de negocio de web (ContactLimitService): premium ve todo desbloqueado;
   * si no, se respetan los slots gratuitos por servicio y los proveedores ya contactados.
   */
  private applyContactLocks(): void {
    if (this.hasPremiumAccess()) {
      this.filteredProviders.forEach(p => { p.locked = false; });
      return;
    }

    const slotsMap = new Map<number, number>();
    this.filteredProviders.forEach(provider => {
      const svcId = provider.service_id ?? provider.serviceId ?? 0;
      const providerId = provider.provider_id ?? provider.id;
      const contacted = this.contactLimit.contactedProviders(svcId);

      if (contacted.includes(providerId)) {
        provider.locked = false;
        return;
      }

      if (!slotsMap.has(svcId)) {
        slotsMap.set(svcId, this.contactLimit.remaining(svcId));
      }
      const slots = slotsMap.get(svcId)!;
      if (slots > 0) {
        slotsMap.set(svcId, slots - 1);
        provider.locked = false;
      } else {
        provider.locked = true;
      }
    });
  }

  get activeLocationLabel(): string {
    const alt = this.stateService.getAlternateLocation();
    return alt ? alt.address : 'Tu ubicación actual';
  }

  ngOnInit() {
    this.productService.refreshActivePlan().subscribe();
    this.currentUser = this.authService.getCurrentUser();
    this.loadData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadServices(listServ: SelectedService[]) {
    if (!this.categoryId) {
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.coreService.getServiceCategories().subscribe({
      next: (data: ServiceCategory[]) => {
        this.services = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading services:', error);
        this.isLoading = false;
      }
    });
  }

  goBack() {
    this.router.navigate(['/client/tabs/categories']);
  }

  async loadData() {
    this.stateService.selectedServices$.subscribe(services => {
      this.selectedServices = services;
      if (services.length > 0) {
        this.loadUserLocation();
      }
    });
  }

  async loadUserLocation() {
    // Prefer alternate location selected in main-categories
    const alternate = this.stateService.getAlternateLocation();
    if (alternate) {
      this.userLocation = { latitude: alternate.latitude, longitude: alternate.longitude };
      this.loadProviders();
      return;
    }

    this.userLocation = this.stateService.getUserLocation();
    if (this.userLocation) {
      this.loadProviders();
      return;
    }

    // Fallback: request GPS directly (same pattern as service-map)
    const loading = await this.loadingCtrl.create({ message: 'Obteniendo tu ubicación...' });
    await loading.present();
    try {
      const position = await this.geoLocationService.getCurrentLocation();
      this.userLocation = { latitude: position.latitude, longitude: position.longitude, timestamp: Date.now() };
      this.stateService.setUserLocation(this.userLocation);
      await loading.dismiss();
      this.loadProviders();
    } catch (error) {
      await loading.dismiss();
      // Use default Santiago coordinates so the search still runs
      this.userLocation = { latitude: -33.4489, longitude: -70.6693, timestamp: Date.now() };
      this.presentToast('Usando ubicación por defecto (Santiago)', 'warning');
      this.loadProviders();
    }
  }

  /** Carga inicial (reset de paginación) */
  async loadProviders() {
    this.currentSkip = 0;
    this.hasMore = true;
    this.providers = [];
    await this.fetchPage();
  }

  /** Carga una página de resultados y la agrega a la lista */
  private async fetchPage(): Promise<number> {
    const location = this.stateService.getAlternateLocation() ?? this.userLocation;
    if (!location || this.selectedServices.length === 0) return 0;

    this.isLoading = true;
    let newCount = 0;

    try {
      const serviceIds = this.selectedServices.map((service: any) => service.id);

      const results = await this.coreService.getNearbyProvidersByServiceIds(
        location.latitude,
        location.longitude,
        20,
        serviceIds,
        this.currentSkip,
        this.PAGE_SIZE
      ).toPromise();

      const newProviders: any[] = (results ?? []).map((provider: any) => {
        const matchedService = this.selectedServices.find(
          (service: any) => service.id === (provider.service_id ?? provider.serviceId)
        );
        return {
          ...provider,
          serviceId: matchedService?.id ?? provider.service_id,
          serviceName: matchedService?.name,
          mainCategoryId: matchedService?.main_category_id
        };
      });

      newCount = newProviders.length;

      const deduped = this.removeDuplicates([...this.providers, ...newProviders]);
      this.providers = deduped;
      this.calculateProviderDistances();
      this.applyFilter();

      this.hasMore = newCount >= this.PAGE_SIZE;
      this.currentSkip += this.PAGE_SIZE;

    } catch (error: any) {
      console.error('Error cargando proveedores:', error);

      // Límite de negocio (plan gratuito): redirigir a categorías para mostrar el modal premium
      if (this.handleBusinessLimitError(error)) {
        return 0;
      }

      // ✅ Mensaje más informativo para el usuario
      let errorMsg = 'Error al cargar proveedores';
      if (error?.status === 0) {
        errorMsg = 'Conectando al servidor... Esto puede tardar hasta 30 segundos si el servidor está iniciándose.';
        // ✅ Reintento automático después de 5 segundos
        setTimeout(() => {
          if (this.providers.length === 0) {
            this.presentToast('Reintentando conexión...', 'warning');
            this.loadProviders();
          }
        }, 5000);
      } else if (error?.error?.detail && typeof error.error.detail === 'string') {
        errorMsg = error.error.detail;
      }
      this.presentToast(errorMsg, 'danger');
    } finally {
      this.isLoading = false;
    }
    return newCount;
  }

  /**
   * Detecta errores de límite de negocio (plan gratuito: 3 búsquedas/día o 3
   * servicios/búsqueda) devueltos por el backend y redirige a categorías con
   * `premium_reason` para que `MainCategoriesPage` muestre el modal premium.
   * Devuelve true si el error fue manejado (ya se redirigió).
   */
  private handleBusinessLimitError(error: any): boolean {
    const code = error?.error?.detail?.code;
    if (code === 'DAILY_SEARCH_LIMIT_REACHED' || code === 'FREE_SERVICE_SELECTION_LIMIT') {
      this.router.navigate(['/client/categories'], {
        queryParams: { premium_reason: code },
        replaceUrl: true,
      });
      return true;
    }
    return false;
  }

  removeDuplicates(providers: any[]): any[] {
    const seen = new Set();
    return providers.filter(provider => {
      const duplicate = seen.has(provider.id);
      if (!duplicate) {
        seen.add(provider.id);
        if (provider.serviceId) {
          provider.services = provider.services || [];
          if (!provider.services.includes(provider.serviceName)) {
            provider.services.push(provider.serviceName);
          }
        }
      }
      return !duplicate;
    });
  }

  calculateProviderDistances() {
    const location = this.stateService.getAlternateLocation() ?? this.userLocation;
    if (!location) return;

    this.providers.forEach(provider => {
      if (provider.latitude && provider.longitude) {
        provider.distance = this.mapboxService.calculateDistance(
          location.latitude,
          location.longitude,
          provider.latitude,
          provider.longitude
        );
      }
    });
  }

  applyFilter() {
    let filtered = this.providers.slice();

    if (this.searchTerm) {
      filtered = filtered.filter(provider =>
        provider.business_name?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        provider.description?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        provider.full_name?.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    switch (this.selectedFilter) {
      case 'distance':
        filtered.sort((a, b) => (a.distance || 999) - (b.distance || 999));
        break;
      case 'rating':
        filtered.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0));
        break;
    }

    this.filteredProviders = [...filtered];
    this.applyContactLocks();
  }

  onFilterChange(event: any) {
    this.selectedFilter = event.detail.value || 'distance';
    this.applyFilter();
  }

  onSearchChange(event: any) {
    this.searchTerm = event.detail.value || '';
    this.applyFilter();
  }

  async refresh(event: RefresherCustomEvent) {
    await this.loadProviders();
    event.target.complete();
  }

  async loadMore(event: InfiniteScrollCustomEvent) {
    await this.fetchPage();
    event.target.complete();
    if (!this.hasMore) {
      event.target.disabled = true;
    }
  }

  viewProviderDetails(provider: any) {
    console.log('Ver detalles del proveedor:', provider);
  }

  async openProviderDetails(provider: any) {
    // ✅ Sin breakpoints: modal full-screen igual que service-map.
    // Con breakpoints + handle el sheet arranca muy abajo y oculta hero/tabs/content.
    const modal = await this.modalCtrl.create({
      component: ProviderActionSheetComponent,
      componentProps: {
        provider,
        serviceId: provider.service_id ?? provider.serviceId
      },
      cssClass: 'provider-profile-modal'
    });
    await modal.present();
  }

  async presentToast(message: string, color: string = 'primary') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }

  getServicesForProvider(provider: any): string[] {
    return provider.services || [provider.serviceName];
  }

  async handleProviderInteraction(provider: any, index: number) {
    if (provider.locked) {
      const alert = await this.alertCtrl.create({
        header: 'Acceso premium',
        message: 'Con el plan gratuito solo puedes ver el contacto de un número limitado de proveedores por servicio. Activa tu plan para contactar a todos los proveedores.',
        buttons: [
          { text: 'Ahora no', role: 'cancel' },
          {
            text: 'Activar plan',
            handler: () => {
              this.paymentRedirect.openClientUnlock30(this.router.url);
            }
          }
        ]
      });
      await alert.present();
      return;
    }

    const svcId = provider.service_id ?? provider.serviceId ?? 0;
    const providerId = provider.provider_id ?? provider.id;
    this.contactLimit.recordContact(svcId, providerId);
    await this.openProviderDetails(provider);
  }

  bookProvider(provider: any) {
    console.log('Reservar con proveedor:', provider);
  }
}

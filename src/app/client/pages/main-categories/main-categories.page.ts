// src/app/client/pages/main-categories/main-categories.page.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, IonicModule } from '@ionic/angular';
import { CoreService, MainCategory, ServiceCategory, Subcategory, ServiceItem } from '../../../shared/services/core.service';
import { SelectionService } from '../../../shared/services/selection.service';
import { StateService } from '../../../shared/services/state.service';
import { GeoLocationService } from  '../../../shared/services/geo-location.service';
import { MapboxService } from '../../../shared/services/mapbox.service';
import { MapPickerComponent } from '../../../shared/components/map-picker/map-picker.component';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../auth/services/auth.service';
import { PaymentRedirectService } from '../../../services/payment-redirect.service';

@Component({
  selector: 'app-main-categories',
  templateUrl: './main-categories.page.html',
  styleUrls: ['./main-categories.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, MapPickerComponent],
})
export class MainCategoriesPage implements OnInit, OnDestroy {

  categories: MainCategory[] = [];
  mainCategories: MainCategory[] = [];
  selectedServices: ServiceCategory[] = [];
  selectedMainCategory: MainCategory | null = null;
  subcategoryOptions: Subcategory[] = [];
  selectedSubcategory: Subcategory | null = null;
  subcategories: ServiceCategory[] = [];
  isLoading = true;

  // Text search (in-memory filter over service categories)
  searchQuery = '';
  allCategories: ServiceCategory[] = [];
  filteredCategories: ServiceCategory[] = [];

  // Location search
  showLocationSearch = false;
  locationQuery = '';
  locationSuggestions: any[] = [];
  selectedLocationName = 'Tu ubicación actual';
  isLocationSearching = false;
  private locationSearch$ = new Subject<string>();
  private catalogSearchTimeout?: ReturnType<typeof setTimeout>;

  // Map picker
  showMapPicker = false;
  mapPickerInitialLat = -33.4489;  // Santiago Centro por defecto
  mapPickerInitialLng = -70.6693;
  readonly maxFreeServices = 3;
  readonly freeDailySearchLimit = 3;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private alertCtrl: AlertController,
    private coreService: CoreService,
    private selectionService: SelectionService,
    private stateService: StateService,
    private geoLocationService: GeoLocationService,
    private mapboxService: MapboxService,
    private authService: AuthService,
    private paymentRedirect: PaymentRedirectService
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS — homologado con web
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Verifica si el icono es una URL de imagen (http/https)
   * Si no lo es, se asume que es un nombre de ion-icon
   */
  isImageUrl(icon: string | null | undefined): boolean {
    if (!icon) return false;
    return icon.startsWith('http://') || icon.startsWith('https://');
  }

  ngOnInit() {
    this.handlePremiumReasonFromQuery();

    this.loadMainCategories();
    this.coreService.getServiceCatalog().subscribe({
      next: (cats) => {
        this.allCategories = cats;
        this.applySearchFilter();
      },
      error: () => {}
    });

    this.locationSearch$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length < 2) { this.locationSuggestions = []; return []; }
        this.isLocationSearching = true;
        return this.mapboxService.autocompleteChile(query);
      })
    ).subscribe({
      next: (features) => {
        this.locationSuggestions = features;
        this.isLocationSearching = false;
      },
      error: () => { this.isLocationSearching = false; }
    });
  }

  ngOnDestroy() {
    this.locationSearch$.complete();
  }

  ionViewWillEnter() {
    // Limpiar selecciones previas al entrar
    this.selectionService.clearSelectedServices();
  }

  async loadMainCategories() {
    this.isLoading = true;
    
    this.coreService.getMainCategories().subscribe({
      next: (categories) => {
        this.mainCategories = categories;
        this.isLoading = false;
        console.log('Categorías cargadas:', categories?.length);
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.isLoading = false;
  
      }
    });
  }

  selectCategory(category: MainCategory) {
    this.selectionService.setCategoryId(category.id);
    this.router.navigate(['/client/tabs'], {
      queryParams: { categoryId: category.id, categoryName: category.name }
    });
  }

  selectMainCategory(category: MainCategory) {
    this.selectedMainCategory = category;
    this.selectedSubcategory = null;
    this.subcategoryOptions = [];
    this.subcategories = [];
    this.selectedServices = [];
    this.isLoading = true;

    this.coreService.getSubcategories(category.id).subscribe({
      next: (subs) => {
        this.subcategoryOptions = subs;
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  onSubcategoryChange(subcategoryId: number) {
    if (!subcategoryId) {
      this.selectedSubcategory = null;
      this.subcategories = [];
      this.selectedServices = [];
      return;
    }
    this.selectedSubcategory = this.subcategoryOptions.find(s => s.id === subcategoryId) ?? null;
    this.subcategories = [];
    this.selectedServices = [];
    this.isLoading = true;

    this.coreService.getServicesBySubcategory(subcategoryId).subscribe({
      next: (services: ServiceItem[]) => {
        this.subcategories = services.map(s => ({
          id: s.service_category_id ?? s.id,
          name: s.name,
          description: s.description ?? '',
          main_category_id: this.selectedMainCategory?.id ?? 0,
          icon: s.icon ?? '',
          is_active: true,
          created_at: '',
        }));
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  clearSubcategory() {
    this.selectedSubcategory = null;
    this.subcategories = [];
    this.selectedServices = [];
  }

  loadSubcategories(mainCategoryId: number) {
    // Mantenido por compatibilidad — ya no se usa en el flujo principal
    this.coreService.getSubcategories(mainCategoryId).subscribe({
      next: (subs) => { this.subcategoryOptions = subs; this.isLoading = false; },
      error: () => { this.isLoading = false; }
    });
  }

 getCategoryIcon(categoryName: string): string {
    const iconMap: {[key: string]: string} = {
      'construcción': 'hammer',
      'fontanería': 'water',
      'electricidad': 'flash',
      'carpintería': 'construct',
      'jardinería': 'leaf',
      'limpieza': 'sparkles',
      'mascotas': 'paw',
      'reparaciones': 'build',
      'belleza': 'cut',
      'salud': 'medkit',
      'educación': 'school',
      'transporte': 'car',
      'eventos': 'calendar',
      'tecnología': 'laptop',
      'alimentos': 'restaurant'
    };
    
    const lowerName = categoryName.toLowerCase();
    for (const [key, icon] of Object.entries(iconMap)) {
      if (lowerName.includes(key)) {
        return icon;
      }
    }
    
    return 'build';
  }

   toggleService(service: ServiceCategory) {
    const index = this.selectedServices.findIndex(s => s.id === service.id);
    if (index >= 0) {
      this.selectedServices.splice(index, 1);
    } else {
      if (!this.hasPremiumAccess() && this.selectedServices.length >= this.maxFreeServices) {
        this.presentPremiumLimitAlert('FREE_SERVICE_SELECTION_LIMIT');
        return;
      }
      this.selectedServices.push(service);
    }
    console.log('Servicios seleccionados:', this.selectedServices);
  }

  private hasPremiumAccess(): boolean {
    const currentUser = this.authService.getCurrentUser() as any;
    const profile = this.authService.getUserProfile() as any;
    return Boolean(currentUser?.has_premium || profile?.has_premium);
  }

  private handlePremiumReasonFromQuery(): void {
    this.route.queryParamMap.subscribe((params) => {
      const reason = params.get('premium_reason');
      if (!this.hasPremiumAccess() && (reason === 'DAILY_SEARCH_LIMIT_REACHED' || reason === 'FREE_SERVICE_SELECTION_LIMIT')) {
        this.presentPremiumLimitAlert(reason);
      }
    });
  }

  private async presentPremiumLimitAlert(
    reason: 'DAILY_SEARCH_LIMIT_REACHED' | 'FREE_SERVICE_SELECTION_LIMIT'
  ): Promise<void> {
    const isDailyLimit = reason === 'DAILY_SEARCH_LIMIT_REACHED';
    const header = isDailyLimit ? 'Límite diario alcanzado' : 'Límite de selección gratuita';
    const message = isDailyLimit
      ? `Ya usaste tus ${this.freeDailySearchLimit} búsquedas gratuitas del día. Desbloquea Premium para seguir buscando.`
      : `Con plan gratuito puedes seleccionar hasta ${this.maxFreeServices} servicios. Desbloquea Premium para seleccionar más.`;

    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: [
        {
          text: 'Más tarde',
          role: 'cancel',
          handler: () => this.clearPremiumReasonQueryParam(),
        },
        {
          text: 'Desbloquear Premium',
          handler: () => {
            this.clearPremiumReasonQueryParam();
            this.paymentRedirect.openClientUnlock('/client/tabs/categories');
          },
        },
      ],
    });

    await alert.present();
  }

  private clearPremiumReasonQueryParam(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { premium_reason: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  isServiceSelected(service: ServiceCategory): boolean {
    return this.selectedServices.some(s => s.id === service.id);
  }


  async confirmSelection() {
    if (!this.selectedMainCategory || this.selectedServices.length === 0) {
      return;
    }

    // Convertir a SelectedService para el SelectionService
    const selectedServicesData = this.selectedServices.map(service => ({
      id: service.id,
      name: service.name,
      description: service.description,
      main_category_id: this.selectedMainCategory!.id,
      mainCategoryName: this.selectedMainCategory!.name
    }));

    // Guardar en el servicio compartido
    this.stateService.setSelectedServices(selectedServicesData);

    // Obtener y guardar ubicación actual del usuario
    try {
      const position = await this.geoLocationService.getCurrentLocation();
      this.stateService.setUserLocation({
        latitude: position.latitude,
        longitude: position.longitude,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error obteniendo ubicación:', error);
      // Si el GPS falla, seguimos con Santiago Centro como fallback para no bloquear la búsqueda.
      this.stateService.setUserLocation({
        latitude: -33.4489,
        longitude: -70.6693,
        timestamp: Date.now()
      });
    }

    // Navegar a la página de tabs (siempre, independiente de si la ubicación falló)
    this.router.navigate(['/client/tabs'], { replaceUrl: true });
  }

  // ── Location search ──────────────────────────────────────────────────
  toggleLocationSearch() {
    this.showLocationSearch = !this.showLocationSearch;
    if (!this.showLocationSearch) {
      this.locationSuggestions = [];
      this.locationQuery = '';
    }
  }

  onLocationInput(event: any) {
    const q = (event.target?.value ?? '').trim();
    this.locationQuery = q;
    this.locationSearch$.next(q);
  }

  selectLocation(feature: any) {
    const [lng, lat] = feature.center;
    const address = feature.place_name || feature.text;
    this.stateService.setAlternateLocation({ latitude: lat, longitude: lng, address });
    this.selectedLocationName = feature.text || address;
    this.showLocationSearch = false;
    this.locationSuggestions = [];
    this.locationQuery = '';
  }

  clearLocation() {
    this.stateService.setAlternateLocation(null);
    this.selectedLocationName = 'Tu ubicación actual';
    this.showLocationSearch = false;
    this.locationSuggestions = [];
    this.locationQuery = '';
  }

  // ── Map picker methods ───────────────────────────────────────────────
  async openMapPicker() {
    console.log('🗺️ Abriendo map picker');
    
    // Priorizar ubicación alternativa, luego ubicación del usuario, finalmente default Santiago
    const altLocation = this.stateService.getAlternateLocation();
    if (altLocation) {
      this.mapPickerInitialLat = altLocation.latitude;
      this.mapPickerInitialLng = altLocation.longitude;
    } else {
      const userLocation = this.stateService.getUserLocation();
      if (userLocation) {
        this.mapPickerInitialLat = userLocation.latitude;
        this.mapPickerInitialLng = userLocation.longitude;
      } else {
        // Intentar obtener ubicación GPS actual
        const position = await this.geoLocationService.getCurrentLocation().catch(() => null);
        if (position) {
          this.mapPickerInitialLat = position.latitude;
          this.mapPickerInitialLng = position.longitude;
        } else {
          console.log('No se pudo obtener ubicación GPS, usando Santiago Centro');
        }
      }
    }
    
    this.showMapPicker = true;
    this.showLocationSearch = false;
  }

  onLocationSelected(location: { lat: number; lng: number; address: string }) {
    console.log('📍 Ubicación seleccionada desde mapa:', location);
    this.stateService.setAlternateLocation({
      latitude: location.lat,
      longitude: location.lng,
      address: location.address
    });
    this.selectedLocationName = location.address;
    this.showMapPicker = false;
  }

  onMapPickerClose() {
    console.log('🗺️ Cerrando map picker');
    this.showMapPicker = false;
  }

  onSearchInput(event: any) {
    const q = String(event?.detail?.value ?? event?.target?.value ?? '')
      .trim();
    this.searchQuery = q;

    if (this.catalogSearchTimeout) {
      clearTimeout(this.catalogSearchTimeout);
    }

    if (q.length >= 2) {
      this.catalogSearchTimeout = globalThis.setTimeout(() => {
        this.coreService.getServiceCatalog(q).subscribe({
          next: (cats) => {
            this.allCategories = cats;
            this.applySearchFilter();
          },
          error: () => {
            this.applySearchFilter();
          }
        });
      }, 250);
      return;
    }

    this.applySearchFilter();
  }

  clearSearch() {
    this.searchQuery = '';
    this.applySearchFilter();
  }

  private applySearchFilter(): void {
    const q = this.normalizeSearchText(this.searchQuery).trim();
    if (q.length < 2) {
      this.filteredCategories = [];
      return;
    }

    this.filteredCategories = this.allCategories
      .filter(c =>
        this.normalizeSearchText(c.name).includes(q) ||
        this.normalizeSearchText(c.description).includes(q)
      )
      .slice(0, 8);
  }

  private normalizeSearchText(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  selectServiceCategory(cat: ServiceCategory) {
    this.searchQuery = '';
    this.filteredCategories = [];
    this.router.navigate(['/client/service-search'], { queryParams: { service_id: cat.id } });
  }

  cancel() {
    // Navegar atrás al home del cliente
    this.router.navigate(['/client']);
  }
  doRefresh(event: any) {
    this.coreService.getMainCategories().subscribe({
      next: (data) => {
        this.categories = data;
        event.target.complete();
      },
      error: () => {
        event.target.complete();
      }
    });
  }
}

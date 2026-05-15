// src/app/client/pages/main-categories/main-categories.page.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CoreService, MainCategory, ServiceCategory } from '../../../shared/services/core.service';
import { SelectionService } from '../../../shared/services/selection.service';
import { StateService } from '../../../shared/services/state.service';
import { GeoLocationService } from  '../../../shared/services/geo-location.service';
import { MapboxService } from '../../../shared/services/mapbox.service';
import { MapPickerComponent } from '../../../shared/components/map-picker/map-picker.component';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

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

  // Map picker
  showMapPicker = false;
  mapPickerInitialLat = -33.4489;  // Santiago Centro por defecto
  mapPickerInitialLng = -70.6693;

  constructor(
    private router: Router,
    private coreService: CoreService,
    private selectionService: SelectionService,
    private stateService: StateService,
    private geoLocationService: GeoLocationService,
    private mapboxService: MapboxService
  ) {}

  ngOnInit() {
    this.loadMainCategories();
    this.coreService.getServiceCategories().subscribe({
      next: (cats) => { this.allCategories = cats; },
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
    console.log("selectMainCategory : ", category);
    this.selectedMainCategory = category;
    this.selectedServices = [];
    this.loadSubcategories(category.id);
  }

  loadSubcategories(mainCategoryId: number) {
    this.isLoading = true;
    console.log("loadSubcategories : ", mainCategoryId);
    
    this.coreService.getMainCategoryWithServices(mainCategoryId).subscribe({
      next: (subcategories: ServiceCategory[]) => {
        this.subcategories = subcategories || [];
        this.isLoading = false;
        console.log("subcategories : ", subcategories);
      },
      error: (error) => {
        console.error('Error loading subcategories:', error);
        this.subcategories = [];
        this.isLoading = false;
       
      }
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
      this.selectedServices.push(service);
    }
    console.log('Servicios seleccionados:', this.selectedServices);
  }

  isServiceSelected(service: ServiceCategory): boolean {
    return this.selectedServices.some(s => s.id === service.id);
  }


  async confirmSelection() {
    if (this.selectedMainCategory && this.selectedServices.length > 0) {
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
        // Usar ubicación por defecto de Santiago para no bloquear navegación
        this.stateService.setUserLocation({
          latitude: -33.4489,
          longitude: -70.6693,
          timestamp: Date.now()
        });
      }

      // Navegar a la página de tabs (siempre, independiente de si la ubicación falló)
      this.router.navigate(['/client/tabs'], { replaceUrl: true });
    } else {

    }
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
        try {
          const position = await this.geoLocationService.getCurrentLocation();
          this.mapPickerInitialLat = position.latitude;
          this.mapPickerInitialLng = position.longitude;
        } catch (error) {
          console.log('No se pudo obtener ubicación GPS, usando Santiago Centro');
          // Mantener valores por defecto
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
    const q = (event.target?.value ?? '').toLowerCase().trim();
    this.searchQuery = q;
    if (!q) { this.filteredCategories = []; return; }
    this.filteredCategories = this.allCategories
      .filter(c => c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }

  clearSearch() {
    this.searchQuery = '';
    this.filteredCategories = [];
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

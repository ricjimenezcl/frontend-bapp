// src/app/client/pages/service-map/service-map.page.ts
import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule, LoadingController, ToastController, ModalController, AlertController } from '@ionic/angular';
import { Subject, Subscription, firstValueFrom } from 'rxjs';
import { skip, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { StateService, SelectedService } from '../../../shared/services/state.service';

// Services
import { MapService, MAP_STYLES } from '../../../core/services/map.service';
import { ClientProviderService } from '../../services/client-provider.service';
import { GeoJSONFeatureCollection } from '../../../core/models/geo-provider.model';
import { MapboxService } from '../../../shared/services/mapbox.service';
import { ProviderActionSheetComponent } from '../../../shared/components/provider-action-sheet/provider-action-sheet.component';
import { GeoLocationService } from  '../../../shared/services/geo-location.service';

@Component({
  selector: 'app-service-map',
  templateUrl: './service-map.page.html',
  styleUrls: ['./service-map.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, ProviderActionSheetComponent]
})
export class ServiceMapPage implements OnInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  // Estados
  isLoading: boolean = false;
  selectedServices: SelectedService[] = [];
  userLocation: { lat: number; lng: number } | null = null;
  providerCount: number = 0;
  providers: any[] = [];
  
  // Limitación de proveedores (mismo que service-search)
  readonly freeProviderLimit = 5;
  selectedFilter: string = 'distance'; // 'distance' o 'rating'
  
  // Configuración del mapa
  currentMapStyle: string = 'dark';
  zoomLevel: number = 14;

  // Flag para evitar inicialización múltiple
  private mapInitialized: boolean = false;
  private userMarkerAdded: boolean = false;

  private subscriptions: Subscription[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private stateService: StateService,
    private mapService: MapService,
    private clientProviderService: ClientProviderService,
    private mapboxService: MapboxService,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private geoLocationService: GeoLocationService,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    // Initial value — just store, map init happens via initMapIfNeeded()
    this.selectedServices = this.stateService.getSelectedServices();

    // React to selection changes after the first emit (skip initial replay)
    this.stateService.selectedServices$
      .pipe(
        skip(1),
        distinctUntilChanged((a, b) =>
          a.length === b.length && a.every((s, i) => s.id === b[i]?.id)
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(services => {
        this.selectedServices = services;
        if (services.length === 0) return;
        if (this.mapInitialized) {
          // Map already rendered — just refresh location + markers
          this.loadUserLocation().then(() => {
            if (this.userLocation) {
              this.mapService.flyTo([this.userLocation.lng, this.userLocation.lat], this.zoomLevel);
              this.addUserMarker();
              this.loadProviders();
            }
          });
        }
        // If not initialized yet, initMapIfNeeded() will pick up the new services
      });

    // Cluster: click en punto individual → abrir ActionSheet
    const clusterSub = this.mapService.clusterPointClick$.subscribe(provider => {
      this.openProviderDetails(provider);
    });
    this.subscriptions.push(clusterSub);
  }

  // Ionic lifecycle — fires when this tab becomes visible via ion-router-outlet.
  ionViewWillEnter() {
    this.initMapIfNeeded();
    setTimeout(() => this.mapService.resize(), 200);
  }

  /** Called by ionViewWillEnter; safe to call multiple times (guarded by mapInitialized). */
  initMapIfNeeded() {
    if (!this.mapInitialized) {
      setTimeout(() => this.initializeFlow(), 100);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.mapService.destroy();
    this.mapInitialized = false;
    this.userMarkerAdded = false;
  }

  async initializeFlow() {
    if (this.mapInitialized) return;

    try {
      await this.loadUserLocation();

      if (!this.userLocation || !this.mapContainer) return;

      this.mapInitialized = true;

      this.mapService.initializeMap(
        this.mapContainer.nativeElement,
        [this.userLocation.lng, this.userLocation.lat],
        this.zoomLevel,
        MAP_STYLES[this.currentMapStyle as keyof typeof MAP_STYLES]
      );

      const mapLoadedSub = this.mapService.mapLoaded$.subscribe(loaded => {
        if (loaded && !this.userMarkerAdded) {
          this.userMarkerAdded = true;
          this.addUserMarker();
          this.loadProviders();
        }
      });
      this.subscriptions.push(mapLoadedSub);

    } catch (error) {
      console.error('Error flow initialization:', error);
      this.presentToast('Error inicializando el mapa', 'danger');
      this.mapInitialized = false;
    }
  }

  async loadUserLocation() {
    // Prefer alternate location selected by user in main-categories
    const alternate = this.stateService.getAlternateLocation();
    if (alternate) {
      this.userLocation = { lat: alternate.latitude, lng: alternate.longitude };
      return;
    }

    const savedLocation = this.stateService.getUserLocation();

    if (savedLocation) {
      this.userLocation = {
        lat: savedLocation.latitude,
        lng: savedLocation.longitude
      };
    } else {
      const loading = await this.loadingCtrl.create({ 
        message: 'Obteniendo tu ubicación...',
        cssClass: 'custom-loading'
      });
      await loading.present();

      try {
        const position = await this.geoLocationService.getCurrentLocation();
        this.userLocation = { lat: position.latitude, lng: position.longitude };

        this.stateService.setUserLocation({
          latitude: position.latitude,
          longitude: position.longitude,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Location error:', error);
        this.userLocation = { lat: -33.451060, lng: -70.591697 };
        this.presentToast('Usando ubicación por defecto (Santiago)', 'warning');
      } finally {
        await loading.dismiss();
      }
    }
  }

  addUserMarker() {
    if (!this.userLocation) return;

    this.mapService.clearUserMarker();

    // SVG Cloudinary: mismo que web (ubi_cli_2)
    const userIconUrl = 'https://res.cloudinary.com/dghwotofx/image/upload/v1782705912/ubi_cli_2_nlnxac.svg';

    // Contenedor: 34px (levemente más grande que proveedores de 30px)
    const markerSize = 34;
    const pulseSize = 50;
    const el = document.createElement('div');
    el.className = 'user-marker-container';
    el.style.width = `${markerSize}px`;
    el.style.height = `${markerSize}px`;
    el.style.position = 'relative';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';

    const img = new Image();
    img.src = userIconUrl;

    img.onload = () => {
      el.innerHTML = `
        <div class="pulse-ring" style="position:absolute;top:50%;left:50%;width:${pulseSize}px;height:${pulseSize}px;margin-top:-${pulseSize / 2}px;margin-left:-${pulseSize / 2}px;border-radius:50%;background:rgba(253,215,53,0.3);animation:pulse-animation 2s ease-out infinite;pointer-events:none;"></div>
        <img class="user-icon" src="${userIconUrl}" alt="Tu ubicación" style="width:${markerSize}px;height:${markerSize}px;display:block;object-fit:contain;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.3);position:relative;z-index:1;" />
      `;
    };

    img.onerror = () => {
      // Fallback: SVG inline idéntico al pin rojo del hero de la web
      el.innerHTML = `
        <div class="pulse-ring" style="position:absolute;top:50%;left:50%;width:${pulseSize}px;height:${pulseSize}px;margin-top:-${pulseSize / 2}px;margin-left:-${pulseSize / 2}px;border-radius:50%;background:rgba(253,215,53,0.3);animation:pulse-animation 2s ease-out infinite;pointer-events:none;"></div>
        <svg class="user-icon" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" style="width:${markerSize}px;height:${markerSize}px;display:block;position:relative;z-index:1;">
          <path d="M12 1C6.48 1 2 5.48 2 11c0 7.3 10 20 10 20s10-12.7 10-20C22 5.48 17.52 1 12 1z" fill="#BE202E" stroke="#FFFFFF" stroke-width="1.5"/>
          <circle cx="12" cy="11" r="4.2" fill="#FFFFFF"/>
          <circle cx="12" cy="11" r="2.1" fill="#1F2937"/>
        </svg>
      `;
    };

    const popupContent = `
      <div class="user-popup">
        <strong>Tu ubicación</strong><br>
        <small>Lat: ${this.userLocation.lat.toFixed(6)}</small><br>
        <small>Lng: ${this.userLocation.lng.toFixed(6)}</small>
      </div>
    `;

    this.mapService.addCustomMarker(
      [this.userLocation.lng, this.userLocation.lat],
      el,
      popupContent,
      'user'
    );
  }

  async loadProviders() {
    if (!this.userLocation || this.selectedServices.length === 0) return;

    this.isLoading = true;
    this.providers = [];
    this.mapService.clearProviderCluster();

    try {
      const promises = this.selectedServices.map(service =>
        firstValueFrom(this.clientProviderService.getNearbyProviders(
          this.userLocation!.lat,
          this.userLocation!.lng,
          20,
          service.id
        ))
      );

      const results = await Promise.all(promises);
      const allFeatures = results.flatMap(res => res.features);
      const uniqueFeatures = Array.from(
        new Map(allFeatures.map(f => [f.properties.id, f])).values()
      );

      this.providerCount = uniqueFeatures.length;

      // Mapear features a providers con distancia calculada
      this.providers = uniqueFeatures.map(f => ({
        ...f.properties,
        coordinates: f.geometry.coordinates,
        distance: this.calculateDistance(f.geometry.coordinates)
      }));

      // Aplicar ordenamiento y marcar proveedores bloqueados
      this.sortProviders();

      // Crear GeoJSON con propiedad isLocked
      const collection: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: this.providers.map(p => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: p.coordinates as [number, number] },
          properties: { ...p, isLocked: p.isLocked }
        }))
      };
      this.mapService.addProviderCluster(collection);

    } catch (error) {
      console.error('Error loading providers:', error);
      this.presentToast('Error cargando proveedores', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Calcula la distancia entre la ubicación del usuario y un proveedor
   */
  private calculateDistance(coordinates: number[]): number {
    if (!this.userLocation || !coordinates || coordinates.length < 2) return 999;
    
    return this.mapboxService.calculateDistance(
      this.userLocation.lat,
      this.userLocation.lng,
      coordinates[1], // latitude
      coordinates[0]  // longitude
    );
  }

  /**
   * Ordena proveedores según el filtro seleccionado y marca los bloqueados
   * Usa la misma lógica que service-search para consistencia
   */
  private sortProviders(): void {
    switch (this.selectedFilter) {
      case 'distance':
        this.providers.sort((a, b) => (a.distance || 999) - (b.distance || 999));
        break;
      case 'rating':
        this.providers.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0));
        break;
    }

    // Marcar proveedores bloqueados (índice >= 5)
    this.providers.forEach((provider, index) => {
      provider.isLocked = index >= this.freeProviderLimit;
    });
  }

  // ============ Controles del mapa ============

  zoomIn() {
    this.mapService.zoomIn();
  }

  zoomOut() {
    this.mapService.zoomOut();
  }

  locateUser() {
    if (this.userLocation) {
      this.mapService.flyTo(
        [this.userLocation.lng, this.userLocation.lat],
        this.zoomLevel
      );
    }
  }

  changeMapStyle(style: string) {
    this.currentMapStyle = style;
    const styleUrl = MAP_STYLES[style as keyof typeof MAP_STYLES];
    if (styleUrl) {
      this.mapService.clearMarkers();
      this.mapService.setStyle(styleUrl);
      
      setTimeout(() => {
        this.addUserMarker();
        if (this.providers.length > 0) {
          const collection: GeoJSONFeatureCollection = {
            type: 'FeatureCollection',
            features: this.providers.map(p => ({
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: p.coordinates as [number, number] },
              properties: { ...p, isLocked: p.isLocked }
            }))
          };
          this.mapService.addProviderCluster(collection);
        }
      }, 500);
    }
  }

  // ============ Navegación y eventos ============

  async openProviderDetails(provider: any) {
    // Validar si el proveedor está bloqueado
    if (provider.isLocked) {
      await this.showPremiumAlert();
      return;
    }

    const modal = await this.modalCtrl.create({
      component: ProviderActionSheetComponent,
      componentProps: {
        provider,
        serviceId: provider.service_id
      },
      cssClass: 'provider-profile-modal'
    });
    await modal.present();
  }

  /**
   * Muestra alerta de acceso premium (mismo mensaje que service-search)
   */
  private async showPremiumAlert(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Acceso premium',
      message: `Con el plan gratuito puedes interactuar con los primeros ${this.freeProviderLimit} proveedores. Activa tu plan de 7 días para contactar a todos los proveedores.`,
      buttons: [
        { text: 'Ahora no', role: 'cancel' },
        { 
          text: 'Activar plan', 
          handler: () => {
            // TODO: navegar a pantalla de pago/suscripción
            console.log('Navegando a plan premium...');
          }
        }
      ]
    });
    await alert.present();
  }

  async retryLocation() {
    this.userLocation = null;
    await this.loadUserLocation();
    if (this.userLocation) {
      const location: { lat: number; lng: number } = this.userLocation;
      this.mapService.flyTo(
        [location.lng, location.lat],
        this.zoomLevel
      );
      this.addUserMarker();
      this.loadProviders();
    }
  }

  async refresh(event?: any) {
    await this.loadProviders();
    if (event) {
      event.target.complete();
    }
  }

  goBack() {
    this.router.navigate(['/client/categories']);
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
}
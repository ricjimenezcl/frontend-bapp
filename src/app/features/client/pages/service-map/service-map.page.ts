// src/app/client/pages/service-map/service-map.page.ts
import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule, LoadingController, ToastController, ModalController, AlertController } from '@ionic/angular';
import { Subject, Subscription, firstValueFrom } from 'rxjs';
import { skip, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { animate, JSAnimation } from 'animejs';
import { StateService, SelectedService } from '../../../../shared/services/state.service';

// Services
import { MapService, MAP_STYLES } from '../../../../core/services/map.service';
import { ClientProviderService } from '../../services/client-provider.service';
import { GeoJSONFeatureCollection } from '../../../../core/models/geo-provider.model';
import { MapboxService } from '../../../../shared/services/mapbox.service';
import { ProviderActionSheetComponent } from '../../../../shared/components/provider-action-sheet/provider-action-sheet.component';
import { GeoLocationService } from '../../../../shared/services/geo-location.service';

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

  // Animación interactiva (animejs) del pin de ubicación del usuario
  private userMarkerAnimation: JSAnimation | null = null;

  // Escalado del pin de usuario según el zoom del mapa (marcador DOM, no capa MapLibre:
  // no reacciona solo a 'icon-size' como los pines de proveedor, hay que escalarlo a mano).
  private userMarkerScaleEl: HTMLDivElement | null = null;
  private zoomListenerAttached = false;
  // [zoom, factor] — factor 1 = tamaño base (MARKER_SIZE) en zoomLevel inicial (14).
  // Mismas proporciones relativas que los stops de 'icon-size' en map.service.ts.
  private readonly userMarkerZoomStops: Array<[number, number]> = [
    [2, 0.25],
    [6, 0.4],
    [10, 0.6],
    [14, 1],
    [18, 1.6],
    [22, 2.5]
  ];

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
    this.userMarkerAnimation?.pause();
    this.userMarkerAnimation = null;
    this.userMarkerScaleEl = null;
    this.zoomListenerAttached = false;
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
          this.attachZoomListener();
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

    // SVG Cloudinary: mismo ícono que usa actualmente proyecto web (createUserMarker)
    const userIconUrl = 'https://res.cloudinary.com/dghwotofx/image/upload/v1789871024/pin_ubicacion_j7u7ov.svg';

    // NOTA: este elemento se crea con document.createElement fuera del árbol de
    // renderizado de Angular, por lo que el encapsulamiento de estilos (ViewEncapsulation.Emulated)
    // NO aplica las clases de service-map.page.scss aquí. Por eso el tamaño se fija inline.
    const MARKER_SIZE = 44;

    // Contenedor del marcador de usuario.
    // IMPORTANTE: este nodo (`el`) es el que MapLibre usa directamente para
    // posicionar el marcador en el mapa (le escribe su propio `style.transform`
    // en cada redibujado). NO se debe animar `el` con animejs porque ambos
    // pelearían por la misma propiedad y el marcador "saltaría" a la esquina
    // (0,0) cada vez que uno pisara el transform del otro.
    const el = document.createElement('div');
    el.className = 'user-marker-container';
    el.style.cssText = `
      width: ${MARKER_SIZE}px;
      height: ${MARKER_SIZE}px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Wrapper interno: aquí sí se aplica la animación de rebote (animejs),
    // independiente del transform de posicionamiento que controla MapLibre.
    const bounceEl = document.createElement('div');
    bounceEl.className = 'user-marker-bounce';
    bounceEl.style.cssText = `
      width: ${MARKER_SIZE}px;
      height: ${MARKER_SIZE}px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    el.appendChild(bounceEl);

    // Animación interactiva (animejs): rebote continuo que indica que este
    // pin representa la ubicación actual del usuario.
    this.userMarkerAnimation?.pause();
    this.userMarkerAnimation = animate(bounceEl, {
      translateY: [0, -8, 0, -3, 0],
      duration: 1800,
      ease: 'inOutSine',
      loop: true
    });

    // Wrapper dedicado solo al escalado por zoom (transform: scale()), separado
    // del transform de posicionamiento (el, controlado por MapLibre) y del
    // transform de rebote (bounceEl, controlado por animejs) para que ninguno
    // pise la propiedad `transform` del otro.
    const scaleEl = document.createElement('div');
    scaleEl.className = 'user-marker-scale';
    scaleEl.style.cssText = `
      width: ${MARKER_SIZE}px;
      height: ${MARKER_SIZE}px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform-origin: center center;
    `;
    bounceEl.appendChild(scaleEl);
    this.userMarkerScaleEl = scaleEl;

    const currentZoom = this.mapService.getMap()?.getZoom() ?? this.zoomLevel;
    this.updateUserMarkerScale(currentZoom);

    const iconStyle = `
      width: ${MARKER_SIZE}px;
      height: ${MARKER_SIZE}px;
      border-radius: 50%;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      position: relative;
      z-index: 1;
      display: block;
      object-fit: cover;
    `;

    const img = new Image();
    img.src = userIconUrl;

    img.onload = () => {
      scaleEl.innerHTML = `
        <img class="user-icon" src="${userIconUrl}" alt="Tu ubicación" style="${iconStyle}" />
      `;
    };

    img.onerror = () => {
      // Fallback: SVG inline idéntico al pin rojo del hero de la web
      scaleEl.innerHTML = `
        <svg class="user-icon" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" style="${iconStyle}">
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

  /** Engancha el listener de zoom del mapa una sola vez para reescalar el pin de usuario. */
  private attachZoomListener() {
    if (this.zoomListenerAttached) return;
    const map = this.mapService.getMap();
    if (!map) return;

    map.on('zoom', () => this.updateUserMarkerScale(map.getZoom()));
    this.zoomListenerAttached = true;
  }

  /** Interpola linealmente el factor de escala del pin de usuario según el zoom actual. */
  private computeUserMarkerScale(zoom: number): number {
    const stops = this.userMarkerZoomStops;

    if (zoom <= stops[0][0]) return stops[0][1];
    if (zoom >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];

    for (let i = 0; i < stops.length - 1; i++) {
      const [z0, s0] = stops[i];
      const [z1, s1] = stops[i + 1];
      if (zoom >= z0 && zoom <= z1) {
        const t = (zoom - z0) / (z1 - z0);
        return s0 + (s1 - s0) * t;
      }
    }

    return 1;
  }

  /** Aplica el factor de escala calculado al wrapper dedicado del pin de usuario. */
  private updateUserMarkerScale(zoom: number) {
    if (!this.userMarkerScaleEl) return;
    const scale = this.computeUserMarkerScale(zoom);
    this.userMarkerScaleEl.style.transform = `scale(${scale})`;
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
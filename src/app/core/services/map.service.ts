// src/app/core/services/map.service.ts
// Migrado de Mapbox GL JS → MapLibre GL JS (open-source fork, $0/mes)
// Tiles: CARTO Basemaps — gratis, sin clave, CDN global (voyager/positron/dark-matter)
import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import maplibregl from 'maplibre-gl';
import { GeoJSONFeatureCollection } from '../models/geo-provider.model';

export interface CustomMarker {
  marker: maplibregl.Marker;
  type: 'user' | 'provider';
  id?: number;
}

// Estilos CARTO Basemaps — 100% gratis, sin API key, CDN global confiable
// https://carto.com/basemaps/  |  Datos OSM, vector tiles, actualizados semanalmente
// Alternativa producción alta escala: MapTiler free (100k req/mes, clave gratis maptiler.com)
export const MAP_STYLES = {
  streets: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  light:   'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark:    'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
} as const;

export type MapStyleKey = keyof typeof MAP_STYLES;

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map: maplibregl.Map | null = null;
  private markers: CustomMarker[] = [];
  private currentStyle: string = MAP_STYLES.dark;

  // Cluster
  private readonly clusterSourceId = 'providers-cluster';
  private readonly clusterLayerIds = ['cluster-circles', 'cluster-count', 'unclustered-point'];
  private clusterClickHandlers: { layer: string; fn: (e: any) => void }[] = [];
  private hoverHandlers: Array<{ layer: string; event: string; fn: any }> = []; // ✅ Fix memory leak
  private readonly clusterPointClickSubject = new Subject<any>();
  clusterPointClick$ = this.clusterPointClickSubject.asObservable();
  private activePreviewPopup: maplibregl.Popup | null = null;

  // Observables
  private readonly mapLoadedSubject = new BehaviorSubject<boolean>(false);
  mapLoaded$ = this.mapLoadedSubject.asObservable();

  private readonly providerClickSubject = new Subject<number>();
  providerClick$ = this.providerClickSubject.asObservable();

  constructor() {}

  /**
   * Inicializa el mapa en el contenedor especificado.
   * MapLibre GL no requiere accessToken — sin costo de uso.
   */
  initializeMap(
    container: HTMLElement,
    center: [number, number],
    zoom: number = 14,
    style?: string
  ): maplibregl.Map {
    if (this.map) {
      this.destroy();
    }

    this.currentStyle = style || MAP_STYLES.dark;

    this.map = new maplibregl.Map({
      container,
      style: this.currentStyle,
      center,
      zoom,
      attributionControl: false
    });

    this.map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }),
      'bottom-right'
    );

    this.map.on('load', () => {
      console.log('✓ Mapa MapLibre cargado');
      this.mapLoadedSubject.next(true);
      // Primer resize: corrige dimensiones tras animación de entrada
      setTimeout(() => this.map?.resize(), 100);
      // Segundo resize a 600ms: en Android el WebView puede pintar el contenedor
      // con dimensiones 0 en el primer frame. El segundo resize fuerza el recálculo.
      setTimeout(() => this.map?.resize(), 600);
    });

    this.map.on('error', (e) => {
      console.error('Error en el mapa:', e.error);
    });

    this.map.on('style.load', () => {
      console.log('✓ Estilo MapLibre cargado');
      // Al cambiar de estilo, las imágenes se borran: re-cargar el pin de proveedor
      this.map!.loadImage(MapService.PROVIDER_PIN_URL)
        .then(({ data: image }) => {
          if (this.map && !this.map.hasImage('custom-marker')) {
            this.map.addImage('custom-marker', image);
          }
        })
        .catch(() => { /* no-op: el layer ya usa fallback de círculos */ });
    });

    return this.map;
  }

  /**
   * Agrega un marcador personalizado con elemento HTML.
   */
  addCustomMarker(
    lngLat: [number, number],
    element: HTMLElement,
    popupContent?: string,
    type: 'user' | 'provider' = 'provider',
    id?: number
  ): maplibregl.Marker {
    if (!this.map) {
      throw new Error('Mapa no inicializado');
    }

    const marker = new maplibregl.Marker({ element, anchor: 'center' })
      .setLngLat(lngLat);

    if (popupContent) {
      const popup = new maplibregl.Popup({
        offset: [0, -20],
        closeButton: true,
        closeOnClick: false,
        maxWidth: '280px'
      }).setHTML(popupContent);

      marker.setPopup(popup);
    }

    marker.addTo(this.map);
    this.markers.push({ marker, type, id });

    if (type === 'provider' && id !== undefined) {
      element.addEventListener('click', () => {
        this.providerClickSubject.next(id);
      });
    }

    return marker;
  }

  addMarker(lngLat: [number, number], element: HTMLElement): maplibregl.Marker {
    return this.addCustomMarker(lngLat, element, undefined, 'provider');
  }

  updateProvidersData(collection: GeoJSONFeatureCollection): void {
    if (!this.map) return;

    const sourceId = 'providers-source';
    const source = this.map.getSource(sourceId) as maplibregl.GeoJSONSource;

    if (source) {
      source.setData(collection as any);
    } else {
      this.map.addSource(sourceId, { type: 'geojson', data: collection as any });
    }
  }

  flyTo(center: [number, number], zoom?: number): void {
    if (!this.map) return;
    this.map.flyTo({ center, zoom: zoom || this.map.getZoom(), essential: true, duration: 1000 });
  }

  setCenter(center: [number, number]): void {
    if (!this.map) return;
    this.map.setCenter(center);
  }

  zoomIn(): void { this.map?.zoomIn({ duration: 300 }); }
  zoomOut(): void { this.map?.zoomOut({ duration: 300 }); }
  setZoom(zoom: number): void { this.map?.setZoom(zoom); }
  getZoom(): number { return this.map?.getZoom() || 14; }

  setStyle(styleUrl: string): void {
    if (!this.map) return;
    this.currentStyle = styleUrl;
    this.map.setStyle(styleUrl);
  }

  fitBounds(coordinates: [number, number][], options?: maplibregl.FitBoundsOptions): void {
    if (!this.map || coordinates.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    coordinates.forEach(coord => bounds.extend(coord));
    this.map.fitBounds(bounds, { padding: 50, maxZoom: 15, ...options });
  }

  clearMarkers(): void {
    this.markers.forEach(({ marker }) => marker.remove());
    this.markers = [];
  }

  clearProviderMarkers(): void {
    this.markers = this.markers.filter(({ marker, type }) => {
      if (type === 'provider') { marker.remove(); return false; }
      return true;
    });
  }

  clearUserMarker(): void {
    this.markers = this.markers.filter(({ marker, type }) => {
      if (type === 'user') { marker.remove(); return false; }
      return true;
    });
  }

  resize(): void { this.map?.resize(); }
  getMap(): maplibregl.Map | null { return this.map; }
  isInitialized(): boolean { return this.map !== null; }

  destroy(): void {
    this.clearMarkers();
    this.activePreviewPopup?.remove();
    this.activePreviewPopup = null;
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.mapLoadedSubject.next(false);
  }

  addSearchRadiusCircle(center: [number, number], radiusKm: number): void {
    if (!this.map) return;

    const sourceId = 'search-radius-source';
    const layerId = 'search-radius-layer';
    const circle = this.createCircleGeoJSON(center, radiusKm);

    if (this.map.getSource(sourceId)) {
      (this.map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(circle);
    } else {
      this.map.addSource(sourceId, { type: 'geojson', data: circle });
      this.map.addLayer({
        id: layerId, type: 'fill', source: sourceId,
        paint: { 'fill-color': '#4285f4', 'fill-opacity': 0.1 }
      });
      this.map.addLayer({
        id: `${layerId}-outline`, type: 'line', source: sourceId,
        paint: { 'line-color': '#4285f4', 'line-width': 2, 'line-opacity': 0.5 }
      });
    }
  }

  removeSearchRadiusCircle(): void {
    if (!this.map) return;
    const sourceId = 'search-radius-source';
    const layerId = 'search-radius-layer';
    if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
    if (this.map.getLayer(`${layerId}-outline`)) this.map.removeLayer(`${layerId}-outline`);
    if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);
  }

  // ── Cluster layer ──────────────────────────────────────────────────────

  // URL del pin de proveedor (SVG Cloudinary — mismo que web)
  private static readonly PROVIDER_PIN_URL =
    'https://res.cloudinary.com/dghwotofx/image/upload/v1774631660/proveedor_y6k7il.ico';

  addProviderCluster(collection: GeoJSONFeatureCollection): void {
    if (!this.map) return;
    this.clearProviderCluster();

    if (this.map.hasImage('custom-marker')) {
      this.addProviderClusterWithIcon(collection);
    } else {
      // MapLibre v4+: loadImage() retorna Promise
      this.map.loadImage(MapService.PROVIDER_PIN_URL)
        .then(({ data: image }) => {
          if (this.map) {
            this.map.addImage('custom-marker', image);
            this.addProviderClusterWithIcon(collection);
          }
        })
        .catch(() => {
          // fallback: intentar con asset local antes de círculos
          this.map!.loadImage('/assets/icon/ubicacion.ico')
            .then(({ data: img2 }) => {
              if (this.map) { this.map.addImage('custom-marker', img2); this.addProviderClusterWithIcon(collection); }
            })
            .catch(() => this.addProviderClusterFallback(collection));
        });
    }
  }

  private addProviderClusterWithIcon(collection: GeoJSONFeatureCollection): void {
    if (!this.map) return;

    this.map.addSource(this.clusterSourceId, {
      type: 'geojson',
      data: collection as any
    });

    this.map.addLayer({
      id: 'unclustered-point',
      type: 'symbol',
      source: this.clusterSourceId,
      layout: {
        'icon-image': 'custom-marker',
        // Escala el ícono según el zoom del mapa: más chico al alejar, más grande al acercar.
        // Cubre todo el rango de zoom (2-22) para que siga achicándose/agrandándose
        // en los extremos en vez de quedar fijo (clamp) fuera de 10-18.
        'icon-size': [
          'interpolate', ['linear'], ['zoom'],
          2, 0.05,
          6, 0.08,
          10, 0.12,
          14, 0.2,
          18, 0.32,
          22, 0.5
        ],
        'icon-allow-overlap': true
      },
      paint: {
        'icon-opacity': [
          'case',
          ['coalesce', ['get', 'isLocked'], false], 0.35,
          1
        ]
      }
    });

    this.setupClusterEventHandlers();
  }

  private addProviderClusterFallback(collection: GeoJSONFeatureCollection): void {
    if (!this.map) return;

    this.map.addSource(this.clusterSourceId, {
      type: 'geojson',
      data: collection as any
    });

    this.map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: this.clusterSourceId,
      paint: {
        'circle-color': [
          'case',
          ['>=', ['coalesce', ['get', 'rating_avg'], 0], 4], '#4CAF50',
          ['>=', ['coalesce', ['get', 'rating_avg'], 0], 3], '#2196F3',
          '#FF9800'
        ],
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          2, 3,
          6, 4,
          10, 8,
          14, 16,
          18, 26,
          22, 40
        ],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#fff'
      }
    });

    this.setupClusterEventHandlers();
  }

  private setupClusterEventHandlers(): void {
    if (!this.map) return;

    const pointClickFn = (e: any) => {
      if (!e.features?.length) return;
      const feature = e.features[0];
      const coordinates = (feature.geometry.coordinates as [number, number]).slice() as [number, number];
      this.showProviderPreviewPopup(coordinates, feature.properties);
    };

    const cursorOn  = () => { if (this.map) this.map.getCanvas().style.cursor = 'pointer'; };
    const cursorOff = () => { if (this.map) this.map.getCanvas().style.cursor = ''; };

    this.map.on('click', 'unclustered-point', pointClickFn);
    this.map.on('mouseenter', 'unclustered-point', cursorOn);
    this.map.on('mouseleave', 'unclustered-point', cursorOff);

    this.clusterClickHandlers = [
      { layer: 'unclustered-point', fn: pointClickFn }
    ];

    // ✅ Fix memory leak: Guardar referencias de hover handlers para limpieza
    this.hoverHandlers = [
      { layer: 'unclustered-point', event: 'mouseenter', fn: cursorOn },
      { layer: 'unclustered-point', event: 'mouseleave', fn: cursorOff }
    ];
  }

  /**
   * Resuelve la URL de avatar del proveedor para usar en HTML plano (fuera de Angular).
   * Misma lógica que ProviderImagePipe (shared/pipes/provider-image.pipe.ts).
   */
  private resolveAvatarUrl(value: string | null | undefined): string {
    const DEFAULT_AVATAR = 'assets/images/default-avatar.png';
    if (!value) return DEFAULT_AVATAR;
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) return value;
    return 'data:image/jpeg;base64,' + value;
  }

  /**
   * Popup informativo (no modal) con la información básica del proveedor y un
   * botón "Ver perfil". Equivalente al popup del marcador de proveedor en el
   * proyecto web (service-map.component.ts → createProviderPopup), implementado
   * con el Popup nativo de MapLibre en vez de un modal de Ionic.
   */
  private showProviderPreviewPopup(coordinates: [number, number], properties: any): void {
    if (!this.map) return;

    this.activePreviewPopup?.remove();

    const name = properties.business_name || properties.full_name || '';
    const avatarUrl = this.resolveAvatarUrl(properties.avatar);
    const rating = Number(properties.rating_avg) || 0;
    const reviewCount = properties.total_reviews || 0;
    const category = properties.service_name || '';
    const distanceNum = Number(properties.distance);
    const distance = distanceNum > 0 ? `${distanceNum.toFixed(1)} km` : 'No disponible';
    const rateNum = Number(properties.hourly_rate);
    const rate = rateNum > 0 ? `$${rateNum.toLocaleString('es-CL')}` : 'A consultar';

    const ratingHtml = rating > 0
      ? `<div class="popup-rating"><ion-icon name="star" class="icon-star"></ion-icon><span>${rating.toFixed(1)}</span>${reviewCount > 0 ? `<span class="text-muted">(${reviewCount})</span>` : ''}</div>`
      : `<span class="text-muted">Nuevo</span>`;

    const html = `
      <div class="provider-popup">
        <div class="popup-header">
          <img class="popup-avatar" src="${avatarUrl}" alt="${name}" onerror="this.src='assets/images/default-avatar.png'" />
          <div class="popup-header-info">
            <h3 class="provider-name">${name}</h3>
            ${ratingHtml}
          </div>
        </div>
        ${category ? `<p class="popup-row"><ion-icon name="pricetag-outline" class="icon-star"></ion-icon>${category}</p>` : ''}
        <p class="popup-row"><ion-icon name="location-outline" class="icon-location"></ion-icon>${distance}</p>
        <p class="popup-row"><ion-icon name="cash-outline" class="icon-money"></ion-icon>${rate} / hora</p>
        <div class="popup-action">
          <button type="button" class="btn-details" data-provider-popup-action="view-profile">Ver perfil</button>
        </div>
      </div>
    `;

    const popup = new maplibregl.Popup({
      offset: [0, -14],
      closeButton: true,
      closeOnClick: false,
      maxWidth: '260px'
    })
      .setLngLat(coordinates)
      .setHTML(html)
      .addTo(this.map);

    const popupEl = popup.getElement();
    const viewProfileBtn = popupEl?.querySelector('[data-provider-popup-action="view-profile"]');
    viewProfileBtn?.addEventListener('click', () => {
      popup.remove();
      this.clusterPointClickSubject.next(properties);
    });

    this.activePreviewPopup = popup;
  }

  clearProviderCluster(): void {
    if (!this.map) return;
    
    // Limpiar click listeners
    for (const { layer, fn } of this.clusterClickHandlers) {
      this.map.off('click', layer, fn);
    }
    this.clusterClickHandlers = [];

    // ✅ Fix memory leak: Limpiar hover listeners
    for (const { layer, event, fn } of this.hoverHandlers) {
      this.map.off(event as any, layer, fn);
    }
    this.hoverHandlers = [];
    
    for (const layerId of this.clusterLayerIds) {
      if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
    }
    if (this.map.getSource(this.clusterSourceId)) {
      this.map.removeSource(this.clusterSourceId);
    }
  }

  private createCircleGeoJSON(center: [number, number], radiusKm: number): any {
    const points = 64;
    const coords: [number, number][] = [];

    for (let i = 0; i < points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const dx = radiusKm * Math.cos(angle);
      const dy = radiusKm * Math.sin(angle);
      const lat = center[1] + (dy / 111);
      const lng = center[0] + (dx / (111 * Math.cos(center[1] * Math.PI / 180)));
      coords.push([lng, lat]);
    }
    coords.push(coords[0]);

    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
      properties: {}
    };
  }
}

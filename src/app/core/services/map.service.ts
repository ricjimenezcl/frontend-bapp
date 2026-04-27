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

  addProviderCluster(collection: GeoJSONFeatureCollection): void {
    if (!this.map) return;
    this.clearProviderCluster();

    if (this.map.hasImage('custom-marker')) {
      this.addProviderClusterWithIcon(collection);
    } else {
      // MapLibre v4+: loadImage() retorna Promise
      this.map.loadImage('/assets/icon/ubicacion.ico')
        .then(({ data: image }) => {
          if (this.map) {
            this.map.addImage('custom-marker', image);
            this.addProviderClusterWithIcon(collection);
          }
        })
        .catch(() => {
          this.addProviderClusterFallback(collection);
        });
    }
  }

  private addProviderClusterWithIcon(collection: GeoJSONFeatureCollection): void {
    if (!this.map) return;

    this.map.addSource(this.clusterSourceId, {
      type: 'geojson',
      data: collection as any,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    });

    this.map.addLayer({
      id: 'cluster-circles',
      type: 'circle',
      source: this.clusterSourceId,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': ['step', ['get', 'point_count'], '#FDE68A', 10, '#f28cb1', 30, '#f1f075'],
        'circle-radius': ['step', ['get', 'point_count'], 22, 10, 32, 30, 42],
        'circle-stroke-width': 2,
        'circle-stroke-color': 'rgba(0,0,0,0.3)'
      }
    });

    this.map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: this.clusterSourceId,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': 13,
        'text-allow-overlap': true
      },
      paint: { 'text-color': '#000' }
    });

    this.map.addLayer({
      id: 'unclustered-point',
      type: 'symbol',
      source: this.clusterSourceId,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': 'custom-marker',
        'icon-size': 0.5,
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
      data: collection as any,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    });

    this.map.addLayer({
      id: 'cluster-circles',
      type: 'circle',
      source: this.clusterSourceId,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': ['step', ['get', 'point_count'], '#FDE68A', 10, '#f28cb1', 30, '#f1f075'],
        'circle-radius': ['step', ['get', 'point_count'], 22, 10, 32, 30, 42],
        'circle-stroke-width': 2,
        'circle-stroke-color': 'rgba(0,0,0,0.3)'
      }
    });

    this.map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: this.clusterSourceId,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': 13,
        'text-allow-overlap': true
      },
      paint: { 'text-color': '#000' }
    });

    this.map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: this.clusterSourceId,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'case',
          ['>=', ['coalesce', ['get', 'rating_avg'], 0], 4], '#4CAF50',
          ['>=', ['coalesce', ['get', 'rating_avg'], 0], 3], '#2196F3',
          '#FF9800'
        ],
        'circle-radius': 10,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });

    this.setupClusterEventHandlers();
  }

  private setupClusterEventHandlers(): void {
    if (!this.map) return;

    const clusterClickFn = (e: any) => {
      const features = this.map!.queryRenderedFeatures(e.point, { layers: ['cluster-circles'] });
      if (!features.length) return;
      const clusterId = (features[0].properties as any).cluster_id;
      // MapLibre v4+: getClusterExpansionZoom() retorna Promise
      (this.map!.getSource(this.clusterSourceId) as maplibregl.GeoJSONSource)
        .getClusterExpansionZoom(clusterId)
        .then((zoom: number) => {
          this.map!.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
        });
    };

    const pointClickFn = (e: any) => {
      if (!e.features?.length) return;
      this.clusterPointClickSubject.next(e.features[0].properties);
    };

    const cursorOn  = () => { if (this.map) this.map.getCanvas().style.cursor = 'pointer'; };
    const cursorOff = () => { if (this.map) this.map.getCanvas().style.cursor = ''; };

    this.map.on('click', 'cluster-circles', clusterClickFn);
    this.map.on('click', 'unclustered-point', pointClickFn);
    this.map.on('mouseenter', 'cluster-circles', cursorOn);
    this.map.on('mouseleave', 'cluster-circles', cursorOff);
    this.map.on('mouseenter', 'unclustered-point', cursorOn);
    this.map.on('mouseleave', 'unclustered-point', cursorOff);

    this.clusterClickHandlers = [
      { layer: 'cluster-circles', fn: clusterClickFn },
      { layer: 'unclustered-point', fn: pointClickFn }
    ];

    // ✅ Fix memory leak: Guardar referencias de hover handlers para limpieza
    this.hoverHandlers = [
      { layer: 'cluster-circles', event: 'mouseenter', fn: cursorOn },
      { layer: 'cluster-circles', event: 'mouseleave', fn: cursorOff },
      { layer: 'unclustered-point', event: 'mouseenter', fn: cursorOn },
      { layer: 'unclustered-point', event: 'mouseleave', fn: cursorOff }
    ];
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

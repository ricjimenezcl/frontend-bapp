// src/app/shared/components/map-picker/map-picker.component.ts
import { Component, signal, OnDestroy, OnInit, inject, ElementRef, ViewChild, AfterViewInit, Output, EventEmitter, Input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { MapboxService } from '../../services/mapbox.service';
import { GeoLocationService } from '../../services/geo-location.service';

@Component({
  selector: 'app-map-picker',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './map-picker.component.html',
  styleUrls: ['./map-picker.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MapPickerComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  
  @Output() locationSelected = new EventEmitter<{ lat: number; lng: number; address: string }>();
  @Output() closed = new EventEmitter<void>();
  
  @Input() initialLat = -33.4489;  // Santiago Centro por defecto
  @Input() initialLng = -70.6693;

  private readonly mapboxSvc = inject(MapboxService);
  private readonly geoLocationSvc = inject(GeoLocationService);

  selectedAddress = signal('Cargando dirección...');
  loading = signal(true);
  locationError = signal('');
  
  private map: any = null;
  private L: any = null;
  private currentLat = -33.4489;
  private currentLng = -70.6693;
  
  // ✅ Debounce para reverse geocoding (previene rate limit Nominatim)
  private readonly dragDebouncer$ = new Subject<{lat: number, lng: number}>();
  private readonly destroy$ = new Subject<void>();
  
  ngOnInit() {
    // ✅ Setup debounced reverse geocoding
    this.dragDebouncer$.pipe(
      debounceTime(500), // Esperar 500ms después de drag/click
      distinctUntilChanged((a, b) => 
        // Solo procesar si coordenadas cambiaron >10m (~0.0001°)
        Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lng - b.lng) < 0.0001
      ),
      takeUntil(this.destroy$)
    ).subscribe(({lat, lng}) => {
      console.log('[Debounced] Reverse geocoding:', lat, lng);
      this.updateAddressFromCoords(lat, lng);
    });
  }
  
  ngAfterViewInit() {
    // 300ms en Android es suficiente para que el overlay termine la animación
    // y el contenedor tenga dimensiones reales antes de que Leaflet las lea.
    setTimeout(() => {
      this.initMap();
    }, 300);
  }

  ngOnDestroy() {
    // ✅ Cleanup de observables
    this.destroy$.next();
    this.destroy$.complete();
    this.dragDebouncer$.complete();
    
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private async initMap(): Promise<void> {
    try {
      const L = await import('leaflet');
      this.L = L.default || L;
      
      // Usar coordenadas iniciales
      this.currentLat = this.initialLat;
      this.currentLng = this.initialLng;
      
      // Crear mapa
      this.map = this.L.map(this.mapContainer.nativeElement, {
        center: [this.currentLat, this.currentLng],
        zoom: 14,
        zoomControl: true
      });
      
      // Añadir tiles OpenStreetMap
      this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);
      
      // ✅ Evento moveend: detectar cuando el usuario termina de arrastrar el mapa
      this.map.on('moveend', () => {
        const center = this.map.getCenter();
        this.currentLat = center.lat;
        this.currentLng = center.lng;
        // Emitir al debouncer para reverse geocoding
        this.dragDebouncer$.next({ lat: center.lat, lng: center.lng });
      });
      
      this.loading.set(false);

      // Primer invalidateSize: recalcula dimensiones tras animación de entrada.
      // Segundo invalidateSize + setView a los 600ms: fuerza la recarga de tiles
      // en Android donde el WebView puede pintar los tiles en blanco en el primer
      // paint si el contenedor aún no tenía dimensiones reales.
      setTimeout(() => {
        this.map?.invalidateSize({ animate: false });
      }, 150);
      setTimeout(() => {
        this.map?.invalidateSize({ animate: false });
        this.map?.setView([this.currentLat, this.currentLng], this.map.getZoom(), { animate: false });
      }, 600);

      // ✅ Obtener dirección inicial (sin debounce, es la primera vez)
      this.updateAddressFromCoords(this.currentLat, this.currentLng);
      
    } catch (error) {
      console.error('Error inicializando mapa:', error);
      this.locationError.set('No se pudo cargar el mapa');
      this.loading.set(false);
    }
  }

  private updateAddressFromCoords(lat: number, lng: number): void {
    this.selectedAddress.set('Obteniendo dirección...');
    
    this.mapboxSvc.reverseGeocode(lng, lat).subscribe({
      next: (result) => {
        if (result?.display_name) {
          // Extraer nombre más legible del display_name de Nominatim
          const parts = result.display_name.split(',');
          const address = parts.slice(0, 3).join(', ') || result.display_name;
          this.selectedAddress.set(address);
        } else {
          this.selectedAddress.set(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
      },
      error: (err) => {
        console.error('Error reverse geocode:', err);
        this.selectedAddress.set(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }
    });
  }

  async useCurrentLocation(): Promise<void> {
    this.loading.set(true);
    
    try {
      const position = await this.geoLocationSvc.getCurrentLocation();
      const lat = position.latitude;
      const lng = position.longitude;
      
      // ✅ Solo centar el mapa (el pin está fijo en el centro)
      this.map?.setView([lat, lng], 15);
      this.currentLat = lat;
      this.currentLng = lng;
      this.updateAddressFromCoords(lat, lng);
    } catch (error) {
      console.error('Error obteniendo ubicación:', error);
      this.locationError.set('No se pudo obtener tu ubicación. Selecciona una ubicación en el mapa.');
      // Usar ubicación por defecto (Santiago Centro) para no bloquear el mapa
      const defaultLat = -33.4489;
      const defaultLng = -70.6693;
      this.map?.setView([defaultLat, defaultLng], 13);
      this.currentLat = defaultLat;
      this.currentLng = defaultLng;
      this.updateAddressFromCoords(defaultLat, defaultLng);
    } finally {
      this.loading.set(false);
    }
  }

  confirmLocation(): void {
    console.log('📍 Confirmando ubicación:', this.currentLat, this.currentLng, this.selectedAddress());
    this.locationSelected.emit({
      lat: this.currentLat,
      lng: this.currentLng,
      address: this.selectedAddress()
    });
  }

  cancelSelection(): void {
    console.log('❌ Cancelando selección de ubicación');
    this.closed.emit();
  }
}

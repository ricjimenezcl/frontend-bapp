// src/app/shared/components/map-picker/map-picker.component.ts
import { Component, signal, OnDestroy, inject, ElementRef, ViewChild, AfterViewInit, Output, EventEmitter, Input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { MapboxService, GeocodingFeature } from '../../services/mapbox.service';
import { GeoLocationService } from '../../services/geo-location.service';

@Component({
  selector: 'app-map-picker',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './map-picker.component.html',
  styleUrls: ['./map-picker.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MapPickerComponent implements OnDestroy, AfterViewInit {
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
  private marker: any = null;
  private L: any = null;
  private currentLat = -33.4489;
  private currentLng = -70.6693;
  
  ngAfterViewInit() {
    // 300ms en Android es suficiente para que el overlay termine la animación
    // y el contenedor tenga dimensiones reales antes de que Leaflet las lea.
    setTimeout(() => {
      this.initMap();
    }, 300);
  }

  ngOnDestroy() {
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
      
      // Crear icono personalizado PNG
      const customIcon = this.L.icon({
        iconUrl: 'https://res.cloudinary.com/dghwotofx/image/upload/f_png,w_64,h_64/v1774631660/ubicacion_nbo2mo',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
      });
      
      // Crear marcador arrastrable
      this.marker = this.L.marker([this.currentLat, this.currentLng], {
        icon: customIcon,
        draggable: true
      }).addTo(this.map);
      
      // Evento dragend del marcador
      this.marker.on('dragend', () => {
        const pos = this.marker.getLatLng();
        this.updateLocation(pos.lat, pos.lng);
      });
      
      // Evento click en el mapa
      this.map.on('click', (e: any) => {
        this.marker.setLatLng(e.latlng);
        this.updateLocation(e.latlng.lat, e.latlng.lng);
      });
      
      this.loading.set(false);

      // invalidateSize() fuerza a Leaflet a recalcular las dimensiones del
      // contenedor. Necesario en Android cuando el mapa se inicializa dentro
      // de un overlay con animación (el tamaño real llega después del paint).
      setTimeout(() => {
        this.map?.invalidateSize({ animate: false });
      }, 150);

      // Obtener dirección inicial
      this.updateAddressFromCoords(this.currentLat, this.currentLng);
      
    } catch (error) {
      console.error('Error inicializando mapa:', error);
      this.locationError.set('No se pudo cargar el mapa');
      this.loading.set(false);
    }
  }

  private updateLocation(lat: number, lng: number): void {
    this.currentLat = lat;
    this.currentLng = lng;
    this.updateAddressFromCoords(lat, lng);
  }

  private updateAddressFromCoords(lat: number, lng: number): void {
    this.selectedAddress.set('Obteniendo dirección...');
    
    this.mapboxSvc.reverseGeocode(lng, lat).subscribe({
      next: (result) => {
        if (result && result.display_name) {
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
      
      this.marker?.setLatLng([lat, lng]);
      this.map?.setView([lat, lng], 15);
      this.updateLocation(lat, lng);
      this.loading.set(false);
    } catch (error) {
      console.error('Error obteniendo ubicación:', error);
      this.locationError.set('No se pudo obtener tu ubicación');
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

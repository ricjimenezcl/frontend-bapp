import { Injectable, inject, signal } from '@angular/core';
import { GeoapifyService, AddressSuggestion } from './geoapify.service';
import { GpsValidationService } from './gps-validation.service';
import { Observable, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

/**
 * Ubicación del usuario
 */
export interface UserLocation {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number;
  timestamp?: number;
}

/**
 * Location Service - Sincronizado con proyecto WEB
 * Gestiona la ubicación del usuario y búsqueda de direcciones
 */
@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly geoapifyService = inject(GeoapifyService);
  private readonly gpsValidationService = inject(GpsValidationService);
  
  // Estado global de ubicación del usuario
  userLocation = signal<UserLocation | null>(null);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  private readonly STORAGE_KEY = 'user_location';

  constructor() {
    this.loadSavedLocation();
  }

  /**
   * Buscar direcciones (debounced en componente)
   * @param query Texto de búsqueda
   * @param country Código de país (default: 'cl')
   * @returns Observable con resultados de direcciones
   */
  searchAddresses(query: string, country = 'cl'): Observable<AddressSuggestion[]> {
    return this.geoapifyService.searchAddress(query, country);
  }

  /**
   * Buscar direcciones con límite de resultados
   * @param query Texto de búsqueda
   * @param limit Número máximo de resultados
   * @param country Código de país
   * @returns Observable con resultados de direcciones
   */
  searchAddressesWithLimit(
    query: string, 
    limit: number = 5, 
    country = 'cl'
  ): Observable<AddressSuggestion[]> {
    return this.geoapifyService.searchAddressWithLimit(query, limit, country);
  }

  /**
   * Obtener dirección desde coordenadas (reverse geocoding)
   * @param lat Latitud
   * @param lon Longitud
   * @returns Observable con resultado de dirección o null
   */
  getAddressFromCoordinates(lat: number, lon: number): Observable<AddressSuggestion | null> {
    return this.geoapifyService.reverseGeocode(lat, lon);
  }

  /**
   * Valida permisos y estado del GPS antes de intentar obtener la ubicación
   * @param validateGPS Si es true, valida GPS antes de obtener ubicación
   * @returns Observable con la ubicación actual
   */
  getCurrentPosition(validateGPS = true): Observable<UserLocation> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Si se requiere validación, verificar GPS primero
    const validationPromise = validateGPS 
      ? this.gpsValidationService.validateAndRequestGPS()
      : Promise.resolve(true);

    return from(validationPromise).pipe(
      switchMap(isGPSReady => {
        if (!isGPSReady) {
          throw new Error('GPS no disponible o permisos denegados');
        }

        return from(
          new Promise<GeolocationPosition>((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error('Geolocation no soportada en este dispositivo'));
              return;
            }

            navigator.geolocation.getCurrentPosition(
              position => resolve(position),
              (error: GeolocationPositionError) => {
                const errorMsg = error.message || `Error de geolocalización (código ${error.code})`;
                reject(new Error(errorMsg));
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
              }
            );
          })
        );
      }),
    ).pipe(
      map(position => {
        const location: UserLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };
        
        this.isLoading.set(false);
        this.setUserLocation(location);
        return location;
      }),
      catchError(error => {
        this.isLoading.set(false);
        const errorMsg = this.getGeolocationErrorMessage(error);
        this.errorMessage.set(errorMsg);
        throw new Error(errorMsg);
      })
    );
  }

  /**
   * Obtener ubicación actual y su dirección formateada
   * @returns Observable con ubicación y dirección
   */
  getCurrentPositionWithAddress(): Observable<UserLocation> {
    return this.getCurrentPosition().pipe(
      map(location => {
        // Obtener dirección en paralelo
        this.getAddressFromCoordinates(location.latitude, location.longitude)
          .subscribe(result => {
            if (result) {
              const locationWithAddress: UserLocation = {
                ...location,
                address: result.formatted
              };
              this.setUserLocation(locationWithAddress);
            }
          });
        
        return location;
      })
    );
  }

  /**
   * Guardar ubicación del usuario en estado y localStorage
   * @param location Ubicación a guardar
   */
  setUserLocation(location: UserLocation): void {
    this.userLocation.set(location);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(location));
  }

  /**
   * Cargar ubicación guardada desde localStorage
   */
  loadSavedLocation(): void {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const location = JSON.parse(saved) as UserLocation;
        this.userLocation.set(location);
      } catch (error) {
        console.error('[LocationService] Error loading saved location:', error);
        localStorage.removeItem(this.STORAGE_KEY);
      }
    }
  }

  /**
   * Limpiar ubicación del usuario
   */
  clearLocation(): void {
    this.userLocation.set(null);
    this.errorMessage.set(null);
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Verificar si hay una ubicación guardada
   * @returns true si existe ubicación guardada
   */
  hasLocation(): boolean {
    return this.userLocation() !== null;
  }

  /**
   * Obtener mensaje de error de geolocalización
   * @param error Error de Geolocation API
   * @returns Mensaje de error formateado
   */
  private getGeolocationErrorMessage(error: any): string {
    switch (error.code) {
      case 1: // PERMISSION_DENIED
        return 'Permiso de ubicación denegado. Por favor, habilita los permisos de ubicación.';
      case 2: // POSITION_UNAVAILABLE
        return 'Ubicación no disponible. Verifica tu conexión y GPS.';
      case 3: // TIMEOUT
        return 'Tiempo de espera agotado. Intenta nuevamente.';
      default:
        return error.message || 'Error al obtener ubicación';
    }
  }

  /**
   * Calcular distancia entre dos puntos (Haversine formula)
   * @param lat1 Latitud punto 1
   * @param lon1 Longitud punto 1
   * @param lat2 Latitud punto 2
   * @param lon2 Longitud punto 2
   * @returns Distancia en kilómetros
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convertir grados a radianes
   * @param degrees Grados
   * @returns Radianes
   */
  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

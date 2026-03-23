import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { StateService, UserLocation } from './state.service';
import { APP_CONSTANTS } from '../constants/app.constants';

export interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class GeoLocationService {
  private locationSubject = new BehaviorSubject<GeolocationPosition | null>(null);
  location$ = this.locationSubject.asObservable();

  private watchId: string | null = null;

  constructor(private stateService: StateService) {}

  /**
   * Obtiene la ubicación actual del usuario
   */
  async getCurrentLocation(): Promise<GeolocationPosition> {
    try {
      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });

      const position: GeolocationPosition = {
        latitude: coordinates.coords.latitude,
        longitude: coordinates.coords.longitude,
        accuracy: coordinates.coords.accuracy,
        timestamp: Date.now()
      };

      this.locationSubject.next(position);
      this.updateStateLocation(position);

      return position;
    } catch (error) {
      console.error('Error obteniendo ubicación:', error);
      throw error;
    }
  }

  /**
   * Inicia el monitoreo continuo de ubicación
   */
  async watchLocation(): Promise<string> {
    try {
      this.watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 1000
        },
        (position, err) => {
          if (err) {
            console.error('Error en watchPosition:', err);
            return;
          }

          if (position) {
            const geoPosition: GeolocationPosition = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: Date.now()
            };

            this.locationSubject.next(geoPosition);
            this.updateStateLocation(geoPosition);
          }
        }
      );

      return this.watchId;
    } catch (error) {
      console.error('Error iniciando watchPosition:', error);
      throw error;
    }
  }

  /**
   * Detiene el monitoreo de ubicación
   */
  async stopWatchingLocation(): Promise<void> {
    if (this.watchId) {
      await Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
    }
  }

  /**
   * Calcula la distancia entre dos puntos en km
   */
  calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Obtiene ubicaciones cercanas dentro de un radio
   */
  getNearbyLocations(
    center: GeolocationPosition,
    radius: number,
    locations: GeolocationPosition[]
  ): GeolocationPosition[] {
    return locations.filter(loc => {
      const distance = this.calculateDistance(
        center.latitude,
        center.longitude,
        loc.latitude,
        loc.longitude
      );
      return distance <= radius;
    });
  }

  /**
   * Obtiene las coordenadas con offset (para mapas)
   */
  getOffsetCoordinates(
    latitude: number,
    longitude: number
  ): { latitude: number; longitude: number } {
    return {
      latitude: latitude + APP_CONSTANTS.COORDINATES.OFFSET_LATITUDE,
      longitude: longitude + APP_CONSTANTS.COORDINATES.OFFSET_LONGITUDE
    };
  }

  private updateStateLocation(position: GeolocationPosition): void {
    const userLocation: UserLocation = {
      latitude: position.latitude,
      longitude: position.longitude,
      timestamp: position.timestamp
    };
    this.stateService.setUserLocation(userLocation);
  }
}

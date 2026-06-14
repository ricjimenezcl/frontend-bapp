import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// Formato que devuelve GET /api/v1/providers/geocoding/search (Nominatim/Mapbox)
interface NominatimResponse {
  source: 'api' | 'cache';
  results: NominatimResult[];
}

interface NominatimResult {
  place_name: string;       // "Av. Providencia 1234, Providencia, Santiago"
  text: string;             // "Av. Providencia"
  address: string;          // "1234"
  center: [number, number]; // [lon, lat]
  relevance: number;
  place_type: string[];
}

// Formato que devuelve GET /api/v1/geocoding/reverse (Geoapify directo)
interface ReverseResponse {
  features?: { properties?: { formatted?: string } }[];
}

export interface AddressSuggestion {
  id: string;
  formatted: string;
  displayText: string;
  context: string;
  lat: number;
  lon: number;
  icon: string;
}

/** Alias para retrocompatibilidad con código existente de la app */
export type GeoapifyResult = AddressSuggestion;

@Injectable({ providedIn: 'root' })
export class GeoapifyService {
  private readonly http = inject(HttpClient);

  // Cache local (el backend ya tiene caché Redis 7 días, pero evitamos peticiones redundantes)
  private readonly autocompleteCache = new Map<string, {
    data: AddressSuggestion[];
    timestamp: number;
  }>();

  private readonly reverseCache = new Map<string, {
    data: string;
    timestamp: number;
  }>();

  private readonly AUTOCOMPLETE_CACHE_TTL = 5 * 60 * 1000;  // 5 min
  private readonly REVERSE_CACHE_TTL      = 10 * 60 * 1000; // 10 min
  private readonly MAX_CACHE_SIZE         = 100;

  /**
   * Autocompletado de direcciones limitado a Chile.
   * Usa GET /api/v1/providers/geocoding/search (Nominatim + caché Redis 7 días).
   */
  autocompleteAddress(query: string, country = 'cl'): Observable<AddressSuggestion[]> {
    if (!query || query.length < 3) return of([]);

    const cacheKey = query.toLowerCase().trim();
    const cached = this.autocompleteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.AUTOCOMPLETE_CACHE_TTL) {
      return of(cached.data);
    }

    const url = `${environment.apiUrl}/providers/geocoding/search`;
    return this.http.get<NominatimResponse>(url, {
      params: { q: query, country }
    }).pipe(
      map(response => {
        const results = this.transformNominatimResults(response.results || []);
        this.autocompleteCache.set(cacheKey, { data: results, timestamp: Date.now() });
        if (this.autocompleteCache.size > this.MAX_CACHE_SIZE) {
          this.autocompleteCache.delete(this.autocompleteCache.keys().next().value!);
        }
        return results;
      }),
      catchError(() => of([]))
    );
  }

  /** @deprecated Usar autocompleteAddress() */
  searchAddress(query: string, country = 'cl'): Observable<AddressSuggestion[]> {
    return this.autocompleteAddress(query, country);
  }

  /** @deprecated Usar autocompleteAddress() con limit */
  searchAddressWithLimit(query: string, limit = 5, country = 'cl'): Observable<AddressSuggestion[]> {
    return this.autocompleteAddress(query, country).pipe(
      map(results => results.slice(0, limit))
    );
  }

  /**
   * Geocodificación inversa: coordenadas → dirección formateada.
   * Devuelve un AddressSuggestion con .formatted para compatibilidad con LocationService.
   */
  reverseGeocode(lat: number, lon: number): Observable<AddressSuggestion | null> {
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = this.reverseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.REVERSE_CACHE_TTL) {
      return of(this.addressStringToSuggestion(cached.data, lat, lon));
    }

    const url = `${environment.apiUrl}/geocoding/reverse`;
    return this.http.get<ReverseResponse>(url, {
      params: { lat: lat.toString(), lon: lon.toString() }
    }).pipe(
      map(response => {
        const address = response.features?.[0]?.properties?.formatted ?? 'Ubicación desconocida';
        this.reverseCache.set(cacheKey, { data: address, timestamp: Date.now() });
        if (this.reverseCache.size > this.MAX_CACHE_SIZE) {
          this.reverseCache.delete(this.reverseCache.keys().next().value!);
        }
        return this.addressStringToSuggestion(address, lat, lon);
      }),
      catchError(() => of(null))
    );
  }

  private addressStringToSuggestion(address: string, lat: number, lon: number): AddressSuggestion {
    return { id: `rev_${lat}_${lon}`, formatted: address, displayText: address, context: '', lat, lon, icon: 'location-outline' };
  }

  private transformNominatimResults(results: NominatimResult[]): AddressSuggestion[] {
    return results.map((r, idx) => {
      const lon = r.center[0];
      const lat = r.center[1];
      const displayText = r.address ? `${r.text} ${r.address}`.trim() : r.text || r.place_name;
      const firstComma = r.place_name.indexOf(',');
      const context = firstComma !== -1 ? r.place_name.slice(firstComma + 1).trim() : '';
      return {
        id:          String(idx),
        formatted:   r.place_name,
        displayText,
        context,
        lat,
        lon,
        icon:        this.getIconForPlaceType(r.place_type),
      };
    });
  }

  private getIconForPlaceType(placeType: string[]): string {
    const type = (placeType?.[0] ?? '').toLowerCase();
    if (type === 'house' || type === 'address') return 'home-outline';
    if (type === 'park'  || type === 'leisure') return 'leaf-outline';
    if (type === 'city'  || type === 'town')    return 'business-outline';
    return 'location-outline';
  }
}

// src/app/shared/services/mapbox.service.ts
// Geocoding migrado: Mapbox API → Photon (OSM, gratis) + Geoapify Static Maps
// Nombre mantenido para no romper imports existentes en 8+ componentes.
// Photon by Komoot: https://photon.komoot.io — sin clave, sin rate limit comercial
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// Bounding box de Chile continental + isla de Pascua
const PHOTON_BASE = 'https://photon.komoot.io/api';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

export interface GeocodingFeature {
  place_name: string;      // Dirección completa para mostrar al usuario
  center:     [number, number]; // [lng, lat]
  text:       string;      // Nombre corto del lugar
}

@Injectable({ providedIn: 'root' })
export class MapboxService {

  // ✅ Sistema de caching para reducir requests y mejorar performance
  private readonly autocompleteCache = new Map<string, {
    data: GeocodingFeature[], 
    timestamp: number
  }>();
  
  private readonly reverseGeocodeCache = new Map<string, {
    data: any,
    timestamp: number
  }>();
  
  private readonly AUTOCOMPLETE_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
  private readonly REVERSE_CACHE_TTL = 10 * 60 * 1000;     // 10 minutos
  private readonly MAX_CACHE_SIZE = 100;

  constructor(private readonly http: HttpClient) {}

  // ── Autocompletado de direcciones (Chile) ──────────────────────────────
  // Photon: sin API key, sin costo, OSM-based, ~50ms desde Chile
  autocompleteChile(query: string): Observable<GeocodingFeature[]> {
    if (!query || query.length < 2) return of([]);

    // ✅ Cache: Normalizar query y verificar cache
    const cacheKey = query.toLowerCase().trim();
    const cached = this.autocompleteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.AUTOCOMPLETE_CACHE_TTL) {
      console.log('[Cache HIT] Autocomplete:', cacheKey);
      return of(cached.data);
    }

    console.log('[Cache MISS] Autocomplete:', cacheKey);
    const url = `${PHOTON_BASE}/?q=${encodeURIComponent(query)}&lat=-33.45&lon=-70.65&lang=es&limit=8`;

    return this.http.get<any>(url).pipe(
      map(response => {
        const features = this.normalizePhotonFeatures(response?.features || []);
        
        // ✅ Guardar en cache
        this.autocompleteCache.set(cacheKey, {
          data: features,
          timestamp: Date.now()
        });
        
        // ✅ Cleanup: LRU simple - eliminar entrada más antigua si excede límite
        if (this.autocompleteCache.size > this.MAX_CACHE_SIZE) {
          const firstKey = this.autocompleteCache.keys().next().value;
          this.autocompleteCache.delete(firstKey);
        }
        
        return features;
      }),
      shareReplay(1), // ✅ Compartir para requests simultáneos idénticos
      catchError(err => {
        console.error('Error geocoding Photon:', err);
        return of([]);
      })
    );
  }

  // Alias para compatibilidad
  autocomplete(query: string, _countryCode: string = 'cl'): Observable<GeocodingFeature[]> {
    return this.autocompleteChile(query);
  }

  // ── Reverse geocoding ─────────────────────────────────────────────────
  // Nominatim OSM: sin clave, gratis
  // Política de uso: 1 req/s — en producción cachear en backend/Redis si es necesario
  reverseGeocode(lng: number, lat: number): Observable<any> {
    // ✅ Cache: Usar precisión de 4 decimales (~11m) como key
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = this.reverseGeocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.REVERSE_CACHE_TTL) {
      console.log('[Cache HIT] Reverse:', cacheKey);
      return of(cached.data);
    }

    console.log('[Cache MISS] Reverse:', cacheKey);
    const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`;

    return this.http.get<any>(url, {
      headers: { 'Accept': 'application/json' }
    }).pipe(
      map(result => {
        // ✅ Guardar en cache
        this.reverseGeocodeCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
        
        // ✅ Cleanup
        if (this.reverseGeocodeCache.size > this.MAX_CACHE_SIZE) {
          const firstKey = this.reverseGeocodeCache.keys().next().value;
          this.reverseGeocodeCache.delete(firstKey);
        }
        
        return result;
      }),
      shareReplay(1),
      catchError(err => {
        console.error('Error reverse geocoding:', err);
        return of(null);
      })
    );
  }

  // ── Mapa estático (para provider-add-service y provider-edit-service) ─
  // ✅ Proxy seguro: Backend protege API key de Geoapify
  // Free tier 3k req/día, cache 24h en backend
  getStaticMapUrl(
    lat: number,
    lng: number,
    zoom: number = 14,
    width: number = 400,
    height: number = 200
  ): string {
    // ✅ Usar endpoint proxy del backend (API key protegida)
    return `${environment.apiUrl}/geocoding/static-map` +
      `?lat=${lat}` +
      `&lng=${lng}` +
      `&zoom=${zoom}` +
      `&width=${width}` +
      `&height=${height}` +
      `&style=osm-bright` +
      `&marker=true`;
  }

  // ── Distancia Haversine (sin API, pura matemática) ────────────────────
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // ── Normalizar respuesta Photon → formato compatible con código existente ──
  private normalizePhotonFeatures(features: any[]): GeocodingFeature[] {
    return features.map(f => {
      const p = f.properties || {};
      const [lng, lat] = f.geometry?.coordinates || [0, 0];

      const parts: string[] = [];
      if (p.housenumber && p.street) {
        parts.push(`${p.street} ${p.housenumber}`);
      } else if (p.street) {
        parts.push(p.street);
      } else if (p.name) {
        parts.push(p.name);
      }
      if (p.district && p.district !== p.city) parts.push(p.district);
      if (p.city)     parts.push(p.city);
      if (p.state && p.state !== p.city) parts.push(p.state);
      if (p.country)  parts.push(p.country);

      const place_name = parts.filter(Boolean).join(', ') || 'Dirección sin nombre';
      const text = p.name || p.street || p.city || place_name;

      return { place_name, center: [lng, lat] as [number, number], text };
    });
  }

  // ── Obtener detalle de lugar por ID (Photon no tiene endpoint por ID) ─
  // Retorna vacío — los consumers deben usar la feature completa del autocomplete
  getPlaceDetails(_placeId: string): Observable<any> {
    return of(null);
  }

  // ✅ Métodos de gestión de cache
  clearCache(): void {
    this.autocompleteCache.clear();
    this.reverseGeocodeCache.clear();
    console.log('[Cache] Cleared all geocoding caches');
  }

  getCacheStats(): { autocomplete: number, reverse: number } {
    return {
      autocomplete: this.autocompleteCache.size,
      reverse: this.reverseGeocodeCache.size
    };
  }
}

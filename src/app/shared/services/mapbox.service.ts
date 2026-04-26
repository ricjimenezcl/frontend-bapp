// src/app/shared/services/mapbox.service.ts
// Geocoding migrado: Mapbox API → Photon (OSM, gratis) + Geoapify Static Maps
// Nombre mantenido para no romper imports existentes en 8+ componentes.
// Photon by Komoot: https://photon.komoot.io — sin clave, sin rate limit comercial
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// Bounding box de Chile continental + isla de Pascua
const PHOTON_BASE = 'https://photon.komoot.io/api';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

export interface GeocodingFeature {
  place_name:  string;           // Dirección completa para mostrar al usuario
  center:      [number, number]; // [lng, lat]
  text:        string;           // Nombre corto del lugar
  place_type?: string[];         // Tipos de lugar: ['address','place','poi','region','locality']
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
  
  private readonly AUTOCOMPLETE_CACHE_TTL = 15 * 60 * 1000; // 15 minutos
  private readonly REVERSE_CACHE_TTL = 10 * 60 * 1000;     // 10 minutos
  private readonly MAX_CACHE_SIZE = 100;

  constructor(private readonly http: HttpClient) {}

  // ── Autocompletado de direcciones (Chile) ──────────────────────────────
  // Cadena de fallback: 1º backend proxy (Geoapify) → 2º Nominatim OSM
  // El backend protege la API key y evita restricciones de CORS/rate-limit en cliente
  autocompleteChile(query: string): Observable<GeocodingFeature[]> {
    const sanitized = query?.trim();
    if (!sanitized || sanitized.length < 3) return of([]);

    const cacheKey = sanitized.toLowerCase();
    const cached = this.autocompleteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.AUTOCOMPLETE_CACHE_TTL) {
      return of(cached.data);
    }

    // 1º intento: backend proxy — sin restricciones CORS ni rate-limit en cliente
    const backendUrl = `${environment.apiUrl}/providers/geocoding/search?q=${encodeURIComponent(sanitized)}&country=cl`;
    // 2º fallback: Nominatim directo (ya excluido del headersInterceptor)
    const nominatimUrl = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(sanitized)}&countrycodes=cl&format=json&limit=8&addressdetails=1`;

    return this.http.get<any[]>(backendUrl).pipe(
      catchError(err => {
        // 429: rate limit del backend — no escalar a Nominatim para evitar cascada
        if (err?.status === 429) {
          console.warn('[Geocoding] Rate limit (429) — omitiendo fallback para no saturar');
          return of([]);
        }
        console.warn('[Geocoding] Backend proxy falló, usando Nominatim...');
        return this.http.get<any[]>(nominatimUrl).pipe(
          catchError(nominatimErr => {
            if (nominatimErr?.status === 429) {
              console.warn('[Geocoding] Nominatim también con rate limit (429)');
            } else {
              console.error('[Geocoding] Nominatim también falló:', nominatimErr);
            }
            return of([]);
          })
        );
      }),
      map((results: any[]) => {
        const features = this.normalizeSearchResults(Array.isArray(results) ? results : []);
        // Solo cachear si hay resultados reales (no cachear vacíos por 429)
        if (features.length > 0) {
          this.setAutocompleteCache(cacheKey, features);
        }
        return features;
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

  // ── Normalizar resultados (Nominatim / backend proxy) ────────────────
  // Ambos endpoints retornan formato Nominatim: array con display_name, lat, lon
  private normalizeSearchResults(results: any[]): GeocodingFeature[] {
    return results
      .filter(r => r && (r.lat || r.latitude) && (r.lon || r.longitude || r.lng))
      .map(r => {
        const lat = parseFloat(r.lat ?? r.latitude ?? 0);
        const lon = parseFloat(r.lon ?? r.longitude ?? r.lng ?? 0);
        const displayName: string = r.display_name ?? r.formatted ?? '';
        const parts = displayName.split(',');
        const text = (parts[0]?.trim()) || r.name || 'Lugar';
        const place_name = displayName || text;

        // place_type: si viene del backend proxy (Mapbox-compat) úsalo directamente;
        // si viene de Nominatim raw, derivarlo de class/type.
        const place_type: string[] = r.place_type
          ? (Array.isArray(r.place_type) ? r.place_type : [r.place_type])
          : this.inferPlaceType(r.class ?? '', r.type ?? '');

        return { place_name, center: [lon, lat] as [number, number], text, place_type };
      });
  }

  // Deriva place_type a partir de la taxonomía de Nominatim (class + type)
  private inferPlaceType(cls: string, type: string): string[] {
    if (cls === 'highway' || type === 'house' || type === 'residential') return ['address'];
    if (cls === 'place') return ['place'];
    if (cls === 'amenity' || cls === 'shop' || cls === 'tourism') return ['poi'];
    if (cls === 'leisure' || cls === 'natural') return ['poi'];
    if (cls === 'boundary' || type === 'administrative') return ['region'];
    if (type === 'city' || type === 'town' || type === 'village') return ['locality'];
    return ['place'];
  }

  // ── Helper cache con LRU simple ───────────────────────────────────────
  private setAutocompleteCache(key: string, data: GeocodingFeature[]): void {
    this.autocompleteCache.set(key, { data, timestamp: Date.now() });
    if (this.autocompleteCache.size > this.MAX_CACHE_SIZE) {
      const firstKey = this.autocompleteCache.keys().next().value;
      this.autocompleteCache.delete(firstKey);
    }
  }

  // Mantenido por compatibilidad con reverseGeocode (usa Photon properties)
  private normalizePhotonFeatures(features: any[]): GeocodingFeature[] {
    return features.map(f => {
      const p = f.properties || {};
      const [lng, lat] = f.geometry?.coordinates || [0, 0];
      const parts: string[] = [];
      if (p.housenumber && p.street) parts.push(`${p.street} ${p.housenumber}`);
      else if (p.street) parts.push(p.street);
      else if (p.name)   parts.push(p.name);
      if (p.district && p.district !== p.city) parts.push(p.district);
      if (p.city)    parts.push(p.city);
      if (p.state && p.state !== p.city) parts.push(p.state);
      if (p.country) parts.push(p.country);
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

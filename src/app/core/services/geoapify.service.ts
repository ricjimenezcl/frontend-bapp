import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Resultado de geocodificación de Geoapify
 */
export interface GeoapifyResult {
  formatted: string;
  lat: number;
  lon: number;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
  country_code?: string;
  place_id?: string;
}

/**
 * Response del backend para geocodificación
 */
export interface GeoapifyResponse {
  results: GeoapifyResult[];
}

/**
 * Geoapify Service - Sincronizado con proyecto WEB
 * Servicio para búsqueda de direcciones y geocodificación inversa
 * usando los endpoints del backend que consumen Geoapify API
 */
@Injectable({
  providedIn: 'root'
})
export class GeoapifyService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/providers/geocoding`;

  /**
   * Buscar direcciones por texto (autocomplete)
   * @param query Texto de búsqueda (mínimo 3 caracteres)
   * @param country Código de país (default: 'cl' para Chile)
   * @returns Observable con array de resultados
   */
  searchAddress(query: string, country = 'cl'): Observable<GeoapifyResult[]> {
    if (!query || query.length < 3) {
      return of([]);
    }

    return this.http.get<GeoapifyResponse>(`${this.apiUrl}/search`, {
      params: { q: query, country }
    }).pipe(
      map(response => response.results || []),
      catchError(error => {
        console.error('[GeoapifyService] searchAddress error:', error);
        return of([]);
      })
    );
  }

  /**
   * Geocodificación inversa - obtener dirección desde coordenadas
   * @param lat Latitud
   * @param lon Longitud
   * @returns Observable con el resultado más cercano o null
   */
  reverseGeocode(lat: number, lon: number): Observable<GeoapifyResult | null> {
    return this.http.get<GeoapifyResponse>(`${this.apiUrl}/reverse`, {
      params: { 
        lat: lat.toString(), 
        lon: lon.toString() 
      }
    }).pipe(
      map(response => response.results?.[0] || null),
      catchError(error => {
        console.error('[GeoapifyService] reverseGeocode error:', error);
        return of(null);
      })
    );
  }

  /**
   * Buscar direcciones con límite de resultados
   * @param query Texto de búsqueda
   * @param limit Número máximo de resultados (default: 5)
   * @param country Código de país
   * @returns Observable con array de resultados
   */
  searchAddressWithLimit(
    query: string, 
    limit: number = 5, 
    country = 'cl'
  ): Observable<GeoapifyResult[]> {
    if (!query || query.length < 3) {
      return of([]);
    }

    return this.http.get<GeoapifyResponse>(`${this.apiUrl}/search`, {
      params: { q: query, country, limit: limit.toString() }
    }).pipe(
      map(response => (response.results || []).slice(0, limit)),
      catchError(error => {
        console.error('[GeoapifyService] searchAddressWithLimit error:', error);
        return of([]);
      })
    );
  }
}

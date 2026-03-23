import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GeoJSONFeatureCollection, GeoJSONFeature, ProviderProperties } from '../../core/models/geo-provider.model';

@Injectable({
    providedIn: 'root'
})
export class ClientProviderService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) { }

    getNearbyProviders(
        lat: number,
        lng: number,
        radiusKm: number = 10,
        serviceId?: number
    ): Observable<GeoJSONFeatureCollection> {

        let params = new HttpParams()
            .set('lat', lat.toString())
            .set('lng', lng.toString())
            .set('radius', radiusKm.toString());

        // Si hay serviceId, usamos el endpoint específico o filtramos
        // Backend tiene: /providers/nearby/service/{service_id} o /providers/nearby?service_name=...
        // Asumiremos que podemos usar el endpoint genérico o el específico según el caso

        let endpoint = `${this.apiUrl}/providers/nearby`;

        if (serviceId) {
            endpoint = `${this.apiUrl}/providers/nearby/service/${serviceId}`;
        }

        return this.http.get<any[]>(endpoint, { params }).pipe(
            map(providers => this.toGeoJSON(providers))
        );
    }

    private toGeoJSON(providers: any[]): GeoJSONFeatureCollection {
        const features: GeoJSONFeature[] = providers
            .filter(p => p.latitude && p.longitude)
            .map(p => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(p.longitude), parseFloat(p.latitude)]
                },
                properties: {
                    id: p.id,                           // service_provider.id
                    provider_id: p.provider_id,         // Provider.id (user_id del proveedor)
                    service_id: p.service_id,           // ID de la categoría de servicio
                    business_name: p.business_name || p.full_name,
                    full_name: p.full_name,
                    description: p.description,
                    address: p.address,
                    phone: p.phone,
                    hourly_rate: p.hourly_rate,
                    rating_avg: parseFloat(p.rating_avg || 0),
                    total_reviews: p.total_reviews || 0,
                    avatar: p.avatar,
                    service_icon: p.service_icon || p.service_category?.icon || 'business',
                    service_name: p.service_category_name,
                    distance: p.distance
                }
            }));

        return {
            type: 'FeatureCollection',
            features
        };
    }
}

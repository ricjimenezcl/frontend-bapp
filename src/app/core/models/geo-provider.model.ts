export interface ProviderProperties {
  id: number;
  business_name: string;
  rating_avg: number;
  avatar: string | null;
  service_icon?: string;
  has_booking?: boolean;
}



// src/app/core/models/geo-provider.model.ts

export interface GeoJSONGeometry {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJSONProperties {
  id: number;
  provider_id?: number;           // ID del Provider (user_id del proveedor)
  user_id?: number;
  business_name?: string;
  full_name?: string;
  description?: string;
  profile_image?: string;
  rating_avg?: number;
  total_reviews?: number;
  hourly_rate?: number;
  is_available?: boolean;
  latitude?: number;
  longitude?: number;
  distance?: number;
  service_id?: number;
  service_name?: string;
  services?: string[];
  category_id?: number;
  category_name?: string;
  address?: string;
  phone?: string;
  avatar?: string | null;
  service_icon?: string;
  [key: string]: any; // Para propiedades adicionales
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONGeometry;
  properties: GeoJSONProperties;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

// Helper para convertir proveedor a GeoJSON Feature
export function providerToGeoJSONFeature(provider: any): GeoJSONFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [
        parseFloat(provider.longitude),
        parseFloat(provider.latitude)
      ]
    },
    properties: {
      id: provider.id,
      user_id: provider.user_id,
      business_name: provider.business_name,
      full_name: provider.full_name,
      description: provider.description,
      profile_image: provider.profile_image,
      rating_avg: provider.rating_avg,
      total_reviews: provider.total_reviews,
      hourly_rate: provider.hourly_rate,
      is_available: provider.is_available,
      latitude: provider.latitude,
      longitude: provider.longitude,
      distance: provider.distance,
      service_id: provider.service_id,
      service_name: provider.service_name,
      services: provider.services,
      category_id: provider.category_id,
      category_name: provider.category_name
    }
  };
}

// Helper para convertir array de proveedores a FeatureCollection
export function providersToGeoJSONCollection(providers: any[]): GeoJSONFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: providers
      .filter(p => p.latitude && p.longitude)
      .map(providerToGeoJSONFeature)
  };
}

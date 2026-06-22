/**
 * Provider Model
 * Representa la información del proveedor autenticado
 */

export interface ProviderProfile {
  id: number;
  user_id: number;
  full_name: string;
  phone?: string;
  avatar?: string; // URL Cloudinary
  bio?: string;
  rating_avg?: number;
  run?: string;
  email?: string;
  status?: string;
  is_available?: boolean;
  address?: string;
  total_reviews?: number;
  identity_document_url?: string;
  selfie_url?: string;
  validation_status?: 'pending' | 'approved' | 'rejected';
  validation_notes?: string;
  is_profile_complete?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ServiceProvider {
  id: number;
  provider_id: number;
  service_id: number;
  business_name: string;
  description?: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  hourly_rate?: number;
  is_available: boolean;
  validation_status: 'pending' | 'approved' | 'rejected';
  rating_avg: number;
  total_reviews: number;
  created_at?: string;
  updated_at?: string;
}

export interface PromotionImage {
  url: string; // URL desde Cloudinary
  title: string;
  description: string;
  discount: number;
}

export enum BookingStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled'
}

export interface BookingCreate {
    provider_id: number;            // Integer ID from providers table
    service_id: number;             // Integer ID from service_categories table
    service_provider_id?: number;   // Optional: Integer ID from service_providers table
    scheduled_date: string;         // Date format (YYYY-MM-DD)
    scheduled_time: string;         // Time format (HH:mm:ss)
    duration: number;               // Duration in minutes (15-480)
    total_price: number;            // Total price (Decimal)
    description?: string;           // Optional description
    location_address?: string;      // Optional location address
    location_lat?: number;          // Optional latitude
    location_lng?: number;          // Optional longitude
    service_category?: string;      // Optional: service category name
}

export interface BookingResponse {
    id: string;
    client_id: string;
    provider_id: string;
    service_id?: string;
    service_category?: string;
    status: BookingStatus;
    location_address?: string;
    scheduled_date: string;
    scheduled_time?: string;
    total_price?: number;
    duration?: number;
    created_at: string;
    location_lat?: number;
    location_lng?: number;
    description?: string;
    client_name?: string;
    client_avatar?: string;
}

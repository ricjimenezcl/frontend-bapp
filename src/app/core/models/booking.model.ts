export enum BookingStatus {
    PENDING     = 'PENDING',
    APPROVED    = 'APPROVED',
    REJECTED    = 'REJECTED',
    CONFIRMED   = 'CONFIRMED',   // legacy
    IN_PROGRESS = 'IN_PROGRESS', // legacy
    COMPLETED   = 'COMPLETED',
    CANCELLED   = 'CANCELLED',   // legacy
    NOSHOW      = 'NOSHOW',      // legacy
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
    id: string | number;
    client_id: string | number;
    provider_id: string | number;
    service_id?: string | number;
    service_provider_id?: number;
    service_category?: string;
    status: BookingStatus;
    location_address?: string;
    location_lat?: number;
    location_lng?: number;
    scheduled_date: string;
    scheduled_time?: string;
    duration?: number;
    total_price?: number;
    description?: string;
    cancellation_reason?: string;
    payment_method?: string;
    currency?: string;
    created_at: string;
    updated_at?: string;
    completed_at?: string;
    client_name?: string;
    client_avatar?: string;
    provider?: { full_name: string; avatar?: string };
    client?: { full_name: string; avatar?: string };
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
    PENDING:     'Pendiente',
    APPROVED:    'Aprobado',
    REJECTED:    'Rechazado',
    CONFIRMED:   'Confirmado',
    IN_PROGRESS: 'En progreso',
    COMPLETED:   'Completado',
    CANCELLED:   'Cancelado',
    NOSHOW:      'No presentado',
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
    PENDING:     'warning',
    APPROVED:    'success',
    REJECTED:    'danger',
    CONFIRMED:   'success',
    IN_PROGRESS: 'success',
    COMPLETED:   'tertiary',
    CANCELLED:   'danger',
    NOSHOW:      'medium',
};

/**
 * Request para actualizar una reserva
 */
export interface BookingUpdateRequest {
    scheduled_date?: string;
    scheduled_time?: string;
    duration?: number;
    total_price?: number;
    description?: string;
    location_address?: string;
    location_lat?: number;
    location_lng?: number;
}

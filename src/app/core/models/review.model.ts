export interface Review {
    id: number;
    booking_id: number;
    client_id: number;
    provider_id: number;
    rating: number;
    comment?: string;
    client_name?: string;
    created_at: string;
    updated_at: string;
}

export interface CreateReviewRequest {
    booking_id: number;
    rating: number;    // 1.0 – 5.0
    comment?: string;
}

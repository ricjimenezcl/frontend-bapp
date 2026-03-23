export interface NotificationPayload {
    booking_id: number;
    status: 'pending' | 'confirmed' | 'cancelled';
    role: 'client' | 'provider';
}

export interface Notification {
    id: number;
    type: string;                      // notificationType del backend
    title: string;
    content: string;                   // era: message (alineado con backend)
    payload?: NotificationPayload;
    is_read: boolean;
    created_at: string;
    related_entity_id?: number;        // booking_id, review_id, etc.
    related_entity_type?: string;      // 'booking', 'review', etc.
}

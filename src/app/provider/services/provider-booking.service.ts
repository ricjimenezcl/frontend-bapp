import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BookingResponse } from '../../core/models/booking.model';

@Injectable({
    providedIn: 'root'
})
export class ProviderBookingService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) { }

    getBookings(): Observable<BookingResponse[]> {
        return this.http.get<BookingResponse[]>(`${this.apiUrl}/bookings/provider`);
    }

    acceptBooking(bookingId: number, notes?: string): Observable<BookingResponse> {
        return this.http.post<BookingResponse>(`${this.apiUrl}/bookings/${bookingId}/approve`, { notes: notes || null });
    }

    rejectBooking(bookingId: number, reason: string = 'PROVIDER_REQUEST', reasonComment?: string): Observable<BookingResponse> {
        return this.http.patch<BookingResponse>(`${this.apiUrl}/bookings/${bookingId}/reject`, { 
            reason_comment: reasonComment || null 
        });
    }
}

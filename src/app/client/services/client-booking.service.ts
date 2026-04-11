import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BookingCreate, BookingResponse } from '../../core/models/booking.model';

@Injectable({
    providedIn: 'root'
})
export class ClientBookingService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) { }

    createBooking(booking: BookingCreate): Observable<BookingResponse> {
        return this.http.post<BookingResponse>(`${this.apiUrl}/bookings`, booking);
    }

    // Future methods: getMyBookings, cancelBooking, etc.
}

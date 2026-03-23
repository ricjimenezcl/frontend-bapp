import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Notification } from '../models/notification.model';

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) { }

    getMyNotifications(): Observable<Notification[]> {
        return this.http.get<Notification[]>(`${this.apiUrl}/notifications/`);
    }

    markAsRead(id: number): Observable<Notification> {
        return this.http.patch<Notification>(`${this.apiUrl}/notifications/${id}/read`, {});
    }
}

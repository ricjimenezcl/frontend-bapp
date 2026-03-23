import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
import { NotificationService } from './notification.service';
import { Notification } from '../models/notification.model';
import { AuthService } from '../../auth/services/auth.service';
import { WebSocketService } from './websocket.service';

@Injectable({
    providedIn: 'root'
})
export class NotificationStateService {
    private notificationsSubject = new BehaviorSubject<Notification[]>([]);
    public notifications$ = this.notificationsSubject.asObservable();

    private unreadCountSubject = new BehaviorSubject<number>(0);
    public unreadCount$ = this.unreadCountSubject.asObservable();

    private destroy$ = new Subject<void>();

    constructor(
        private notificationService: NotificationService,
        private authService: AuthService,
        private webSocketService: WebSocketService
    ) {
        // Carga inicial HTTP una sola vez — sin polling periódico
        if (this.authService.isAuthenticated()) {
            this.refreshNotifications();
            this.subscribeToWebSocketEvents();
        } else {
            this.clearState();
        }
    }

    refreshNotifications(): void {
        this.notificationService.getMyNotifications().subscribe((notifications: Notification[]) => {
            this.notificationsSubject.next(notifications);
            this.updateUnreadCount(notifications);
        });
    }

    /**
     * Sincronizar desde servidor — llamar al reconectar WebSocket o al volver a foreground.
     * Reemplaza el polling periódico con una sola carga bajo demanda.
     */
    syncFromServer(): void {
        if (this.authService.isAuthenticated()) {
            this.refreshNotifications();
        }
    }

    /**
     * Suscripción a eventos de notificación via WebSocket.
     * Elimina el polling de 30 segundos — los eventos llegan en push.
     * Solo hace HTTP refresh cuando llega una notificación real (no periódicamente).
     */
    private subscribeToWebSocketEvents(): void {
        // Nuevas notificaciones llegadas por push
        this.webSocketService.getNotifications$()
            .pipe(
                takeUntil(this.destroy$),
                filter(() => this.authService.isAuthenticated())
            )
            .subscribe(() => {
                // Incrementar badge de forma optimista sin esperar HTTP
                const current = this.unreadCountSubject.value;
                this.unreadCountSubject.next(current + 1);

                // Refrescar lista completa una sola vez (solo al recibir evento real)
                this.refreshNotifications();
            });

        // Sincronizar al reconectar WebSocket tras caída de red
        this.webSocketService.getReconnected$()
            .pipe(
                takeUntil(this.destroy$),
                filter(() => this.authService.isAuthenticated())
            )
            .subscribe(() => {
                this.syncFromServer();
            });
    }

    private updateUnreadCount(notifications: Notification[]) {
        const count = notifications.filter(n => !n.is_read).length;
        this.unreadCountSubject.next(count);
    }

    markAsRead(id: number): void {
        // Actualización optimista
        const currentNotifications = this.notificationsSubject.value;
        const updatedNotifications = currentNotifications.map(n =>
            n.id === id ? { ...n, is_read: true } : n
        );
        this.notificationsSubject.next(updatedNotifications);
        this.updateUnreadCount(updatedNotifications);

        // Llamada API
        this.notificationService.markAsRead(id).subscribe({
            error: () => {
                this.refreshNotifications();
            }
        });
    }

    private clearState(): void {
        this.notificationsSubject.next([]);
        this.unreadCountSubject.next(0);
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }
}

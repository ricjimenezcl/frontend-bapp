import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';
import { NotificationStateService } from '../../../core/services/notification-state.service';
import { Notification } from '../../../core/models/notification.model';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-notifications',
    templateUrl: './notifications.page.html',
    styleUrls: ['./notifications.page.scss'],
    standalone: true,
    imports: [CommonModule, IonicModule]
})
export class NotificationsPage implements OnInit {

    notifications$: Observable<Notification[]>;

    constructor(
        private notificationState: NotificationStateService,
        private navCtrl: NavController
    ) {
        this.notifications$ = this.notificationState.notifications$;
    }

    ngOnInit() {
        this.notificationState.refreshNotifications();
    }

    ionViewWillEnter() {
        this.notificationState.refreshNotifications();
    }

    onNotificationClick(notification: Notification) {
        // 1. Mark as read immediately (optimistic)
        if (!notification.is_read) {
            this.notificationState.markAsRead(notification.id);
        }

        // 2. Navigate based on payload
        if (notification.payload?.booking_id) {
            const { booking_id, role } = notification.payload;
            if (role === 'client') {
                this.navCtrl.navigateForward(`/client/tabs/bookings`); // Or detail page if exists
            } else if (role === 'provider') {
                // Usually providers navigate to the specific booking or inbox tab
                // For now, let's go to provider inbox
                this.navCtrl.navigateForward(`/provider/tabs/bookings`);
            }
        }
    }

    getIcon(type: string): string {
        switch (type) {
            case 'booking_created':
            case 'BOOKING_CREATED': return 'calendar-number-outline';
            case 'booking_accepted':
            case 'BOOKING_ACCEPTED': return 'checkmark-circle-outline';
            case 'booking_rejected':
            case 'BOOKING_REJECTED': return 'close-circle-outline';
            case 'booking_reminder_24h': return 'time-outline';
            default: return 'notifications-outline';
        }
    }

    getColor(type: string): string {
        switch (type) {
            case 'booking_created':
            case 'BOOKING_CREATED': return 'primary';
            case 'booking_accepted':
            case 'BOOKING_ACCEPTED': return 'success';
            case 'booking_rejected':
            case 'BOOKING_REJECTED': return 'danger';
            case 'booking_reminder_24h': return 'warning';
            default: return 'medium';
        }
    }
}

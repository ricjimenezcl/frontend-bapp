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
            return;
        }

        const planTypes = ['plan_activated', 'plan_expiring_soon', 'plan_expired'];
        if (planTypes.includes(notification.type)) {
            const role = notification.payload?.role;
            this.navCtrl.navigateForward(role === 'provider' ? '/provider/tabs/profile' : '/client/tabs/profile');
        }
    }

    getIcon(type: string): string {
        switch (type) {
            case 'booking_created':
            case 'BOOKING_CREATED':
            case 'booking_received':
            case 'BOOKING_RECEIVED': return 'calendar-number-outline';
            case 'booking_request_sent':
            case 'BOOKING_REQUEST_SENT': return 'paper-plane-outline';
            case 'booking_accepted':
            case 'BOOKING_ACCEPTED':
            case 'booking_confirmed':
            case 'BOOKING_CONFIRMED': return 'checkmark-circle-outline';
            case 'booking_rejected':
            case 'BOOKING_REJECTED': return 'close-circle-outline';
            case 'booking_reminder_24h': return 'time-outline';
            case 'booking_expired':
            case 'BOOKING_EXPIRED': return 'close-circle-outline';
            case 'plan_activated': return 'checkmark-done-circle-outline';
            case 'plan_expiring_soon': return 'hourglass-outline';
            case 'plan_expired': return 'alert-circle-outline';
            default: return 'notifications-outline';
        }
    }

    getColor(type: string): string {
        switch (type) {
            case 'booking_created':
            case 'BOOKING_CREATED':
            case 'booking_received':
            case 'BOOKING_RECEIVED':
            case 'booking_request_sent':
            case 'BOOKING_REQUEST_SENT': return 'primary';
            case 'booking_accepted':
            case 'BOOKING_ACCEPTED':
            case 'booking_confirmed':
            case 'BOOKING_CONFIRMED': return 'success';
            case 'booking_rejected':
            case 'BOOKING_REJECTED': return 'danger';
            case 'booking_reminder_24h': return 'warning';
            case 'booking_expired':
            case 'BOOKING_EXPIRED': return 'medium';
            case 'plan_activated': return 'success';
            case 'plan_expiring_soon': return 'warning';
            case 'plan_expired': return 'danger';
            default: return 'medium';
        }
    }
}

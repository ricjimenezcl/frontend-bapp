/**
 * Notifications Component for BAPP Search FASE 2
 * Panel de notificaciones con contador y listado
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  signal,
  computed,
  effect
} from '@angular/core';
import {
  Router
} from '@angular/router';
import {
  Subject,
  Observable,
  takeUntil,
  tap,
  filter
} from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { NotificationService } from '../../../core/services/notification.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { Notification, NotificationType, WebSocketNotification } from '../../../core/models/chat.model';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class NotificationsComponent implements OnInit, OnDestroy {
  // Signals
  notifications = signal<Notification[]>([]);
  unreadCount = signal(0);
  isLoading = signal(false);
  isConnecting = signal(false);
  isConnected = signal(false);
  selectedFilter = signal<NotificationType | 'all'>('all');
  error = signal<string | null>(null);

  // Computed
  filteredNotifications = computed(() => {
    const all = this.notifications();
    const filter = this.selectedFilter();

    if (filter === 'all') {
      return all;
    }

    return all.filter(n => n.notificationType === filter);
  });

  groupedNotifications = computed(() => {
    const notifs = this.filteredNotifications();
    const grouped = new Map<string, Notification[]>();

    notifs.forEach(n => {
      const type = n.notificationType as string;
      if (!grouped.has(type)) {
        grouped.set(type, []);
      }
      grouped.get(type)!.push(n);
    });

    return Array.from(grouped.entries()).map(([type, notifications]) => ({
      type,
      count: notifications.length,
      notifications
    }));
  });

  unreadNotifications = computed(() => {
    return this.notifications().filter(n => !n.isRead);
  });

  // Subjects
  private destroy$ = new Subject<void>();

  // Constants
  notificationTypeLabels = {
    [NotificationType.MESSAGE]: 'Mensajes',
    [NotificationType.BOOKING_CONFIRMED]: 'Reservas Confirmadas',
    [NotificationType.BOOKING_REJECTED]: 'Reservas Rechazadas',
    [NotificationType.BOOKING_COMPLETED]: 'Reservas Completadas',
    [NotificationType.REVIEW_RECEIVED]: 'Reseñas',
    [NotificationType.SERVICE_APPROVED]: 'Servicios Aprobados',
    [NotificationType.SERVICE_REJECTED]: 'Servicios Rechazados',
    [NotificationType.PAYMENT_RECEIVED]: 'Pagos Recibidos',
    [NotificationType.PAYMENT_FAILED]: 'Pagos Fallidos'
  } as Record<string, string>;

  notificationTypeIcons = {
    [NotificationType.MESSAGE]: 'chatbubble',
    [NotificationType.BOOKING_CONFIRMED]: 'calendar-check',
    [NotificationType.BOOKING_REJECTED]: 'calendar-clear',
    [NotificationType.BOOKING_COMPLETED]: 'checkmark-circle',
    [NotificationType.REVIEW_RECEIVED]: 'star',
    [NotificationType.SERVICE_APPROVED]: 'checkmark-done',
    [NotificationType.SERVICE_REJECTED]: 'close-circle',
    [NotificationType.PAYMENT_RECEIVED]: 'wallet',
    [NotificationType.PAYMENT_FAILED]: 'warning'
  } as Record<string, string>;

  notificationTypeColors = {
    [NotificationType.MESSAGE]: 'primary',
    [NotificationType.BOOKING_CONFIRMED]: 'success',
    [NotificationType.BOOKING_REJECTED]: 'danger',
    [NotificationType.BOOKING_COMPLETED]: 'success',
    [NotificationType.REVIEW_RECEIVED]: 'warning',
    [NotificationType.SERVICE_APPROVED]: 'success',
    [NotificationType.SERVICE_REJECTED]: 'danger',
    [NotificationType.PAYMENT_RECEIVED]: 'success',
    [NotificationType.PAYMENT_FAILED]: 'danger'
  } as Record<string, string>;

  constructor(
    private notificationService: NotificationService,
    private webSocketService: WebSocketService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
    this.connectWebSocket();
    this.setupWebSocketListeners();
  }

  /**
   * Load notifications from API
   */
  private loadNotifications(): void {
    this.isLoading.set(true);
    this.notificationService.getMyNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (notifications: Notification[]) => {
          this.notifications.set(notifications);
          this.updateUnreadCount();
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error loading notifications:', error);
          this.error.set('Error cargando notificaciones');
          this.isLoading.set(false);
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Connect to WebSocket for real-time notifications
   */
  private connectWebSocket(): void {
    this.isConnecting.set(true);

    this.webSocketService.connectToNotifications()
      .then(() => {
        this.isConnected.set(true);
        this.isConnecting.set(false);
        this.cdr.markForCheck();
        console.log('✓ Notifications WebSocket connected');
      })
      .catch((error: unknown) => {
        console.error('Failed to connect notifications WebSocket:', error);
        this.isConnecting.set(false);
        this.cdr.markForCheck();
      });
  }

  /**
   * Setup WebSocket listeners
   */
  private setupWebSocketListeners(): void {
    // Listen to real-time notifications
    this.webSocketService.getNotifications$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((wsNotification: WebSocketNotification) => {
        this.handleNewNotification(wsNotification);
      });

    // Listen to notification count updates
    this.webSocketService.getNotificationsCount$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((count: number) => {
        this.unreadCount.set(count);
        this.cdr.markForCheck();
      });

    // Listen to errors
    this.webSocketService.getErrors$()
      .pipe(
        filter((err: any) => err.connection === 'notification'),
        takeUntil(this.destroy$)
      )
      .subscribe((err: any) => {
        console.error('WebSocket error:', err.error);
      });
  }

  /**
   * Handle new real-time notification
   */
  private handleNewNotification(wsNotification: WebSocketNotification): void {
    const newNotification: Notification = {
      id: wsNotification.notificationId,
      userId: 0, // Will be set by service
      notificationType: wsNotification.notificationType,
      title: wsNotification.title,
      content: wsNotification.content,
      relatedEntityId: wsNotification.relatedEntityId,
      isRead: false,
      createdAt: new Date(wsNotification.timestamp),
      updatedAt: new Date(wsNotification.timestamp)
    };

    // Add to beginning of list
    this.notifications.update(notifs => [newNotification, ...notifs]);
    this.updateUnreadCount();
    this.cdr.markForCheck();

    // Show toast
    this.showNotificationToast(newNotification);
  }

  /**
   * Show notification toast
   */
  private showNotificationToast(notification: Notification): void {
    // Could integrate with ion-toast or custom toast service
    console.log('🔔 New notification:', notification.title);
  }

  /**
   * Mark notification as read
   */
  markAsRead(notification: Notification): void {
    if (notification.isRead) {
      return;
    }

    this.notificationService.markAsRead(notification.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Update local notification
          this.notifications.update(notifs =>
            notifs.map(n =>
              n.id === notification.id ? { ...n, isRead: true } : n
            )
          );
          this.updateUnreadCount();
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error marking notification as read:', error);
        }
      });
  }

  /**
   * Mark all as read
   */
  markAllAsRead(): void {
    // Método no implementado en NotificationService. Si se requiere, implementar en el servicio y backend.
    // Por ahora, solo marcar localmente como leídas:
    this.notifications.update(notifs =>
      notifs.map(n => ({ ...n, isRead: true }))
    );
    this.updateUnreadCount();
    this.cdr.markForCheck();
  }

  /**
   * Delete notification
   */
  deleteNotification(notificationId: number): void {
    // Método no implementado en NotificationService. Si se requiere, implementar en el servicio y backend.
    // Por ahora, solo eliminar localmente:
    this.notifications.update(notifs =>
      notifs.filter(n => n.id !== notificationId)
    );
    this.updateUnreadCount();
    this.cdr.markForCheck();
  }

  /**
   * Update unread count
   */
  private updateUnreadCount(): void {
    const count = this.unreadNotifications().length;
    this.unreadCount.set(count);
  }

  /**
   * Handle notification click
   */
  onNotificationClick(notification: Notification): void {
    // Mark as read
    this.markAsRead(notification);

    // Navigate based on type
    if (notification.notificationType === NotificationType.MESSAGE && notification.relatedEntityId) {
      this.router.navigate(['/chat', notification.relatedEntityId]);
    } else if (notification.relatedEntityId) {
      // Could navigate to booking, review, etc.
      console.log('Navigate to:', notification.notificationType, notification.relatedEntityId);
    }
  }

  /**
   * Get notification type label
   */
  getTypeLabel(type: string): string {
    return this.notificationTypeLabels[type] || type;
  }

  /**
   * Get notification type icon
   */
  getTypeIcon(type: string): string {
    return this.notificationTypeIcons[type] || 'notifications';
  }

  /**
   * Get notification type color
   */
  getTypeColor(type: string): string {
    return this.notificationTypeColors[type] || 'medium';
  }

  /**
   * Get notification age
   */
  getNotificationAge(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Justo ahora';
    if (minutes < 60) return `hace ${minutes}m`;
    if (hours < 24) return `hace ${hours}h`;
    if (days < 7) return `hace ${days}d`;

    return new Date(date).toLocaleDateString();
  }

  /**
   * Track by notification ID
   */
  trackByNotificationId(index: number, notification: Notification): number {
    return notification.id;
  }

  /**
   * Track by group type
   */
  trackByGroupType(index: number, group: any): string {
    return group.type;
  }

  /**
   * Cleanup
   */
  ngOnDestroy(): void {
    this.webSocketService.disconnectFromNotifications();
    this.destroy$.next();
    this.destroy$.complete();
  }
}

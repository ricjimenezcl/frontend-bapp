/**
 * Notification Real-time Service
 * Handles WebSocket connection to /ws/notifications endpoint
 * Emits notification events when received from backend
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../../auth/services/auth.service';
import { environment } from '../../../environments/environment';

export interface RealTimeNotification {
  type: 'notification';
  notification_type: string; // 'booking_created', 'booking_accepted', 'booking_rejected', 'chat_message'
  title: string;
  message: string;
  data?: any;
  timestamp?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationRealtimeService {
  private ws: WebSocket | null = null;
  private intentionalDisconnect = false;
  private reconnectTimeout: any = null;
  private connectionStatusSubject = new BehaviorSubject<'connected' | 'disconnected' | 'connecting'>('disconnected');
  private notificationSubject = new Subject<RealTimeNotification>();

  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  public notification$ = this.notificationSubject.asObservable();

  constructor(
    private authService: AuthService,
    private toastController: ToastController
  ) {}

  /**
   * Connect to WebSocket notification endpoint
   */
  public connect(): void {
    this.intentionalDisconnect = false;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('✓ WebSocket already connected or connecting');
      return;
    }

    this.connectionStatusSubject.next('connecting');

    try {
      const token = this.authService.getToken();
      if (!token) {
        console.warn('⚠️ No auth token available for WebSocket connection');
        this.connectionStatusSubject.next('disconnected');
        return;
      }

      // Build WebSocket URL from environment.apiUrl
      const apiUrl = new URL(environment.apiUrl);
      const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${apiUrl.host}/api/v1/ws/notifications?token=${token}`;

      console.log('🔌 Connecting to WebSocket:', wsUrl.replace(token, '***'));

      this.ws = new WebSocket(wsUrl);

      // Connection opened
      this.ws.onopen = () => {
        console.log('✓ WebSocket connected to notifications');
        this.connectionStatusSubject.next('connected');
        this.startHeartbeat();
      };

      // Message received
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'notification') {
            console.log('📬 Notification received:', data.notification_type);
            this.notificationSubject.next(data as RealTimeNotification);
            this.handleNotificationReceived(data as RealTimeNotification);
          } else if (data.type === 'pong') {
            console.log('💓 Heartbeat pong received');
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      // Connection error
      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.connectionStatusSubject.next('disconnected');
      };

      // Connection closed
      this.ws.onclose = () => {
        console.log('❌ WebSocket disconnected');
        this.connectionStatusSubject.next('disconnected');
        this.stopHeartbeat();

        if (!this.intentionalDisconnect) {
          this.reconnectTimeout = setTimeout(() => {
            console.log('🔄 Attempting to reconnect WebSocket...');
            this.connect();
          }, 5000);
        }
      };

    } catch (error) {
      console.error('❌ Error creating WebSocket connection:', error);
      this.connectionStatusSubject.next('disconnected');
    }
  }

  /**
   * Disconnect from WebSocket
   */
  public disconnect(): void {
    this.intentionalDisconnect = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connectionStatusSubject.next('disconnected');
    console.log('🔌 WebSocket disconnected');
  }

  /**
   * Send ping to keep connection alive
   */
  private heartbeatInterval: any;
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.error('❌ Error sending heartbeat:', error);
        }
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Handle notification received and show toast
   */
  private async handleNotificationReceived(notification: RealTimeNotification): Promise<void> {
    // Show toast notification
    const toast = await this.toastController.create({
      header: notification.title,
      message: notification.message,
      duration: 4000,
      position: 'top',
      buttons: [
        {
          text: 'Cerrar',
          role: 'cancel'
        }
      ],
      color: this.getToastColor(notification.notification_type)
    });

    await toast.present();

    // Log notification
    console.log('📬 Notification displayed:', notification);
  }

  /**
   * Determine toast color based on notification type
   */
  private getToastColor(notificationType: string): string {
    const colorMap: { [key: string]: string } = {
      'booking_created': 'primary',
      'booking_accepted': 'success',
      'booking_confirmed': 'success',
      'booking_rejected': 'warning',
      'booking_reminder_24h': 'warning',
      'booking_completed': 'success',
      'chat_message': 'info'
    };

    return colorMap[notificationType] || 'primary';
  }

  /**
   * Get connection status as observable
   */
  public getConnectionStatus(): Observable<'connected' | 'disconnected' | 'connecting'> {
    return this.connectionStatus$;
  }

  /**
   * Get notifications as observable
   */
  public getNotifications(): Observable<RealTimeNotification> {
    return this.notification$;
  }

  /**
   * Check if WebSocket is connected
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

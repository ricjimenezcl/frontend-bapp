/**
 * WebSocket Service for BAPP Search FASE 2 Frontend
 * Gestiona conexiones WebSocket para chat y notificaciones en tiempo real
 */

import { Injectable } from '@angular/core';
import {
  Subject,
  Observable,
  BehaviorSubject,
  interval,
  Subscription
} from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import {
  ChatMessage,
  WebSocketMessage,
  WebSocketChatMessage,
  WebSocketTypingIndicator,
  WebSocketPresenceUpdate,
  WebSocketNotification,
  WebSocketReadConfirmation,
  Notification
} from '../models/chat.model';
import { AuthService } from '../../auth/services/auth.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private chatWebSocket: WebSocket | null = null;
  private notificationWebSocket: WebSocket | null = null;

  // Connection states
  private chatConnected$ = new BehaviorSubject<boolean>(false);
  private notificationConnected$ = new BehaviorSubject<boolean>(false);

  // Message streams
  private chatMessages$ = new Subject<WebSocketChatMessage>();
  private typingIndicators$ = new Subject<WebSocketTypingIndicator>();
  private presenceUpdates$ = new Subject<WebSocketPresenceUpdate>();
  private readConfirmations$ = new Subject<WebSocketReadConfirmation>();

  // Notifications
  private notifications$ = new Subject<WebSocketNotification>();
  private notificationsCount$ = new BehaviorSubject<number>(0);

  // Error handling
  private errors$ = new Subject<{ connection: 'chat' | 'notification'; error: any }>();

  // Reconexión — emite cuando la conexión de notificaciones se restablece
  private reconnected$ = new Subject<void>();

  // Emite cuando el backend rechaza la conexión por token inválido/expirado (código 4401)
  private authExpired$ = new Subject<void>();

  // Connection metadata
  private activeConversationId: number | null = null;
  private currentUserId: number | string | null = null;
  private keepAliveInterval: Subscription | null = null;
  // Contadores separados para chat y notificaciones
  private chatReconnectAttempts = 0;
  private notifReconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  // Exponential backoff: delay inicial 1s, máximo 30s
  private readonly reconnectBaseDelay = 1000;
  private readonly reconnectMaxDelay = 30000;
  /** @deprecated mantener por compatibilidad — usar chatReconnectAttempts/notifReconnectAttempts */
  private reconnectAttempts = 0;
  private reconnectDelay = 3000;

  private destroy$ = new Subject<void>();

  // ── Unified WebSocket (ÁREA 2) ──────────────────────────────────────────────
  private unifiedWebSocket: WebSocket | null = null;
  private unifiedConnected$ = new BehaviorSubject<boolean>(false);
  private unifiedReconnectAttempts = 0;

  constructor(private authService: AuthService) {
    this.initialize();
  }

  /**
   * Initialize service
   */
  private initialize(): void {
    // Get current user
    this.authService.getCurrentUserObservable()
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUserId = user?.id ?? null;
      });
  }

  /**
   * Connect to chat WebSocket
   */
  connectToChat(conversationId: number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        if (this.chatWebSocket && (
          this.chatWebSocket.readyState === WebSocket.OPEN ||
          this.chatWebSocket.readyState === WebSocket.CONNECTING
        )) {
          console.log('✓ Already connected/connecting to chat');
          this.activeConversationId = conversationId;
          resolve();
          return;
        }

        const token = await this.authService.getToken();
        if (!token) {
          reject(new Error('No authentication token available'));
          return;
        }

        if (this.isTokenExpired(token)) {
          console.error('🔒 Chat WS: token expirado, cancelando conexión');
          this.authExpired$.next();
          reject(new Error('Token expired'));
          return;
        }

        const wsUrl = this.buildWebSocketUrl(`/api/v1/ws/chat/${conversationId}?token=${token}`);

        console.log(`📡 Connecting to chat: ${conversationId}`);
        this.chatWebSocket = new WebSocket(wsUrl);

        this.chatWebSocket.onopen = () => {
          console.log('✓ Chat WebSocket connected');
          this.chatConnected$.next(true);
          this.activeConversationId = conversationId;
          this.chatReconnectAttempts = 0;
          this.startChatKeepAlive();
          resolve();
        };

        this.chatWebSocket.onmessage = (event) => {
          this.handleChatMessage(event.data);
        };

        this.chatWebSocket.onerror = (error) => {
          console.error('✗ Chat WebSocket error:', error);
          this.errors$.next({ connection: 'chat', error });
          reject(error);
        };

        this.chatWebSocket.onclose = (event) => {
          console.log(`✗ Chat WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
          this.chatConnected$.next(false);

          // Código 4401: auth failure confirmada por el backend (token expirado/inválido)
          if (event.code === 4401) {
            console.error('🔒 Chat WS: sesión expirada (4401), deteniendo reconexión');
            this.authExpired$.next();
            return;
          }

          this.attemptChatReconnect(conversationId);
        };

      } catch (error) {
        console.error('Error connecting to chat:', error);
        reject(error);
      }
    });
  }

  /**
   * Connect to notifications WebSocket
   */
  connectToNotifications(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        if (this.notificationWebSocket && (
          this.notificationWebSocket.readyState === WebSocket.OPEN ||
          this.notificationWebSocket.readyState === WebSocket.CONNECTING
        )) {
          console.log('✓ Already connected/connecting to notifications');
          resolve();
          return;
        }

        const token = await this.authService.getToken();
        if (!token) {
          reject(new Error('No authentication token available'));
          return;
        }

        if (this.isTokenExpired(token)) {
          console.error('🔒 Notifications WS: token expirado, cancelando conexión');
          this.authExpired$.next();
          reject(new Error('Token expired'));
          return;
        }

        const wsUrl = this.buildWebSocketUrl(`/api/v1/ws/notifications?token=${token}`);

        console.log('📡 Connecting to notifications');
        this.notificationWebSocket = new WebSocket(wsUrl);

        this.notificationWebSocket.onopen = () => {
          const wasReconnect = this.notifReconnectAttempts > 0;
          console.log('✓ Notifications WebSocket connected');
          this.notificationConnected$.next(true);
          this.notifReconnectAttempts = 0;
          this.startNotificationKeepAlive();
          if (wasReconnect) {
            // Señal para que notification-state.service.ts sincronice desde servidor
            this.reconnected$.next();
          }
          resolve();
        };

        this.notificationWebSocket.onmessage = (event) => {
          this.handleNotificationMessage(event.data);
        };

        this.notificationWebSocket.onerror = (error) => {
          console.error('✗ Notifications WebSocket error:', error);
          this.errors$.next({ connection: 'notification', error });
          reject(error);
        };

        this.notificationWebSocket.onclose = (event) => {
          console.log(`✗ Notifications WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
          this.notificationConnected$.next(false);

          // Código 4401: auth failure confirmada por el backend (token expirado/inválido)
          if (event.code === 4401) {
            console.error('🔒 Notifications WS: sesión expirada (4401), deteniendo reconexión');
            this.authExpired$.next();
            return;
          }

          this.attemptNotificationReconnect();
        };

      } catch (error) {
        console.error('Error connecting to notifications:', error);
        reject(error);
      }
    });
  }

  /**
   * Send chat message
   */
  sendMessage(content: string): void {
    if (!this.chatWebSocket || this.chatWebSocket.readyState !== WebSocket.OPEN) {
      console.error('Chat WebSocket not connected');
      this.errors$.next({
        connection: 'chat',
        error: 'WebSocket not connected'
      });
      return;
    }

    const message: WebSocketMessage = {
      type: 'message',
      data: { content: content.trim() }
    };

    try {
      this.chatWebSocket.send(JSON.stringify(message));
      console.log('✓ Message sent');
    } catch (error) {
      console.error('Error sending message:', error);
      this.errors$.next({ connection: 'chat', error });
    }
  }

  /**
   * Send typing indicator
   */
  sendTypingIndicator(userName: string, isTyping: boolean): void {
    if (!this.chatWebSocket || this.chatWebSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: WebSocketMessage = {
      type: 'typing',
      data: {
        user_name: userName,
        is_typing: isTyping
      }
    };

    try {
      this.chatWebSocket.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }

  /**
   * Mark message as read
   */
  markMessageAsRead(messageId: number): void {
    if (!this.chatWebSocket || this.chatWebSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: WebSocketMessage = {
      type: 'read',
      data: { message_id: messageId }
    };

    try {
      this.chatWebSocket.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }

  /**
   * Update presence status
   */
  updatePresence(status: 'online' | 'offline' | 'away'): void {
    if (!this.chatWebSocket || this.chatWebSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: WebSocketMessage = {
      type: 'presence',
      data: { status }
    };

    try {
      this.chatWebSocket.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }

  /**
   * Disconnect from chat
   */
  disconnectFromChat(): void {
    if (this.chatWebSocket && this.chatWebSocket.readyState === WebSocket.OPEN) {
      console.log('🔌 Disconnecting from chat');
      this.chatWebSocket.close(1000, 'User disconnected');
    }
    this.activeConversationId = null;
    this.stopChatKeepAlive();
  }

  /**
   * Disconnect from notifications
   */
  disconnectFromNotifications(): void {
    if (this.notificationWebSocket && this.notificationWebSocket.readyState === WebSocket.OPEN) {
      console.log('🔌 Disconnecting from notifications');
      this.notificationWebSocket.close(1000, 'User disconnected');
    }
    this.stopNotificationKeepAlive();
  }

  /**
   * Disconnect all
   */
  disconnectAll(): void {
    this.disconnectFromChat();
    this.disconnectFromNotifications();
    this.destroy$.next();
  }

  // ==================== Observable Streams ====================

  /**
   * Get chat messages stream
   */
  getChatMessages$(): Observable<WebSocketChatMessage> {
    return this.chatMessages$.asObservable();
  }

  /**
   * Get typing indicators stream
   */
  getTypingIndicators$(): Observable<WebSocketTypingIndicator> {
    return this.typingIndicators$.asObservable();
  }

  /**
   * Get presence updates stream
   */
  getPresenceUpdates$(): Observable<WebSocketPresenceUpdate> {
    return this.presenceUpdates$.asObservable();
  }

  /**
   * Get read confirmations stream
   */
  getReadConfirmations$(): Observable<WebSocketReadConfirmation> {
    return this.readConfirmations$.asObservable();
  }

  /**
   * Get notifications stream
   */
  getNotifications$(): Observable<WebSocketNotification> {
    return this.notifications$.asObservable();
  }

  /**
   * Get notifications count stream
   */
  getNotificationsCount$(): Observable<number> {
    return this.notificationsCount$.asObservable();
  }

  /**
   * Get chat connection status
   */
  getChatConnected$(): Observable<boolean> {
    return this.chatConnected$.asObservable();
  }

  /**
   * Get notifications connection status
   */
  getNotificationConnected$(): Observable<boolean> {
    return this.notificationConnected$.asObservable();
  }

  /**
   * Get errors stream
   */
  getErrors$(): Observable<{ connection: 'chat' | 'notification'; error: any }> {
    return this.errors$.asObservable();
  }

  // ==================== Private Methods ====================

  /**
   * Handle chat message
   */
  protected handleChatMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      switch (message.type) {
        case 'message':
          this.chatMessages$.next(message as WebSocketChatMessage);
          break;

        case 'typing':
          this.typingIndicators$.next(message as WebSocketTypingIndicator);
          break;

        case 'presence_update':
          this.presenceUpdates$.next(message as WebSocketPresenceUpdate);
          break;

        case 'read_confirmation':
          this.readConfirmations$.next(message as WebSocketReadConfirmation);
          break;

        case 'error':
          this.errors$.next({ connection: 'chat', error: message });
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing chat message:', error);
    }
  }

  /**
   * Handle notification message
   */
  protected handleNotificationMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      if (message.type === 'notification') {
        const notification = message as WebSocketNotification;
        this.notifications$.next(notification);
        // Increment unread count
        const currentCount = this.notificationsCount$.value;
        this.notificationsCount$.next(currentCount + 1);
      } else if (message.type === 'pong') {
        console.log('📍 Pong received');
      }
    } catch (error) {
      console.error('Error parsing notification message:', error);
    }
  }

  /**
   * Start keep-alive for chat
   */
  private startChatKeepAlive(): void {
    this.stopChatKeepAlive();
    // Keep-alive will be sent by client ping through presence updates
  }

  /**
   * Start keep-alive for notifications
   */
  private startNotificationKeepAlive(): void {
    this.stopNotificationKeepAlive();

    this.keepAliveInterval = interval(30000).subscribe(() => {
      if (this.notificationWebSocket && this.notificationWebSocket.readyState === WebSocket.OPEN) {
        const ping: WebSocketMessage = { type: 'ping' };
        try {
          this.notificationWebSocket.send(JSON.stringify(ping));
        } catch (error) {
          console.error('Error sending ping:', error);
        }
      }
    });
  }

  /**
   * Stop keep-alive for chat
   */
  private stopChatKeepAlive(): void {
    // Handled by disconnect
  }

  /**
   * Stop keep-alive for notifications
   */
  private stopNotificationKeepAlive(): void {
    if (this.keepAliveInterval) {
      this.keepAliveInterval.unsubscribe();
    }
  }

  /**
   * Attempt to reconnect to chat — usa exponential backoff (1s → 2s → 4s → ... → 30s)
   */
  private attemptChatReconnect(conversationId: number): void {
    if (this.chatReconnectAttempts >= this.maxReconnectAttempts) {
      console.error('✗ Max chat reconnection attempts reached');
      this.errors$.next({
        connection: 'chat',
        error: 'Failed to reconnect after multiple attempts'
      });
      return;
    }

    this.chatReconnectAttempts++;
    const delay = Math.min(
      this.reconnectBaseDelay * Math.pow(2, this.chatReconnectAttempts - 1),
      this.reconnectMaxDelay
    );
    console.log(`🔄 Chat reconnect attempt ${this.chatReconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(async () => {
      const token = this.authService.getToken();
      if (!token || this.isTokenExpired(token)) {
        console.error('🔒 Chat WS: token expirado, deteniendo reconexión');
        this.chatReconnectAttempts = this.maxReconnectAttempts;
        this.authExpired$.next();
        return;
      }
      this.connectToChat(conversationId).catch(error => {
        console.error('Chat reconnect failed:', error);
      });
    }, delay);
  }

  /**
   * Attempt to reconnect to notifications — usa exponential backoff (1s → 2s → 4s → ... → 30s)
   */
  private attemptNotificationReconnect(): void {
    if (this.notifReconnectAttempts >= this.maxReconnectAttempts) {
      console.error('✗ Max notification reconnection attempts reached');
      return;
    }

    this.notifReconnectAttempts++;
    const delay = Math.min(
      this.reconnectBaseDelay * Math.pow(2, this.notifReconnectAttempts - 1),
      this.reconnectMaxDelay
    );
    console.log(`🔄 Notification reconnect attempt ${this.notifReconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(async () => {
      const token = this.authService.getToken();
      if (!token || this.isTokenExpired(token)) {
        console.error('🔒 Notifications WS: token expirado, deteniendo reconexión');
        this.notifReconnectAttempts = this.maxReconnectAttempts;
        this.authExpired$.next();
        return;
      }
      this.connectToNotifications().catch(error => {
        console.error('Notification reconnect failed:', error);
      });
    }, delay);
  }

  /**
   * Observable que emite cuando la conexión de notificaciones se restablece.
   * Usado por NotificationStateService para sincronizar desde servidor tras reconexión.
   */
  getReconnected$(): Observable<void> {
    return this.reconnected$.asObservable();
  }

  /**
   * Observable que emite cuando el backend rechaza la conexión WS por token expirado (código 4401).
   * Los componentes deben suscribirse para redirigir al login.
   */
  getAuthExpired$(): Observable<void> {
    return this.authExpired$.asObservable();
  }

  /**
   * Decodifica el payload del JWT (client-side, no es una validación de seguridad)
   * y verifica si el campo exp ya pasó.
   * Retorna true si el token está expirado o es inválido.
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  /**
   * Resetea los contadores de reconexión al hacer logout o login nuevo.
   */
  resetReconnectCounters(): void {
    this.chatReconnectAttempts = 0;
    this.notifReconnectAttempts = 0;
  }

  // ── Unified WebSocket methods ───────────────────────────────────────────────

  /**
   * Conecta al endpoint unificado /ws/unified.
   * Reemplaza connectToChat() + connectToNotifications() en una sola conexión.
   * Los mensajes entrantes se routean automáticamente a los streams existentes
   * (chatMessages$, notifications$, typingIndicators$, etc.) según su `channel`.
   */
  connectToUnified(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (this.unifiedWebSocket && (
        this.unifiedWebSocket.readyState === WebSocket.OPEN ||
        this.unifiedWebSocket.readyState === WebSocket.CONNECTING
      )) {
        resolve();
        return;
      }

      const token = await this.authService.getToken();
      if (!token) { reject(new Error('No authentication token')); return; }
      if (this.isTokenExpired(token)) {
        this.authExpired$.next();
        reject(new Error('Token expired'));
        return;
      }

      const wsUrl = this.buildWebSocketUrl(`/api/v1/ws/unified?token=${token}`);
      console.log('📡 Connecting to unified WS');
      this.unifiedWebSocket = new WebSocket(wsUrl);

      this.unifiedWebSocket.onopen = () => {
        const wasReconnect = this.unifiedReconnectAttempts > 0;
        console.log('✓ Unified WebSocket connected');
        this.unifiedConnected$.next(true);
        this.chatConnected$.next(true);
        this.notificationConnected$.next(true);
        this.unifiedReconnectAttempts = 0;
        if (wasReconnect) { this.reconnected$.next(); }
        resolve();
      };

      this.unifiedWebSocket.onmessage = (event) => {
        this._handleUnifiedMessage(event.data);
      };

      this.unifiedWebSocket.onerror = (error) => {
        this.errors$.next({ connection: 'notification', error });
        reject(error);
      };

      this.unifiedWebSocket.onclose = (event) => {
        this.unifiedConnected$.next(false);
        this.chatConnected$.next(false);
        this.notificationConnected$.next(false);
        if (event.code === 4401) {
          console.error('🔒 Unified WS: sesión expirada (4401)');
          this.authExpired$.next();
          return;
        }
        this._attemptUnifiedReconnect();
      };
    });
  }

  /** Desconecta el WebSocket unificado */
  disconnectFromUnified(): void {
    if (this.unifiedWebSocket && this.unifiedWebSocket.readyState === WebSocket.OPEN) {
      this.unifiedWebSocket.close(1000, 'User disconnected');
    }
    this.unifiedWebSocket = null;
  }

  /** Une la conexión unificada a una sala de chat */
  joinConversationUnified(conversationId: number): void {
    this._sendUnified({ channel: 'chat', conversation_id: conversationId, type: 'join' });
  }

  /** Abandona la sala de chat en la conexión unificada */
  leaveConversationUnified(conversationId: number): void {
    this._sendUnified({ channel: 'chat', conversation_id: conversationId, type: 'leave' });
  }

  /** Envía un mensaje de chat por la conexión unificada */
  sendMessageUnified(conversationId: number, content: string): void {
    this._sendUnified({
      channel: 'chat',
      conversation_id: conversationId,
      type: 'message',
      data: { content: content.trim() },
    });
  }

  /** Envía indicador de escritura por la conexión unificada */
  sendTypingUnified(conversationId: number, userName: string, isTyping: boolean): void {
    this._sendUnified({
      channel: 'chat',
      conversation_id: conversationId,
      type: 'typing',
      data: { user_name: userName, is_typing: isTyping },
    });
  }

  /** Estado de conexión del WebSocket unificado */
  getUnifiedConnected$(): Observable<boolean> {
    return this.unifiedConnected$.asObservable();
  }

  private _sendUnified(payload: object): void {
    if (!this.unifiedWebSocket || this.unifiedWebSocket.readyState !== WebSocket.OPEN) {
      console.warn('Unified WS not connected');
      return;
    }
    try {
      this.unifiedWebSocket.send(JSON.stringify(payload));
    } catch (err) {
      console.error('Unified WS send error:', err);
    }
  }

  private _handleUnifiedMessage(data: string): void {
    try {
      const msg = JSON.parse(data);
      const channel = msg.channel ?? 'notification';

      if (msg.type === 'ping') {
        this._sendUnified({ type: 'pong' });
        return;
      }
      if (msg.type === 'pong') { return; }

      if (channel === 'chat') {
        this.handleChatMessage(data);  // reutiliza el handler existente
      } else {
        this.handleNotificationMessage(data);  // reutiliza el handler existente
      }
    } catch (err) {
      console.error('Unified WS parse error:', err);
    }
  }

  private _attemptUnifiedReconnect(): void {
    if (this.unifiedReconnectAttempts >= this.maxReconnectAttempts) {
      console.error('✗ Max unified WS reconnection attempts reached');
      return;
    }
    this.unifiedReconnectAttempts++;
    const delay = Math.min(
      this.reconnectBaseDelay * Math.pow(2, this.unifiedReconnectAttempts - 1),
      this.reconnectMaxDelay
    );
    console.log(`🔄 Unified WS reconnect attempt ${this.unifiedReconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    setTimeout(() => {
      const token = this.authService.getToken();
      if (!token || this.isTokenExpired(token)) {
        this.authExpired$.next();
        return;
      }
      this.connectToUnified().catch(() => {});
    }, delay);
  }

  /**
   * Build WebSocket URL
   */
  private buildWebSocketUrl(path: string): string {
    try {
      const apiUrl = new URL(environment.apiUrl);
      const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${apiUrl.host}${path}`;
    } catch {
      const fallbackProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const fallbackHost = window.location.host;
      return `${fallbackProtocol}//${fallbackHost}${path}`;
    }
  }
}

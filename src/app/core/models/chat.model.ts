/**
 * Chat Models for BAPP Search FASE 2 Frontend
 * Tipos TypeScript para conversaciones, mensajes y notificaciones
 */

/**
 * User Basic Info
 */
export interface UserBasic {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  displayName?: string;
}

/**
 * Chat Message
 */
export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  messageContent: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
  sender?: UserBasic;
}

/**
 * Chat Conversation
 */
export interface ChatConversation {
  id: number;
  clientId: number;
  providerId: number;
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  client?: UserBasic;
  provider?: UserBasic;
  messages?: ChatMessage[];
  lastMessage?: ChatMessage;
  unreadCount?: number;
}

/**
 * Notification Types
 */
export enum NotificationType {
  MESSAGE = 'message',
  BOOKING_CONFIRMED = 'booking_confirmed',
  BOOKING_REJECTED = 'booking_rejected',
  BOOKING_COMPLETED = 'booking_completed',
  REVIEW_RECEIVED = 'review_received',
  SERVICE_APPROVED = 'service_approved',
  SERVICE_REJECTED = 'service_rejected',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed'
}

/**
 * User Notification
 */
export interface Notification {
  id: number;
  userId: number;
  notificationType: NotificationType | string;
  title: string;
  content: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * WebSocket Message Types
 */
export interface WebSocketMessage {
  type: 'message' | 'typing' | 'read' | 'presence' | 'presence_update' | 'notification' | 'read_confirmation' | 'ping' | 'pong' | 'error';
  data?: any;
  senderId?: number;
  timestamp?: string;
}

/**
 * WebSocket Chat Message
 */
export interface WebSocketChatMessage extends WebSocketMessage {
  type: 'message';
  messageId: number;
  senderId: number;
  senderName: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

/**
 * WebSocket Typing Indicator
 */
export interface WebSocketTypingIndicator extends WebSocketMessage {
  type: 'typing';
  userId: number;
  userName: string;
  isTyping: boolean;
  timestamp: string;
}

/**
 * WebSocket Presence Update
 */
export interface WebSocketPresenceUpdate extends WebSocketMessage {
  type: 'presence_update';
  userId: number;
  presenceStatus: 'online' | 'offline' | 'away';
  timestamp: string;
}

/**
 * WebSocket Notification
 */
export interface WebSocketNotification extends WebSocketMessage {
  type: 'notification';
  notificationId: number;
  notificationType: string;
  title: string;
  content: string;
  relatedEntityId?: number;
  timestamp: string;
  isRead: boolean;
}

/**
 * WebSocket Read Confirmation
 */
export interface WebSocketReadConfirmation extends WebSocketMessage {
  type: 'read_confirmation';
  messageId: number;
}

/**
 * Request/Response Interfaces
 */

export interface MessageCreateRequest {
  content: string;
}

export interface ConversationListResponse {
  total: number;
  skip: number;
  limit: number;
  items: ChatConversation[];
}

export interface NotificationListResponse {
  total: number;
  skip: number;
  limit: number;
  items: Notification[];
}

/**
 * Pagination
 */
export interface PaginationParams {
  skip: number;
  limit: number;
}

/**
 * Conversation with calculated properties
 */
export interface ConversationUI extends ChatConversation {
  otherUser?: UserBasic;
  displayName?: string;
  lastMessagePreview?: string;
  isActive?: boolean;
  typingUsers?: number[];
}

/**
 * Notification Group by type
 */
export interface NotificationGroup {
  type: NotificationType | string;
  count: number;
  notifications: Notification[];
}

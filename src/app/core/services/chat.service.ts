import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  forkJoin,
  of,
  throwError
} from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { AuthService, User } from '../../auth/services/auth.service';
import {
  ChatConversation,
  ChatMessage,
  ConversationUI,
  MessageCreateRequest,
  UserBasic
} from '../models/chat.model';

interface ApiUserBasicResponse {
  id: number;
  email: string;
  role: string;
  status: string;
  name?: string;
}

interface ApiMessageResponse {
  id: number;
  conversation_id: number;
  sender_id: number;
  message_content: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
  sender?: ApiUserBasicResponse | null;
}

interface ApiConversationResponse {
  id: number;
  client_id: number;
  provider_id: number;
  started_at: string;
  ended_at?: string | null;
  created_at: string;
  updated_at: string;
  client?: ApiUserBasicResponse | null;
  provider?: ApiUserBasicResponse | null;
  messages?: ApiMessageResponse[];
}

interface ApiConversationListResponse {
  total: number;
  skip: number;
  limit: number;
  items: ApiConversationResponse[];
}

export interface ConversationLoadOptions {
  skip?: number;
  limit?: number;
  withDetails?: boolean;
}

interface GetConversationOptions {
  setActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly chatUrl = `${environment.apiUrl}/chat`;
  private readonly conversationsSubject = new BehaviorSubject<ConversationUI[]>([]);
  private readonly activeConversationSubject = new BehaviorSubject<ChatConversation | null>(null);

  private currentUserId: string | number | null = null;
  /** Timestamp del último load exitoso de conversaciones. TTL = 10s para evitar HTTP duplicados entre páginas. */
  private conversationsCacheTime: number = 0;
  private readonly CONVERSATIONS_TTL_MS = 10_000;

  readonly conversations$ = this.conversationsSubject.asObservable();
  readonly activeConversation$ = this.activeConversationSubject.asObservable();

  constructor(private http: HttpClient, private authService: AuthService) {
    this.authService.getCurrentUserObservable().subscribe(user => {
      this.currentUserId = user?.id ?? null;
    });
  }

  getCurrentUser(): Observable<User | null> {
    return this.authService.getCurrentUserObservable();
  }

  loadConversations(options: ConversationLoadOptions = {}): Observable<ConversationUI[]> {
    // Devolver caché si existe y no ha expirado — evita HTTP duplicados entre páginas hermanas
    const cached = this.conversationsSubject.value;
    const isCacheValid = cached.length > 0 && Date.now() - this.conversationsCacheTime < this.CONVERSATIONS_TTL_MS;
    if (isCacheValid && !options.skip) {
      return of(cached);
    }

    const params = new HttpParams()
      .set('skip', String(options.skip ?? 0))
      .set('limit', String(options.limit ?? 20));

    return this.http.get<any>(`${this.chatUrl}/conversations`, { params }).pipe(
      switchMap(response => {
        // Backend may return either a paginated wrapper { items: [...] } or a plain array of list items.
        const items: any[] = Array.isArray(response) ? response : (response.items ?? []);
        // ensure a locally-typed copy so `withDetails` may be compared to `false` safely
        const { withDetails } = options as { withDetails?: boolean };

        if (!items.length) {
          return of([] as ConversationUI[]);
        }

        // If API already returned list-optimized items (ConversationListResponse) we can map directly
        const looksLikeListItem = items[0] && (items[0].last_message_preview !== undefined || items[0].other_participant_id !== undefined);
        if (looksLikeListItem || withDetails === false) {
          const lightweight = items.map(item => this.mapConversationListItem(item));
          return of(this.sortConversations(lightweight));
        }



        // Default (legacy) behaviour: fetch details for each conversation but avoid duplicate requests by using cache
        const detailRequests = items.map(item => this.fetchConversationDetailWithCache(item.id));
        return forkJoin(detailRequests).pipe(
          map(conversations => conversations.map(conv => this.decorateConversation(conv)))
        );
      }),
      map(conversations => this.sortConversations(conversations)),
      tap(conversations => {
        this.conversationsSubject.next(conversations);
        this.conversationsCacheTime = Date.now();
      }),
      catchError(error => {
        console.error('[ChatService] loadConversations failed', error);
        return throwError(() => error);
      })
    );
  }

  // Map server-side ConversationListResponse -> ConversationUI (lightweight)
  private mapConversationListItem(item: any): ConversationUI {
    const lastAt = item.last_message_at ? new Date(item.last_message_at) : undefined;

    const mapped: ConversationUI = {
      id: item.id,
      clientId: undefined as any,
      providerId: undefined as any,
      startedAt: undefined as any,
      endedAt: undefined as any,
      createdAt: new Date(),
      updatedAt: lastAt ?? new Date(),
      client: undefined,
      provider: undefined,
      messages: [],
      lastMessage: item.last_message_preview ? {
        id: 0,
        conversationId: item.id,
        senderId: 0,
        messageContent: item.last_message_preview,
        isRead: false,
        createdAt: lastAt ?? new Date(),
        updatedAt: lastAt ?? new Date()
      } : undefined,
      otherUser: item.other_participant_name ? { id: item.other_participant_id, firstName: item.other_participant_name, lastName: '', email: '', avatarUrl: item.other_participant_avatar } : undefined,
      displayName: item.other_participant_name ?? item.title ?? `Conversación #${item.id}`,
      lastMessagePreview: item.last_message_preview ?? 'Sin mensajes',
      unreadCount: item.unread_count ?? 0,
      isMuted: item.is_muted ?? false,
      isPinned: item.is_pinned ?? false
    } as unknown as ConversationUI;

    return mapped;
  }

  // Small in-memory cache for fetchConversationDetail to reduce duplicate HTTP requests
  private fetchConversationDetailWithCache(conversationId: number): Observable<ChatConversation> {
    const cached = this.conversationsSubject.value.find(c => c.id === conversationId) as ChatConversation | undefined;
    if (cached) {
      return of(cached as ChatConversation);
    }

    return this.fetchConversationDetail(conversationId);
  }

  getConversation(conversationId: number, options: GetConversationOptions = {}): Observable<ChatConversation> {
    return this.fetchConversationDetail(conversationId).pipe(
      tap(conversation => {
        if (options.setActive) {
          this.activeConversationSubject.next(conversation);
        }
        this.upsertConversation(conversation);
      }),
      catchError(error => {
        console.error(`[ChatService] getConversation failed (${conversationId})`, error);
        return throwError(() => error);
      })
    );
  }

  startConversationWithProvider(providerId: number): Observable<ChatConversation> {
    return this.http
      .post<ApiConversationResponse>(`${this.chatUrl}/conversations/${providerId}`, {})
      .pipe(
        switchMap(conversation => this.fetchConversationDetail(conversation.id)),
        tap(conversation => this.upsertConversation(conversation)),
        catchError(error => {
          console.error(`[ChatService] startConversationWithProvider failed (${providerId})`, error);
          return throwError(() => error);
        })
      );
  }

  sendMessage(conversationId: number, payload: MessageCreateRequest): Observable<ChatMessage> {
    return this.http
      .post<ApiMessageResponse>(`${this.chatUrl}/conversations/${conversationId}/messages`, payload)
      .pipe(
        map(message => this.mapMessage(message)),
        catchError(error => {
          console.error(`[ChatService] sendMessage failed (${conversationId})`, error);
          return throwError(() => error);
        })
      );
  }

  getMessages(conversationId: number, skip: number = 0, limit: number = 100): Observable<ChatMessage[]> {
    // Return cached messages if we already have them in the conversationsSubject to avoid HTTP round-trips
    const cached = this.conversationsSubject.value.find(c => c.id === conversationId);
    if (cached && cached.messages && cached.messages.length && skip === 0) {
      return of(cached.messages as ChatMessage[]);
    }

    const params = new HttpParams()
      .set('skip', String(skip))
      .set('limit', String(limit));

    return this.http
      .get<ApiMessageResponse[]>(`${this.chatUrl}/conversations/${conversationId}/messages`, { params })
      .pipe(
        map(messages => messages.map(msg => this.mapMessage(msg))),
        catchError(error => {
          console.error(`[ChatService] getMessages failed (${conversationId})`, error);
          return throwError(() => error);
        })
      );
  }

  markAllMessagesAsRead(conversationId: number): Observable<any> {
    return this.http.post<any>(`${this.chatUrl}/conversations/${conversationId}/read-all`, {}).pipe(
      tap(() => {
        // Actualizar el conteo local de no leídos a 0
        const conversations = this.conversationsSubject.value.map(c => {
          if (c.id === conversationId) {
            return { ...c, unreadCount: 0 };
          }
          return c;
        });
        this.conversationsSubject.next(conversations);
      }),
      catchError(error => {
        console.error(`[ChatService] markAllMessagesAsRead failed (${conversationId})`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Aplicar actualización local al recibir un evento WS de nuevo mensaje.
   * Actualiza unreadCount, preview y timestamp en el cache interno sin HTTP.
   * Llamado desde las páginas inbox/chat al procesar notificaciones de tipo MESSAGE.
   */
  applyLocalMessageUpdate(conversationId: number, messagePreview: string): void {
    const current = this.conversationsSubject.value;
    if (!current.some(c => c.id === conversationId)) return;
    const updated = current.map(c => {
      if (c.id !== conversationId) return c;
      return {
        ...c,
        unreadCount: (c.unreadCount ?? 0) + 1,
        lastMessagePreview: messagePreview || c.lastMessagePreview,
        updatedAt: new Date()
      } as ConversationUI;
    });
    // Invalidar TTL para que el próximo pull-to-refresh traiga datos frescos del servidor
    this.conversationsCacheTime = 0;
    this.conversationsSubject.next(this.sortConversations(updated));
  }

  markMessageAsRead(messageId: number): Observable<void> {
    return this.http.put<void>(`${this.chatUrl}/messages/${messageId}/read`, {}).pipe(
      catchError(error => {
        console.error(`[ChatService] markMessageAsRead failed (${messageId})`, error);
        return throwError(() => error);
      })
    );
  }

  getCachedConversations(): ConversationUI[] {
    return this.conversationsSubject.value;
  }

  private fetchConversationDetail(conversationId: number): Observable<ChatConversation> {
    return this.http
      .get<ApiConversationResponse>(`${this.chatUrl}/conversations/${conversationId}`)
      .pipe(map(conversation => this.mapConversation(conversation)));
  }

  private mapConversation(conversation: ApiConversationResponse): ChatConversation {
    const messages = (conversation.messages || []).map(message => this.mapMessage(message));
    const mapped: ChatConversation = {
      id: conversation.id,
      clientId: conversation.client_id,
      providerId: conversation.provider_id,
      startedAt: new Date(conversation.started_at),
      endedAt: conversation.ended_at ? new Date(conversation.ended_at) : undefined,
      createdAt: new Date(conversation.created_at),
      updatedAt: new Date(conversation.updated_at),
      client: this.mapUser(conversation.client),
      provider: this.mapUser(conversation.provider),
      messages,
      lastMessage: messages.length ? messages[messages.length - 1] : undefined
    };

    return mapped;
  }

  private mapMessage(message: ApiMessageResponse): ChatMessage {
    return {
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      messageContent: message.message_content,
      isRead: message.is_read,
      createdAt: new Date(message.created_at),
      updatedAt: new Date(message.updated_at),
      sender: this.mapUser(message.sender)
    };
  }

  private mapUser(user?: ApiUserBasicResponse | null): UserBasic | undefined {
    if (!user) {
      return undefined;
    }

    return {
      id: user.id,
      firstName: '',  // No disponible en backend (separado)
      lastName: '',   // No disponible en backend (separado)
      email: user.email,
      avatarUrl: undefined,  // No disponible en backend
      displayName: user.name
    };
  }

  private decorateConversation(conversation: ChatConversation): ConversationUI {
    const otherUser = this.resolveOtherUser(conversation);
    const lastMessage = conversation.lastMessage || (conversation.messages?.length ? conversation.messages[conversation.messages.length - 1] : undefined);
    const unreadCount = this.calculateUnread(conversation);

    return {
      ...conversation,
      otherUser,
      displayName: otherUser?.displayName || (otherUser ? `${otherUser.firstName} ${otherUser.lastName}`.trim() : `Conversación #${conversation.id}`),
      lastMessage,
      lastMessagePreview: lastMessage ? lastMessage.messageContent : 'Sin mensajes',
      unreadCount
    };
  }

  private resolveOtherUser(conversation: ChatConversation): UserBasic | undefined {
    if (!this.currentUserId) {
      return conversation.provider ?? conversation.client;
    }

    const currentId = Number(this.currentUserId);
    const clientId = Number(conversation.clientId);
    const providerId = conversation.provider?.id ? Number(conversation.provider.id) : null;
    // Nota: conversation.providerId en el modelo es el ID de la tabla providers, no users.id

    if (clientId === currentId) {
      return conversation.provider ?? conversation.client;
    }

    // Si el usuario actual es el proveedor (asumiendo que resolveOtherUser se llama con el perfil cargado)
    return conversation.client ?? conversation.provider;
  }

  private calculateUnread(conversation: ChatConversation): number {
    if (!this.currentUserId || !conversation.messages?.length) {
      return 0;
    }

    return conversation.messages.filter(
      message => !message.isRead && message.senderId !== this.currentUserId
    ).length;
  }

  private upsertConversation(conversation: ChatConversation): void {
    const decorated = this.decorateConversation(conversation);
    const current = this.conversationsSubject.value.filter(item => item.id !== decorated.id);
    this.conversationsSubject.next(this.sortConversations([...current, decorated]));
  }

  private sortConversations(conversations: ConversationUI[]): ConversationUI[] {
    return [...conversations].sort((a, b) => {
      const left = a.updatedAt?.getTime?.() ?? 0;
      const right = b.updatedAt?.getTime?.() ?? 0;
      return right - left;
    });
  }
}

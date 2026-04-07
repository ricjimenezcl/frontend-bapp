import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, RefresherCustomEvent } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ChatService } from '../../../core/services/chat.service';
import { ConversationUI, NotificationType } from '../../../core/models/chat.model';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../auth/services/auth.service';
import { NotificationRealtimeService } from '../../../core/services/notification-realtime.service';

@Component({
  selector: 'app-client-chats',
  templateUrl: './client-chats.page.html',
  styleUrls: ['./client-chats.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class ClientChatsPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  readonly skeletonItems = Array.from({ length: 4 });
  currentSegment: 'personal' | 'group' = 'personal';

  readonly conversations = signal<ConversationUI[]>([]);
  readonly searchTerm = signal('');
  readonly filter = signal<'all' | 'unread'>('all');
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly stats = computed(() => {
    const list = this.conversations();
    const unread = list.reduce((total, conversation) => total + (conversation.unreadCount ?? 0), 0);
    const active = list.filter(conversation => (conversation.unreadCount ?? 0) > 0).length;

    return {
      totalConversations: list.length,
      unread,
      active,
      lastUpdated: list[0]?.updatedAt ?? null
    };
  });

  readonly filteredConversations = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const filter = this.filter();

    return this.conversations().filter(conversation => {
      const name = conversation.displayName?.toLowerCase() ?? '';
      const preview = conversation.lastMessagePreview?.toLowerCase() ?? '';
      const matchesTerm = !term || name.includes(term) || preview.includes(term);
      const hasUnread = (conversation.unreadCount ?? 0) > 0;
      const matchesFilter = filter === 'all' ? true : hasUnread;

      return matchesTerm && matchesFilter;
    });
  });

  constructor(
    private readonly chatService: ChatService,
    private readonly router: Router,
    private readonly webSocketService: WebSocketService,
    private readonly authService: AuthService,
    private readonly notificationService: NotificationRealtimeService
  ) { }

  ngOnInit(): void {
    this.refreshConversations();
    this.setupRealtimeSync();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refreshConversations(event?: RefresherCustomEvent, options: { silent?: boolean } = {}): void {
    const silent = options.silent ?? false;
    const shouldToggleSpinner = !silent && !event;

    if (!silent) {
      this.error.set(null);
    }

    if (shouldToggleSpinner) {
      this.isLoading.set(true);
    }

    this.chatService
      .loadConversations({ withDetails: false })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: conversations => {
          this.conversations.set(conversations);
          if (shouldToggleSpinner) {
            this.isLoading.set(false);
          }
          this.completeRefresher(event);
        },
        error: error => {
          console.error('ClientChatsPage: failed to load conversations', error);
          if (!silent) {
            this.error.set('No pudimos cargar tus conversaciones. Intenta nuevamente.');
          }
          if (shouldToggleSpinner) {
            this.isLoading.set(false);
          }
          this.completeRefresher(event);
        }
      });
  }

  onSearch(event: Event): void {
    const value = ((event.target as HTMLIonSearchbarElement)?.value ?? '').trim();
    this.searchTerm.set(value);
  }

  onFilterChange(event: CustomEvent): void {
    const value = (event.detail?.value as 'all' | 'unread') || 'all';
    this.filter.set(value);
  }

  openConversation(conversation: ConversationUI): void {
    console.log('Opening conversation:', conversation);
    this.router.navigate(['/client/chat', conversation.id]);
  }

  trackByConversation(_: number, conversation: ConversationUI): number {
    return conversation.id;
  }

  getConversationInitials(conversation: ConversationUI): string {
    const display = conversation.displayName ?? '??';
    return display
      .split(' ')
      .filter(Boolean)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2);
  }

  private setupRealtimeSync(): void {
    if (!this.authService.isTokenValid()) {
      console.warn('ClientChatsPage: token inválido o expirado, omitiendo suscripción WS');
      return;
    }

    // Usar NotificationRealtimeService — ya conectado desde AppComponent.
    // NO llamar connectToNotifications() aquí para evitar conexiones duplicadas al servidor.
    this.notificationService.notification$
      .pipe(takeUntil(this.destroy$))
      .subscribe(notification => {
        const type = (notification.notification_type || '').toLowerCase();
        if (type === 'chat_message' || type === NotificationType.MESSAGE) {
          const conversationId = (notification.data as any)?.conversation_id ?? null;
          if (conversationId == null) {
            this.refreshConversations(undefined, { silent: true });
            return;
          }
          const current = this.conversations();
          const idx = current.findIndex(c => c.id === conversationId);
          if (idx === -1) {
            this.refreshConversations(undefined, { silent: true });
            return;
          }
          const preview = notification.message ?? '';
          const updated = current.map(c =>
            c.id !== conversationId ? c : { ...c, unreadCount: (c.unreadCount ?? 0) + 1, lastMessagePreview: preview || c.lastMessagePreview, updatedAt: new Date() }
          );
          this.conversations.set([...updated].sort((a, b) => (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0)));
          this.chatService.applyLocalMessageUpdate(conversationId, preview);
        }
      });
  }

  private completeRefresher(event?: RefresherCustomEvent): void {
    if (event) {
      event.target.complete();
    }
  }

  formatTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  onSegmentChange(event: any): void {
    this.currentSegment = event.detail.value;
  }
}
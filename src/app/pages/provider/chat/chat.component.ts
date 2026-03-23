/**
 * Chat Component for BAPP Search FASE 2
 * Componente principal para conversaciones y mensajes
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  signal,
  computed
} from '@angular/core';
import {
  ActivatedRoute,
  Router
} from '@angular/router';
import {
  Subject,
  takeUntil,
  filter
} from 'rxjs';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { ChatService } from '../../../core/services/chat.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import {
  ChatConversation,
  ChatMessage,
  WebSocketChatMessage,
  WebSocketTypingIndicator,
  UserBasic
} from '../../../core/models/chat.model';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonicModule]
})
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer', { static: false }) messagesContainer: ElementRef | null = null;

  // Signals
  conversation = signal<ChatConversation | null>(null);
  messages = signal<ChatMessage[]>([]);
  otherUser = signal<UserBasic | null>(null);
  isLoading = signal(true);
  isConnecting = signal(false);
  // HTTP always available → start as connected
  isConnected = signal(true);
  isSending = signal(false);
  typingUsers = signal<Set<number>>(new Set());
  error = signal<string | null>(null);

  // Computed
  displayName = computed(() => {
    const other = this.otherUser();
    return other ? `${other.firstName} ${other.lastName}` : 'Chat';
  });

  isTyping = computed(() => this.typingUsers().size > 0);
  typingText = computed(() => {
    const users = Array.from(this.typingUsers());
    if (users.length === 0) return '';
    if (users.length === 1) return 'está escribiendo...';
    return 'están escribiendo...';
  });

  // Form
  messageForm: FormGroup;

  // Subjects
  private conversationId: number | null = null;
  private currentUserId: number | null = null;
  private destroy$ = new Subject<void>();
  private typingTimer: any;
  private isTypingLocal = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chatService: ChatService,
    private webSocketService: WebSocketService,
    private formBuilder: FormBuilder,
    private cdr: ChangeDetectorRef,
    private location: Location
  ) {
    this.messageForm = this.formBuilder.group({
      content: ['', [Validators.required, Validators.minLength(1)]]
    });
  }

  ngOnInit(): void {
    this.initializeComponent();
    // this.setupWebSocketListeners(); // DISABLED: Using HTTP instead
  }

  /**
   * Initialize component
   */
  private initializeComponent(): void {
    // Get conversation ID from route
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.conversationId = params['id'];
        if (this.conversationId) {
          this.loadConversation();
        }
      });

    // Get current user ID
    this.chatService.getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (user) {
          this.currentUserId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
        }
      });
  }

  /**
   * Load conversation data
   */
  loadConversation(): void {
    if (!this.conversationId) return;

    this.isLoading.set(true);

    this.chatService.getConversation(this.conversationId, { setActive: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (conversation) => {
          this.conversation.set(conversation);
          this.messages.set(conversation.messages || []);

          // Determine other user
          const other = this.currentUserId === conversation.clientId
            ? conversation.provider
            : conversation.client;
          this.otherUser.set(other || null);

          this.isLoading.set(false);
          this.cdr.markForCheck();

          // Connect to WebSocket - DISABLED: Using HTTP instead
          // this.connectWebSocket();
        },
        error: (error) => {
          console.error('Error loading conversation:', error);
          this.error.set('Error cargando conversación');
          this.isLoading.set(false);
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Connect to WebSocket
   */
  private connectWebSocket(): void {
    if (!this.conversationId) return;

    this.isConnecting.set(true);

    this.webSocketService.connectToChat(this.conversationId)
      .then(() => {
        this.isConnected.set(true);
        this.isConnecting.set(false);
        this.cdr.markForCheck();
        console.log('✓ WebSocket connected');
      })
      .catch(error => {
        console.error('Failed to connect WebSocket:', error);
        this.error.set('Error conectando a WebSocket');
        this.isConnecting.set(false);
        this.cdr.markForCheck();
      });
  }

  /**
   * Setup WebSocket listeners
   */
  private setupWebSocketListeners(): void {
    // Listen to chat messages
    this.webSocketService.getChatMessages$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => {
        this.handleNewMessage(message);
      });

    // Listen to typing indicators
    this.webSocketService.getTypingIndicators$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(typing => {
        this.handleTypingIndicator(typing);
      });

    // Listen to errors
    this.webSocketService.getErrors$()
      .pipe(
        filter(err => err.connection === 'chat'),
        takeUntil(this.destroy$)
      )
      .subscribe(err => {
        console.error('WebSocket error:', err.error);
        this.error.set('Error de conexión');
        this.cdr.markForCheck();
      });
  }

  /**
   * Handle new message
   */
  private handleNewMessage(wsMessage: WebSocketChatMessage): void {
    const newMessage: ChatMessage = {
      id: wsMessage.messageId,
      conversationId: this.conversationId || 0,
      senderId: wsMessage.senderId,
      messageContent: wsMessage.content,
      isRead: false,
      createdAt: new Date(wsMessage.timestamp),
      updatedAt: new Date(wsMessage.timestamp),
      sender: {
        id: wsMessage.senderId,
        firstName: wsMessage.senderName.split(' ')[0],
        lastName: wsMessage.senderName.split(' ')[1] || '',
        email: ''
      }
    };

    // Add to messages
    this.messages.update(msgs => [...msgs, newMessage]);
    this.cdr.markForCheck();

    // Scroll to bottom
    setTimeout(() => this.scrollToBottom());

    // Mark as read if from other user
    if (wsMessage.senderId !== this.currentUserId) {
      setTimeout(() => {
        this.webSocketService.markMessageAsRead(wsMessage.messageId);
      }, 500);
    }

    // Remove typing indicator
    this.typingUsers.update(users => {
      users.delete(wsMessage.senderId);
      return new Set(users);
    });
  }

  /**
   * Handle typing indicator
   */
  private handleTypingIndicator(typing: WebSocketTypingIndicator): void {
    if (typing.isTyping && typing.userId !== this.currentUserId) {
      this.typingUsers.update(users => {
        users.add(typing.userId);
        return new Set(users);
      });
    } else {
      this.typingUsers.update(users => {
        users.delete(typing.userId);
        return new Set(users);
      });
    }
    this.cdr.markForCheck();
  }

  /**
   * Send message — optimistic update: message appears instantly,
   * confirmed/replaced once server responds.
   */
  sendMessage(): void {
    if (!this.messageForm.valid || this.isSending() || !this.conversationId || !this.currentUserId) {
      return;
    }

    const content = (this.messageForm.get('content')?.value ?? '').trim();
    if (!content) return;

    // ── Optimistic update: show message immediately ───────────────
    const tempId = -(Date.now());
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversationId: this.conversationId,
      senderId: this.currentUserId,
      messageContent: content,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      sender: undefined
    };
    this.messages.update(msgs => [...msgs, optimisticMsg]);
    this.messageForm.reset();
    this.isTypingLocal = false;
    this.isSending.set(true);
    this.cdr.markForCheck();
    setTimeout(() => this.scrollToBottom());

    // ── HTTP send ─────────────────────────────────────────────────
    this.chatService.sendMessage(this.conversationId, { content }).subscribe({
      next: (sentMsg) => {
        // Replace optimistic msg with confirmed server message
        this.messages.update(msgs =>
          msgs.map(m => m.id === tempId ? { ...sentMsg } : m)
        );
        this.isSending.set(false);
        this.cdr.markForCheck();
        setTimeout(() => this.scrollToBottom());
      },
      error: (err) => {
        console.error('❌ Error sending message:', err);
        // Remove optimistic msg and restore input so user can retry
        this.messages.update(msgs => msgs.filter(m => m.id !== tempId));
        this.messageForm.patchValue({ content });
        this.error.set('Error al enviar mensaje. Intenta de nuevo.');
        this.isSending.set(false);
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Handle typing
   */
  onMessageInput(event: any): void {
    const content = event.target.value;

    // Send typing indicator on start
    if (!this.isTypingLocal && content.length > 0) {
      this.isTypingLocal = true;
      const userName = this.displayName();
      this.webSocketService.sendTypingIndicator(userName, true);
    }

    // Clear previous timer
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }

    // Send not typing after delay
    this.typingTimer = setTimeout(() => {
      if (this.isTypingLocal) {
        this.isTypingLocal = false;
        const userName = this.displayName();
        this.webSocketService.sendTypingIndicator(userName, false);
      }
    }, 3000);
  }

  /**
   * Go back
   */
  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    this.router.navigate(['/provider/tabs/inbox']);
  }

  /**
   * Scroll to bottom
   */
  private scrollToBottom(): void {
    if (this.messagesContainer) {
      try {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      } catch (err) {
        console.error('Error scrolling:', err);
      }
    }
  }

  /**
   * Track messages by ID
   */
  trackByMessageId(index: number, message: ChatMessage): number {
    return message.id;
  }

  /**
   * Get message sender name
   */
  getSenderName(message: ChatMessage): string {
    if (message.sender) {
      return `${message.sender.firstName} ${message.sender.lastName}`;
    }
    return message.senderId === this.currentUserId ? 'Tú' : 'Usuario';
  }

  /**
   * Is message from current user
   */
  isMessageFromUser(message: ChatMessage): boolean {
    return message.senderId === this.currentUserId;
  }

  /**
   * Cleanup
   */
  ngOnDestroy(): void {
    this.webSocketService.disconnectFromChat();
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }
}

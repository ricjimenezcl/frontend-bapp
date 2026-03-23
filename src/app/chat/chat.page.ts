import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatService } from '../core/services/chat.service';
import { ChatMessage } from '../core/models/chat.model';
import { WebSocketService } from '../core/services/websocket.service';
import { takeUntil, filter } from 'rxjs/operators';
import { Subject, forkJoin } from 'rxjs';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class ChatPage implements OnInit, OnDestroy {
  conversationId: number | null = null;
  messages: ChatMessage[] = [];
  loading = false;
  newMessage = '';
  conversationName = 'Chat';
  private currentUserId: number | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chatService: ChatService,
    private webSocketService: WebSocketService,
    private location: Location
  ) {
    // Obtener el usuario actual al inicializar
    this.chatService.getCurrentUser().subscribe(user => {
      this.currentUserId = user?.id ? Number(user.id) : null;
      console.log('🔑 Current user ID:', this.currentUserId, 'User:', user);
    });
  }

  ngOnInit() {
    // Get conversationId from route parameter
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.conversationId = Number(params['id']);
        this.loadConversation();
        this.setupRealtimeForConversation();
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupRealtimeForConversation() {
    // Subscribe to WebSocket messages for this conversation (realtime updates)
    this.webSocketService.getChatMessages$()
      .pipe(
        filter((msg: any) => this.conversationId !== null && msg.conversationId === this.conversationId),
        takeUntil(this.destroy$)
      )
      .subscribe(msg => {
        // Map incoming WS message to ChatMessage and append
        const newMsg: ChatMessage = {
          id: msg.messageId,
          conversationId: this.conversationId || 0,
          senderId: msg.senderId,
          messageContent: msg.content,
          isRead: false,
          createdAt: new Date(msg.timestamp),
          updatedAt: new Date(msg.timestamp),
          sender: undefined
        };

        this.messages = [...this.messages, newMsg];
        // No llamar markAllMessagesAsRead() aquí — se ejecuta una sola vez en loadMessages()
        // Llamarlo en cada mensaje entrante generaba N llamadas HTTP redundantes
      });
  }

  loadConversation(silent = false) {
    if (!this.conversationId) return;

    if (!silent) {
      this.loading = true;
    }

    // Optimización: cargar conversación y mensajes en paralelo
    forkJoin({
      conversation: this.chatService.getConversation(this.conversationId, { setActive: true }),
      messages: this.chatService.getMessages(this.conversationId)
    }).subscribe({
      next: ({ conversation, messages }) => {
        const cachedConv = this.chatService.getCachedConversations().find(c => c.id === this.conversationId);

        // Strategy 1: Use cached display name if available (usually has the correct "Other" name)
        if (cachedConv && cachedConv.displayName) {
          this.conversationName = cachedConv.displayName;
        } else {
          // Strategy 2: Determine context from URL (Strongest signal)
          const isClientContext = this.router.url.includes('/client/');
          const isProviderContext = this.router.url.includes('/provider/');

          if (isClientContext) {
            // If I am in client view, I want to see the Provider
            this.conversationName = conversation.provider?.displayName || conversation.provider?.email || 'Proveedor';
          } else if (isProviderContext) {
            // If I am in provider view, I want to see the Client
            this.conversationName = conversation.client?.displayName || conversation.client?.email || 'Cliente';
          } else {
            // Strategy 3: Fallback to ID comparison
            const myId = Number(this.currentUserId);
            const clientId = Number(conversation.clientId);

            if (myId === clientId) {
              this.conversationName = conversation.provider?.displayName || conversation.provider?.email || 'Proveedor';
            } else {
              this.conversationName = conversation.client?.displayName || conversation.client?.email || 'Cliente';
            }
          }
        }

        // Procesar mensajes
        console.log('Mensajes cargados:', messages.length);
        this.messages = messages;
        this.loading = false;

        // Marcar todos como leídos en un solo paso
        this.markUnreadMessages();
      },
      error: (error) => {
        console.error('Error loading conversation:', error);
        this.loading = false;
      }
    });
  }

  private markUnreadMessages() {
    if (!this.conversationId) return;
    // Marcar todos los mensajes de la conversación como leídos para este usuario
    this.chatService.markAllMessagesAsRead(this.conversationId).subscribe();
  }

  isMyMessage(message: ChatMessage): boolean {
    // Comparar con el usuario actual almacenado
    const isMine = this.currentUserId !== null && message.senderId === this.currentUserId;
    console.log('💬 Message check:', {
      messageId: message.id,
      senderId: message.senderId,
      currentUserId: this.currentUserId,
      isMine
    });
    return isMine;
  }

  sendMessage() {
    if (!this.conversationId || !this.newMessage.trim()) return;

    const messageContent = this.newMessage.trim();
    this.newMessage = ''; // Limpiar inmediatamente

    this.chatService.sendMessage(this.conversationId, {
      content: messageContent
    }).subscribe({
      next: (newMsg) => {
        // Agregar el mensaje nuevo a la lista
        this.messages = [...this.messages, newMsg];
      },
      error: (error) => {
        console.error('Error sending message:', error);
        // Restaurar el mensaje si falló
        this.newMessage = messageContent;
      }
    });
  }

  goBack() {
    this.location.back();
  }
}

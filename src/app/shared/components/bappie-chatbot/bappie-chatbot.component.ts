import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Message {
  text: string;
  type: 'msg-bot' | 'msg-user';
}

@Component({
  selector: 'app-bappie-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './bappie-chatbot.component.html',
  styleUrls: ['./bappie-chatbot.component.scss'],
})
export class BappieChatbotComponent implements OnInit {
  private http = inject(HttpClient);
  @ViewChild('chatBody') chatBody!: ElementRef;

  isOpen       = signal(false);
  isProcessing = signal(false);
  isTyping     = signal(false);
  isGreeting   = signal(false);
  showTooltip  = signal(true);
  hasGreeted   = false;
  userInput    = '';

  messages = signal<Message[]>([
    {
      text: '¡Hola! Soy <strong>Bappie IA</strong>. Estoy aquí para ayudarte a encontrar el servicio que buscas o resolver tus dudas.',
      type: 'msg-bot',
    },
  ]);

  suggestions = ['¿Qué servicios hay?', '¿Cómo agendar?', '¿Tiene costo?'];

  ngOnInit() {}

  toggleChat() {
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      this.hasGreeted = true;
      this.showTooltip.set(false);
      this.scrollToBottom();
      if (!this.isGreeting()) {
        this.isGreeting.set(true);
        setTimeout(() => this.isGreeting.set(false), 2000);
      }
    } else {
      this.showTooltip.set(true);
    }
  }

  handleUserInput() {
    const text = this.userInput.trim();
    if (!text || this.isProcessing()) return;

    this.messages.update(m => [...m, { text, type: 'msg-user' }]);
    const history = this.messages().map(m => ({
      role: m.type === 'msg-user' ? 'user' : 'assistant',
      content: m.text,
    }));

    this.userInput = '';
    this.isProcessing.set(true);
    this.isTyping.set(true);
    this.scrollToBottom();

    this.http
      .post<{ response: string }>(`${environment.apiUrl}/assistant/chat`, {
        message: text,
        history: history.slice(-6),
      })
      .subscribe({
        next: (res) => {
          this.isTyping.set(false);
          this.isProcessing.set(false);
          this.messages.update(m => [...m, { text: res.response, type: 'msg-bot' }]);
          this.scrollToBottom();
        },
        error: () => {
          this.isTyping.set(false);
          this.isProcessing.set(false);
          this.messages.update(m => [
            ...m,
            { text: 'Lo siento, tuve un problema de conexión. ¿Podrías intentar de nuevo?', type: 'msg-bot' },
          ]);
          this.scrollToBottom();
        },
      });
  }

  useSuggestion(suggestion: string) {
    this.userInput  = suggestion;
    this.suggestions = this.suggestions.filter(s => s !== suggestion);
    this.handleUserInput();
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.chatBody?.nativeElement) {
        this.chatBody.nativeElement.scrollTop =
          this.chatBody.nativeElement.scrollHeight;
      }
    }, 60);
  }
}

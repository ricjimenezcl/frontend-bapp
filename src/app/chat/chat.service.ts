import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private apiUrl = environment.apiUrl;
  private http = inject(HttpClient);

  startConversation(otherUserId: number): Observable<{ conversation_id: string; id: string }> {
    return this.http.post<{ conversation_id: string; id: string }>(`${this.apiUrl}/conversations/start`, { other_user_id: otherUserId });
  }

  listConversations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/conversations`);
  }

  listMessages(conversationId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/conversations/${conversationId}/messages`);
  }

  sendMessage(conversationId: string, content: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/conversations/${conversationId}/messages/send`, { content });
  }
}

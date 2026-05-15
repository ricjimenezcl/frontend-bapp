# 🗺️ ROADMAP DETALLADO DE IMPLEMENTACIÓN

**Proyecto:** Sincronización BAPP WEB ↔ MOBILE  
**Fecha:** 15 de mayo de 2026  
**Duración Total Estimada:** 2.5 semanas (11.5 días laborables)

---

## 📊 ESTRATEGIA DE IMPLEMENTACIÓN

### Principios Guía
1. **Prioridad por Impacto:** Features críticas primero
2. **Desarrollo Incremental:** Commits pequeños y frecuentes
3. **Testing Continuo:** Validar cada cambio con `ng build` y pruebas manuales
4. **Sin modificar Backend:** Adaptar frontend a APIs existentes
5. **Sin modificar Auth:** Mantener login actual (excluir completamente)

### Ramas de Trabajo
```
main
 └── feature/sync-web-mobile
      ├── fix/chat-endpoints
      ├── feature/review-service
      ├── feature/geolocation
      ├── feature/websocket
      ├── feature/oauth
      └── feature/notifications-page
```

---

## 🚀 SPRINT 1: FIXES CRÍTICOS (4.5 días)

**Objetivo:** Resolver incompatibilidades que rompen funcionalidad core

### Task 1.1: Fix Chat Endpoints ⚠️ CRÍTICO
**Prioridad:** 🔴 MÁXIMA  
**Duración:** 4 horas  
**Archivos:**
- `src/app/core/services/chat.service.ts`

**Cambios:**
```typescript
// ❌ ANTES
private apiUrl = `${environment.apiUrl}/conversations`;

startConversation(providerId: number) {
  return this.http.post(`${this.apiUrl}/start`, { provider_id: providerId });
}

// ✅ DESPUÉS
private apiUrl = `${environment.apiUrl}/chat/conversations`;

startConversation(providerId: number) {
  return this.http.post(`${this.apiUrl}/${providerId}`, {});
}
```

**Métodos a actualizar:**
- `startConversation()` → POST `/chat/conversations/{providerId}`
- `getConversations()` → GET `/chat/conversations`
- `getMessages()` → GET `/chat/conversations/{id}/messages`
- `sendMessage()` → POST `/chat/conversations/{id}/messages`
- **AGREGAR:** `markAllRead()` → POST `/chat/conversations/{id}/read-all`

**Validación:**
1. Probar crear conversación
2. Enviar mensaje
3. Recibir mensajes
4. Marcar como leído
5. Verificar con DevTools que URLs son correctas

**Commit:** `fix: align chat service endpoints with web project`

---

### Task 1.2: Crear user.model.ts
**Prioridad:** 🔴 ALTA  
**Duración:** 2 horas  
**Archivos:**
- `src/app/core/models/user.model.ts` (CREAR)

**Contenido:**
```typescript
export type UserRole = 'CLIENT' | 'PROVIDER' | 'ADMIN';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  status: UserStatus;
  access_token?: string;
  user_id?: number;
  provider_id?: number;
  client_id?: number;
  name?: string;
  picture?: string;
  verified?: boolean;
  terms_accepted?: boolean;
  has_premium?: boolean;
}

export interface UserProfile {
  id: number;
  user_id: number;
  full_name: string;
  has_premium?: boolean;
  phone?: string;
  avatar?: string | null;
  bio?: string;
  rating_avg?: number;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
  run?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StoredUser {
  id: number;
  email: string;
  role: UserRole;
  status: UserStatus;
  provider_id?: number;
  client_id?: number;
  has_premium?: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  role: UserRole;
  status: UserStatus;
  provider_id?: number;
  client_id?: number;
}

export interface ClientRegister {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  terms_accepted: boolean;
}

export interface ProviderRegister {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  terms_accepted: boolean;
  run?: string;
}
```

**Imports a actualizar:**
- `auth.service.ts` → Reemplazar interfaces inlined por imports
- Cualquier componente que use tipos de usuario

**Validación:**
- `ng build` debe pasar sin errores
- Auth flow debe seguir funcionando

**Commit:** `feat: add user.model.ts from web project`

---

### Task 1.3: Sincronizar booking.model enum
**Prioridad:** 🟡 MEDIA  
**Duración:** 2 horas  
**Archivos:**
- `src/app/core/models/booking.model.ts`

**Decisión:** ¿Uppercase o lowercase?
1. **Verificar backend primero:** Hacer `console.log()` de una respuesta de booking
2. Si backend retorna uppercase → cambiar mobile a uppercase
3. Si backend retorna lowercase → cambiar web a lowercase (pero esto está fuera de scope)

**Opción A - Backend usa uppercase:**
```typescript
// Cambiar de:
export enum BookingStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    // ...
}

// A:
export enum BookingStatus {
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
    NOSHOW = 'NOSHOW'
}

// Agregar labels y colors como en WEB:
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING:     'Pendiente',
  CONFIRMED:   'Confirmado',
  IN_PROGRESS: 'En progreso',
  COMPLETED:   'Completado',
  CANCELLED:   'Cancelado',
  NOSHOW:      'No presentado',
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  PENDING:     'warning',
  CONFIRMED:   'primary',
  IN_PROGRESS: 'primary',
  COMPLETED:   'success',
  CANCELLED:   'danger',
  NOSHOW:      'medium',
};
```

**Agregar campos faltantes en BookingResponse:**
```typescript
export interface BookingResponse {
  // ... campos existentes
  service_provider_id?: number;
  cancellation_reason?: string;
  payment_method?: string;
  currency?: string;
  completed_at?: string;
  provider?: { full_name: string; avatar?: string };
  client?: { full_name: string; avatar?: string };
}
```

**Validación:**
- Buscar todos los archivos que usan BookingStatus
- Actualizar comparaciones: `status === 'pending'` → `status === BookingStatus.PENDING`
- Probar flujo de reservas

**Commit:** `feat: sync booking.model with web project (uppercase enum)`

---

### Task 1.4: Implementar Review Service
**Prioridad:** 🔴 ALTA  
**Duración:** 1 día  
**Archivos:**
- `src/app/core/services/review.service.ts` (CREAR)

**Código completo:**
```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Review, CreateReviewRequest } from '../models/review.model';

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/reviews`;

  /**
   * Crear una nueva reseña para un proveedor
   */
  createReview(review: CreateReviewRequest): Observable<Review> {
    return this.http.post<Review>(this.apiUrl, review);
  }

  /**
   * Obtener todas las reseñas de un proveedor
   */
  getProviderReviews(providerId: number): Observable<Review[]> {
    return this.http.get<Review[]>(`${this.apiUrl}/providers/${providerId}/reviews`);
  }
}
```

**Integración con UI:**

**Opción A - Usar review-modal existente:**
Si ya existe `src/app/shared/components/review-modal/`, actualizar para usar el servicio:

```typescript
// review-modal.component.ts
import { ReviewService } from '../../../core/services/review.service';

export class ReviewModalComponent {
  private reviewService = inject(ReviewService);
  
  submitReview() {
    const request: CreateReviewRequest = {
      booking_id: this.bookingId,
      rating: this.rating,
      comment: this.comment
    };
    
    this.reviewService.createReview(request).subscribe({
      next: (review) => {
        // Mostrar toast éxito
        this.modalCtrl.dismiss(review);
      },
      error: (err) => {
        // Mostrar error
      }
    });
  }
}
```

**Opción B - Crear desde cero:**
Si no existe, crear modal básico con:
- Input de rating (1-5 estrellas)
- Textarea para comentario
- Botón enviar
- Manejo de errores

**Mostrar reseñas en provider-info:**
```typescript
// provider-info.page.ts
reviews$ = this.reviewService.getProviderReviews(this.providerId);
```

```html
<!-- provider-info.page.html -->
<ion-list *ngIf="reviews$ | async as reviews">
  <ion-item *ngFor="let review of reviews">
    <ion-label>
      <h3>{{ review.client?.full_name || 'Cliente' }}</h3>
      <p>{{ review.comment }}</p>
      <ion-note>
        ⭐ {{ review.rating }} / 5
      </ion-note>
    </ion-label>
  </ion-item>
</ion-list>
```

**Validación:**
1. Completar una reserva
2. Abrir modal de review
3. Crear review con 4 estrellas y comentario
4. Verificar que aparece en perfil del proveedor
5. Verificar en DevTools que el POST funcionó

**Commit:** `feat: add review service and integrate with UI`

---

### Task 1.5: Implementar Geolocation Services
**Prioridad:** 🔴 ALTA  
**Duración:** 2 días  
**Archivos:**
- `src/app/core/services/geoapify.service.ts` (CREAR)
- `src/app/core/services/location.service.ts` (CREAR)
- `src/app/client/pages/service-search/service-search.page.ts` (MODIFICAR)

**Paso 1: Crear geoapify.service.ts**
```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface GeoapifyResult {
  formatted: string;
  lat: number;
  lon: number;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface GeoapifyResponse {
  results: GeoapifyResult[];
}

@Injectable({
  providedIn: 'root'
})
export class GeoapifyService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/providers/geocoding`;

  /**
   * Autocompletar direcciones
   */
  searchAddress(query: string, country = 'cl'): Observable<GeoapifyResult[]> {
    if (!query || query.length < 3) {
      return of([]);
    }

    return this.http.get<GeoapifyResponse>(`${this.apiUrl}/search`, {
      params: { q: query, country }
    }).pipe(
      map(response => response.results || []),
      catchError(() => of([]))
    );
  }

  /**
   * Reverse geocoding - obtener dirección desde coordenadas
   */
  reverseGeocode(lat: number, lon: number): Observable<GeoapifyResult | null> {
    return this.http.get<GeoapifyResponse>(`${this.apiUrl}/reverse`, {
      params: { lat: lat.toString(), lon: lon.toString() }
    }).pipe(
      map(response => response.results?.[0] || null),
      catchError(() => of(null))
    );
  }
}
```

**Paso 2: Crear location.service.ts**
```typescript
import { Injectable, inject, signal } from '@angular/core';
import { GeoapifyService, GeoapifyResult } from './geoapify.service';
import { Observable } from 'rxjs';

export interface UserLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private geoapifyService = inject(GeoapifyService);
  
  // Estado global de ubicación
  userLocation = signal<UserLocation | null>(null);
  isLoading = signal(false);

  /**
   * Buscar direcciones (debounced en componente)
   */
  searchAddresses(query: string): Observable<GeoapifyResult[]> {
    return this.geoapifyService.searchAddress(query);
  }

  /**
   * Obtener dirección desde coordenadas
   */
  getAddressFromCoordinates(lat: number, lon: number): Observable<GeoapifyResult | null> {
    return this.geoapifyService.reverseGeocode(lat, lon);
  }

  /**
   * Guardar ubicación del usuario
   */
  setUserLocation(location: UserLocation): void {
    this.userLocation.set(location);
    localStorage.setItem('user_location', JSON.stringify(location));
  }

  /**
   * Cargar ubicación guardada
   */
  loadSavedLocation(): void {
    const saved = localStorage.getItem('user_location');
    if (saved) {
      this.userLocation.set(JSON.parse(saved));
    }
  }

  /**
   * Limpiar ubicación
   */
  clearLocation(): void {
    this.userLocation.set(null);
    localStorage.removeItem('user_location');
  }
}
```

**Paso 3: Integrar en service-search**
```typescript
// service-search.page.ts
import { LocationService } from '../../../core/services/location.service';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Subject } from 'rxjs';

export class ServiceSearchPage {
  private locationService = inject(LocationService);
  
  searchQuery = new FormControl('');
  addressSuggestions: GeoapifyResult[] = [];
  
  private searchSubject = new Subject<string>();

  ngOnInit() {
    // Debounce de búsqueda de direcciones
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => this.locationService.searchAddresses(query))
    ).subscribe(results => {
      this.addressSuggestions = results;
    });
  }

  onSearchInput(event: any) {
    const query = event.target.value;
    this.searchSubject.next(query);
  }

  selectAddress(result: GeoapifyResult) {
    this.locationService.setUserLocation({
      latitude: result.lat,
      longitude: result.lon,
      address: result.formatted
    });
    
    // Recargar proveedores cercanos con nueva ubicación
    this.loadNearbyProviders();
    
    // Limpiar sugerencias
    this.addressSuggestions = [];
  }
}
```

```html
<!-- service-search.page.html -->
<ion-searchbar
  [(ngModel)]="searchQuery"
  (ionInput)="onSearchInput($event)"
  placeholder="Buscar dirección...">
</ion-searchbar>

<ion-list *ngIf="addressSuggestions.length > 0">
  <ion-item 
    *ngFor="let result of addressSuggestions" 
    (click)="selectAddress(result)"
    button>
    <ion-label>
      <h3>{{ result.formatted }}</h3>
      <p>{{ result.address_line2 }}</p>
    </ion-label>
  </ion-item>
</ion-list>
```

**Validación:**
1. Ir a búsqueda
2. Escribir "Santiago, Chile"
3. Ver sugerencias aparecer
4. Seleccionar una
5. Verificar que se carga la ubicación
6. Verificar llamadas HTTP en DevTools

**Commit:** `feat: add geolocation services with autocomplete`

---

## 🚀 SPRINT 2: FEATURES IMPORTANTES (7 días)

### Task 2.1: Implementar WebSocket Service
**Prioridad:** 🔴 ALTA  
**Duración:** 3 días  
**Archivos:**
- `src/app/core/services/websocket.service.ts` (CREAR/REEMPLAZAR)
- `src/app/core/services/chat.service.ts` (MODIFICAR)
- `src/app/core/services/notification.service.ts` (MODIFICAR)

**Paso 1: Crear websocket.service.ts unificado**
```typescript
import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface WsMessage {
  channel: 'chat' | 'notification';
  type: string;
  conversation_id?: number;
  data?: any;
}

export interface WsChatMessage {
  type: 'message';
  channel: 'chat';
  conversation_id: number;
  message: any;
}

export interface WsTypingIndicator {
  type: 'typing';
  channel: 'chat';
  conversation_id: number;
  user_id: number;
  is_typing: boolean;
}

export interface WsNotification {
  type: 'notification';
  channel: 'notification';
  notification_id: number;
  notification_type: string;
  title: string;
  content: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private ws: WebSocket | null = null;
  private messageSubject = new Subject<WsMessage>();
  
  isConnected = signal(false);
  reconnectAttempts = signal(0);
  
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 3000;

  /**
   * Conectar al WebSocket unificado
   */
  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      return;
    }

    const wsUrl = `${environment.wsUrl}?token=${token}`;
    console.log('[WS] Connecting to:', wsUrl);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.isConnected.set(true);
      this.reconnectAttempts.set(0);
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data);
        console.log('[WS] Message received:', message);
        this.messageSubject.next(message);
      } catch (error) {
        console.error('[WS] Failed to parse message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WS] Error:', error);
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      this.isConnected.set(false);
      this.attemptReconnect(token);
    };
  }

  /**
   * Reconectar automáticamente
   */
  private attemptReconnect(token: string): void {
    const attempts = this.reconnectAttempts();
    if (attempts < this.MAX_RECONNECT_ATTEMPTS) {
      console.log(`[WS] Reconnecting... (attempt ${attempts + 1})`);
      this.reconnectAttempts.set(attempts + 1);
      
      setTimeout(() => {
        this.connect(token);
      }, this.RECONNECT_DELAY);
    } else {
      console.error('[WS] Max reconnect attempts reached');
    }
  }

  /**
   * Desconectar
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected.set(false);
  }

  /**
   * Enviar mensaje
   */
  send(message: WsMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[WS] Cannot send message: not connected');
    }
  }

  /**
   * Escuchar mensajes de chat
   */
  onChatMessage(): Observable<WsChatMessage> {
    return this.messageSubject.pipe(
      filter(msg => msg.channel === 'chat' && msg.type === 'message'),
      map(msg => msg as WsChatMessage)
    );
  }

  /**
   * Escuchar indicadores de escritura
   */
  onTyping(): Observable<WsTypingIndicator> {
    return this.messageSubject.pipe(
      filter(msg => msg.channel === 'chat' && msg.type === 'typing'),
      map(msg => msg as WsTypingIndicator)
    );
  }

  /**
   * Escuchar notificaciones
   */
  onNotification(): Observable<WsNotification> {
    return this.messageSubject.pipe(
      filter(msg => msg.channel === 'notification'),
      map(msg => msg as WsNotification)
    );
  }

  /**
   * Unirse a canal de chat
   */
  joinChat(conversationId: number): void {
    this.send({
      channel: 'chat',
      type: 'join',
      conversation_id: conversationId
    });
  }

  /**
   * Enviar mensaje de chat
   */
  sendChatMessage(conversationId: number, content: string): void {
    this.send({
      channel: 'chat',
      type: 'message',
      conversation_id: conversationId,
      data: { content }
    });
  }

  /**
   * Enviar indicador de escritura
   */
  sendTyping(conversationId: number, isTyping: boolean): void {
    this.send({
      channel: 'chat',
      type: 'typing',
      conversation_id: conversationId,
      data: { is_typing: isTyping }
    });
  }
}
```

**Paso 2: Integrar con auth.service.ts**
```typescript
// auth.service.ts
import { WebSocketService } from '../../core/services/websocket.service';

export class AuthService {
  private wsService = inject(WebSocketService);

  login(username: string, password: string) {
    return this.http.post<TokenResponse>('/auth/login', { username, password }).pipe(
      tap(response => {
        this.saveToken(response.access_token);
        // ✅ CONECTAR WEBSOCKET tras login
        this.wsService.connect(response.access_token);
      })
    );
  }

  logout() {
    // ✅ DESCONECTAR WEBSOCKET
    this.wsService.disconnect();
    this.clearToken();
  }
}
```

**Paso 3: Usar en chat.page.ts**
```typescript
// chat.page.ts (componente de conversación individual)
export class ChatPage implements OnInit, OnDestroy {
  private wsService = inject(WebSocketService);
  
  ngOnInit() {
    // Unirse al canal
    this.wsService.joinChat(this.conversationId);
    
    // Escuchar mensajes en tiempo real
    this.wsService.onChatMessage()
      .pipe(
        filter(msg => msg.conversation_id === this.conversationId)
      )
      .subscribe(msg => {
        this.messages.push(msg.message);
      });
    
    // Escuchar typing
    this.wsService.onTyping()
      .pipe(
        filter(msg => msg.conversation_id === this.conversationId)
      )
      .subscribe(msg => {
        this.otherUserTyping = msg.is_typing;
      });
  }

  onTyping() {
    this.wsService.sendTyping(this.conversationId, true);
    
    // Auto-stop typing después de 3s
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.wsService.sendTyping(this.conversationId, false);
    }, 3000);
  }

  sendMessage() {
    const content = this.messageInput;
    
    // Enviar por WebSocket (real-time)
    this.wsService.sendChatMessage(this.conversationId, content);
    
    // También por HTTP (persistencia)
    this.chatService.sendMessage(this.conversationId, content).subscribe();
    
    this.messageInput = '';
  }
}
```

**Validación:**
1. Login
2. Verificar que WebSocket conecta (console.log)
3. Abrir chat
4. Enviar mensaje
5. Verificar que aparece instantáneamente
6. Desde otro dispositivo/usuario enviar mensaje
7. Verificar que se recibe en tiempo real

**Commit:** `feat: implement unified websocket service for real-time chat and notifications`

---

### Task 2.2: Implementar OAuth Social Login
**Prioridad:** 🟡 MEDIA  
**Duración:** 2 días  
**Archivos:**
- `src/app/auth/services/auth.service.ts`
- `src/app/auth/pages/login/login.page.ts`
- `src/app/auth/pages/login/login.page.html`
- `src/app/app.config.ts` (configuración)

**NOTA:** Esta tarea es opcional según restricción "NO modificar login". Si se decide implementar:

**Paso 1: Configurar Google/Facebook**
```typescript
// app.config.ts
import { SocialAuthServiceConfig, GoogleLoginProvider, FacebookLoginProvider } from '@abacritt/angularx-social-login';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... otros providers
    {
      provide: 'SocialAuthServiceConfig',
      useValue: {
        autoLogin: false,
        providers: [
          {
            id: GoogleLoginProvider.PROVIDER_ID,
            provider: new GoogleLoginProvider('YOUR_GOOGLE_CLIENT_ID')
          },
          {
            id: FacebookLoginProvider.PROVIDER_ID,
            provider: new FacebookLoginProvider('YOUR_FACEBOOK_APP_ID')
          }
        ]
      } as SocialAuthServiceConfig
    }
  ]
};
```

**Paso 2: Agregar métodos en auth.service.ts**
```typescript
import { SocialAuthService, SocialUser } from '@abacritt/angularx-social-login';

export class AuthService {
  private socialAuthService = inject(SocialAuthService);

  loginWithGoogle(idToken: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.apiUrl}/auth/google`, { id_token: idToken });
  }

  loginWithFacebook(accessToken: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.apiUrl}/auth/facebook`, { access_token: accessToken });
  }
}
```

**Paso 3: Botones en login.page.html**
```html
<ion-button expand="block" (click)="loginWithGoogle()">
  <ion-icon slot="start" name="logo-google"></ion-icon>
  Continuar con Google
</ion-button>

<ion-button expand="block" fill="outline" (click)="loginWithFacebook()">
  <ion-icon slot="start" name="logo-facebook"></ion-icon>
  Continuar con Facebook
</ion-button>
```

**Paso 4: Lógica en login.page.ts**
```typescript
import { SocialAuthService, GoogleLoginProvider, FacebookLoginProvider } from '@abacritt/angularx-social-login';

export class LoginPage {
  private socialAuthService = inject(SocialAuthService);
  private authService = inject(AuthService);

  async loginWithGoogle() {
    try {
      const user = await this.socialAuthService.signIn(GoogleLoginProvider.PROVIDER_ID);
      
      this.authService.loginWithGoogle(user.idToken).subscribe({
        next: (response) => {
          // Guardar token y redirigir
          this.router.navigate(['/client']);
        },
        error: (err) => {
          // Mostrar error
        }
      });
    } catch (error) {
      console.error('Google login failed', error);
    }
  }

  async loginWithFacebook() {
    try {
      const user = await this.socialAuthService.signIn(FacebookLoginProvider.PROVIDER_ID);
      
      this.authService.loginWithFacebook(user.authToken).subscribe({
        next: (response) => {
          this.router.navigate(['/client']);
        },
        error: (err) => {
          // Mostrar error
        }
      });
    } catch (error) {
      console.error('Facebook login failed', error);
    }
  }
}
```

**Validación:**
1. Click en botón Google
2. Popup de Google aparece
3. Seleccionar cuenta
4. Login exitoso y redirección
5. Repetir con Facebook

**Commit:** `feat: add OAuth social login (Google & Facebook)`

---

### Task 2.3: Booking Available Slots
**Prioridad:** 🟡 MEDIA  
**Duración:** 1 día  
**Archivos:**
- `src/app/client/services/client-booking.service.ts` (o donde esté)

**Agregar método:**
```typescript
getAvailableSlots(
  providerId: number,
  date: string,
  slotDuration: number = 60
): Observable<string[]> {
  return this.http.get<string[]>(`${this.apiUrl}/bookings/available-slots`, {
    params: {
      provider_id: providerId.toString(),
      date: date, // YYYY-MM-DD
      slot_duration: slotDuration.toString()
    }
  });
}
```

**Integrar en UI (booking create page):**
```typescript
export class CreateBookingPage {
  availableSlots: string[] = [];
  selectedDate = '';
  
  onDateChange(date: string) {
    this.selectedDate = date;
    this.loadAvailableSlots();
  }

  loadAvailableSlots() {
    this.bookingService.getAvailableSlots(
      this.providerId,
      this.selectedDate,
      this.serviceDuration
    ).subscribe(slots => {
      this.availableSlots = slots;
    });
  }
}
```

```html
<ion-datetime [(ngModel)]="selectedDate" (ionChange)="onDateChange($event)"></ion-datetime>

<ion-list>
  <ion-item *ngFor="let slot of availableSlots" (click)="selectSlot(slot)">
    <ion-label>{{ slot }}</ion-label>
  </ion-item>
</ion-list>
```

**Commit:** `feat: add available slots selection for bookings`

---

### Task 2.4: Profile Service Completo
**Prioridad:** 🟡 MEDIA  
**Duración:** 1 día  
**Archivos:**
- `src/app/core/services/profile.service.ts` (CREAR) o extender `client.service.ts`

**Crear profile.service.ts:**
```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/profile`;

  changePassword(oldPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/change-password`, {
      old_password: oldPassword,
      new_password: newPassword
    });
  }

  uploadAvatar(file: File): Observable<{ avatar_url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.http.post<{ avatar_url: string }>(
      `${this.apiUrl}/upload-avatar`,
      formData
    );
  }
}
```

**Integrar en settings page:**
```typescript
// settings.page.ts
changePassword() {
  this.profileService.changePassword(
    this.oldPassword,
    this.newPassword
  ).subscribe({
    next: () => {
      // Mostrar toast éxito
      this.showToast('Contraseña actualizada');
    },
    error: (err) => {
      this.showToast('Error al cambiar contraseña');
    }
  });
}

async selectAvatar() {
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: true,
    resultType: CameraResultType.Blob,
    source: CameraSource.Prompt
  });

  const blob = image.blob;
  const file = new File([blob!], 'avatar.jpg', { type: 'image/jpeg' });

  this.profileService.uploadAvatar(file).subscribe({
    next: (response) => {
      this.userAvatar = response.avatar_url;
      this.showToast('Foto actualizada');
    }
  });
}
```

**Commit:** `feat: add profile service with change password and upload avatar`

---

## 🚀 SPRINT 3: COMPLETITUD (3 días)

### Task 3.1: Session Expiry Management
**Prioridad:** 🟢 BAJA  
**Duración:** 4 horas  

```typescript
// session.service.ts
import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  isExpired = signal(false);

  markExpired(): void {
    this.isExpired.set(true);
  }

  reset(): void {
    this.isExpired.set(false);
  }
}
```

**Integrar en auth.interceptor:**
```typescript
// Si refresh token falla después de max intentos
if (this.refreshAttempts >= 5) {
  this.sessionService.markExpired();
  this.router.navigate(['/auth/login']);
}
```

**Commit:** `feat: add session expiry management`

---

### Task 3.2: Contact Limit Service
**Prioridad:** 🟢 BAJA  
**Duración:** 2 horas  

Ver código completo en la sección GAP #9 del informe principal.

**Commit:** `feat: add contact limit service (5 free contacts)`

---

### Task 3.3: Notifications Page
**Prioridad:** 🟡 MEDIA  
**Duración:** 1 día  

**Crear estructura:**
```
src/app/client/pages/client-notifications/
├── client-notifications.page.ts
├── client-notifications.page.html
├── client-notifications.page.scss
```

**Código:**
```typescript
// client-notifications.page.ts
import { Component, OnInit, inject } from '@angular/core';
import { NotificationService } from '../../../core/services/notification.service';
import { Notification } from '../../../core/models/notification.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-client-notifications',
  templateUrl: './client-notifications.page.html',
  styleUrls: ['./client-notifications.page.scss']
})
export class ClientNotificationsPage implements OnInit {
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  notifications: Notification[] = [];
  isLoading = false;

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.isLoading = true;
    this.notificationService.getNotifications().subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  markAsRead(notification: Notification) {
    if (notification.is_read) return;

    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => {
        notification.is_read = true;
        this.navigateToEntity(notification);
      }
    });
  }

  markAllAsRead() {
    // Implementar si backend soporta
  }

  navigateToEntity(notification: Notification) {
    switch (notification.related_entity_type) {
      case 'booking':
        this.router.navigate(['/client/bookings', notification.related_entity_id]);
        break;
      case 'chat':
        this.router.navigate(['/client/chats', notification.related_entity_id]);
        break;
      default:
        break;
    }
  }
}
```

```html
<!-- client-notifications.page.html -->
<ion-header>
  <ion-toolbar>
    <ion-buttons slot="start">
      <ion-back-button></ion-back-button>
    </ion-buttons>
    <ion-title>Notificaciones</ion-title>
  </ion-toolbar>
</ion-header>

<ion-content>
  <ion-refresher slot="fixed" (ionRefresh)="loadNotifications()">
    <ion-refresher-content></ion-refresher-content>
  </ion-refresher>

  <ion-list *ngIf="!isLoading">
    <ion-item 
      *ngFor="let notification of notifications"
      (click)="markAsRead(notification)"
      [class.unread]="!notification.is_read"
      button>
      <ion-label>
        <h2>{{ notification.title }}</h2>
        <p>{{ notification.content }}</p>
        <ion-note>{{ notification.created_at | date:'short' }}</ion-note>
      </ion-label>
      <ion-badge *ngIf="!notification.is_read" color="primary" slot="end">
        Nuevo
      </ion-badge>
    </ion-item>
  </ion-list>

  <app-empty-state
    *ngIf="!isLoading && notifications.length === 0"
    title="Sin notificaciones"
    message="No tienes notificaciones nuevas">
  </app-empty-state>

  <ion-spinner *ngIf="isLoading"></ion-spinner>
</ion-content>
```

**Agregar ruta:**
```typescript
// client-routing.module.ts
{
  path: 'notifications',
  loadComponent: () => import('./pages/client-notifications/client-notifications.page').then(m => m.ClientNotificationsPage)
}
```

**Commit:** `feat: add notifications page for client`

---

### Task 3.4: Testing E2E
**Prioridad:** 🟡 MEDIA  
**Duración:** 1 día  

**Flows críticos a probar:**
1. Login → Ver proveedores → Crear reserva
2. Chat → Enviar mensaje → Recibir respuesta
3. Completar reserva → Crear review
4. Buscar por ubicación → Seleccionar proveedor
5. OAuth login (si implementado)

**Tools:** Cypress, Playwright, o manual checklist

**Commit:** `test: add E2E tests for critical flows`

---

## 📦 RESUMEN DE ARCHIVOS

### Archivos a CREAR (nuevos)

```
✅ src/app/core/models/user.model.ts
✅ src/app/core/services/websocket.service.ts
✅ src/app/core/services/review.service.ts
✅ src/app/core/services/geoapify.service.ts
✅ src/app/core/services/location.service.ts
✅ src/app/core/services/session.service.ts
✅ src/app/core/services/contact-limit.service.ts
✅ src/app/core/services/profile.service.ts
✅ src/app/client/pages/client-notifications/
```

### Archivos a MODIFICAR (actualizar)

```
⚙️ src/app/core/services/chat.service.ts
⚙️ src/app/core/models/booking.model.ts
⚙️ src/app/core/models/provider.model.ts
⚙️ src/app/client/services/client-booking.service.ts
⚙️ src/app/auth/services/auth.service.ts
⚙️ src/app/auth/pages/login/login.page.ts (si OAuth)
⚙️ src/app/auth/pages/login/login.page.html (si OAuth)
⚙️ src/app/auth/interceptors/auth.interceptor.ts
⚙️ src/app/client/pages/service-search/service-search.page.ts
⚙️ src/app/client/pages/service-search/service-search.page.html
```

---

## ✅ CHECKLIST FINAL DE VALIDACIÓN

Antes de dar por completada la sincronización:

### Funcionalidad
- [ ] Chat en tiempo real funciona (WebSocket)
- [ ] Notificaciones push en tiempo real
- [ ] Reviews se pueden crear
- [ ] Reviews aparecen en perfil provider
- [ ] Búsqueda por ubicación funciona
- [ ] Autocompletar direcciones funciona
- [ ] Reverse geocoding funciona
- [ ] Horarios disponibles se muestran
- [ ] OAuth Google funciona (si implementado)
- [ ] OAuth Facebook funciona (si implementado)
- [ ] Cambiar contraseña funciona
- [ ] Subir avatar funciona
- [ ] Sesión expirada muestra modal
- [ ] Límite de 5 contactos funciona
- [ ] Página de notificaciones funciona

### Técnico
- [ ] Todos los endpoints coinciden con WEB
- [ ] Modelos TypeScript sincronizados
- [ ] `ng build` pasa sin errores
- [ ] `ng lint` pasa sin warnings críticos
- [ ] No hay console.errors en runtime
- [ ] WebSocket reconecta automáticamente
- [ ] Auth interceptor maneja refresh token
- [ ] Navegación funciona correctamente

### UX
- [ ] Loading states en todas las llamadas HTTP
- [ ] Error messages claros y útiles
- [ ] Feedback visual en acciones (toasts, modals)
- [ ] Navegación intuitiva
- [ ] Responsive en diferentes tamaños
- [ ] Dark theme funciona (según variables existentes)

---

## 🎯 MÉTRICAS DE PROGRESO

Actualizar después de cada sprint:

```
SPRINT 1 - CRÍTICOS
[ ] Task 1.1 - Fix Chat Endpoints
[ ] Task 1.2 - Crear user.model.ts
[ ] Task 1.3 - Sincronizar booking.model
[ ] Task 1.4 - Review Service
[ ] Task 1.5 - Geolocation Services

SPRINT 2 - IMPORTANTES
[ ] Task 2.1 - WebSocket Service
[ ] Task 2.2 - OAuth Social Login
[ ] Task 2.3 - Booking Slots
[ ] Task 2.4 - Profile Service

SPRINT 3 - COMPLETITUD
[ ] Task 3.1 - Session Expiry
[ ] Task 3.2 - Contact Limit
[ ] Task 3.3 - Notifications Page
[ ] Task 3.4 - Testing E2E
```

**Progreso Total:** 0 / 14 tareas (0%)

---

## 📞 SOPORTE

Para dudas o problemas durante la implementación:
- Consultar `/ANALISIS_SINCRONIZACION_WEB_MOBILE.md` para detalles técnicos
- Revisar código WEB como referencia: `/Users/rjimenezl/Documents/bapp/web-bapp/`
- Verificar endpoints con backend developer
- Probar cada feature en staging antes de production

---

**FIN DEL ROADMAP** 🚀

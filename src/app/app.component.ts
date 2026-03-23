// src/app/app.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Platform, IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { HttpClient } from '@angular/common/http';
import { SqliteService } from './core/storage/sqlite.service';
import { NotificationRealtimeService } from './core/services/notification-realtime.service';
import { AuthService } from './auth/services/auth.service';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  template: '<ion-app><ion-router-outlet></ion-router-outlet></ion-app>',
  standalone: true,
  imports: [IonApp, IonRouterOutlet]
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private authCheckInterval: any;

  private keepAliveInterval: any;

  constructor(
    private platform: Platform,
    private http: HttpClient,
    private sqliteService: SqliteService,
    private notificationService: NotificationRealtimeService,
    private authService: AuthService
  ) {
    this.initializeApp();
  }

  async ngOnInit() {
    // Initialize WebSocket notification service when user is authenticated
    this.authService.getCurrentUserObservable().pipe(takeUntil(this.destroy$)).subscribe(user => {
      const isAuth = !!user;
      if (isAuth) {
        if (!this.notificationService.isConnected()) {
          console.log('✓ User authenticated, connecting to notification WebSocket');
          this.notificationService.connect();
        }
        this.startKeepAlive();
      } else {
        if (this.notificationService.isConnected()) {
          console.log('✓ User not authenticated, disconnecting notification WebSocket');
          this.notificationService.disconnect();
        }
        this.stopKeepAlive();
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.authCheckInterval) {
      clearInterval(this.authCheckInterval);
    }
    this.stopKeepAlive();
    this.notificationService.disconnect();
  }

  private startKeepAlive() {
    if (this.keepAliveInterval) return; // ya activo
    this.keepAliveInterval = setInterval(() => {
      this.http.get(`${environment.apiUrl}/health`, {
        headers: { 'X-Keep-Alive': 'true' }
      }).subscribe({ error: () => {} });
    }, 14 * 60 * 1000); // cada 14 minutos
  }

  private stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  private async initializeApp() {
    await this.platform.ready();
    
    try {
      await this.sqliteService.initialize();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
    }

    if (this.platform.is('capacitor')) {
      await this.configureStatusBar();
      await SplashScreen.hide();
    }
  }

  private async configureStatusBar() {
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#1a1a2e' });
    } catch (error) {
      console.error('StatusBar error:', error);
    }
  }
}
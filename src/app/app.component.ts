// src/app/app.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Platform, IonApp, IonRouterOutlet, AlertController } from '@ionic/angular/standalone';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapApp } from '@capacitor/app';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { SqliteService } from './core/storage/sqlite.service';
import { NotificationRealtimeService } from './core/services/notification-realtime.service';
import { AuthService } from './auth/services/auth.service';
import { ProfileCompletionService } from './core/services/profile-completion.service';
import { CompleteProfileModalComponent } from './shared/components/complete-profile-modal/complete-profile-modal.component';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../environments/environment';
import { CommonModule } from '@angular/common';
import { ThemeService } from './shared/services/theme.service';

@Component({
  selector: 'app-root',
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
      @if (profileCompletion.show()) {
        <app-complete-profile-modal></app-complete-profile-modal>
      }
    </ion-app>
  `,
  standalone: true,
  imports: [CommonModule, IonApp, IonRouterOutlet, CompleteProfileModalComponent]
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
    private authService: AuthService,
    private themeService: ThemeService,
    public profileCompletion: ProfileCompletionService,
    private router: Router,
    private alertCtrl: AlertController
  ) {
    // Fuerza inicialización temprana del tema para evitar pantallas con estilos inconsistentes.
    this.themeService.isDarkMode();
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

    // ✅ FIX SESIÓN MOBILE: verificar token al volver de background
    // Evita que el primer request falle con 401 y borre la sesión de forma inesperada
    this.platform.resume.pipe(takeUntil(this.destroy$)).subscribe(() => {
      console.log('📱 [AppComponent] App resumed from background');
      if (!this.authService.isAuthenticated()) return; // no hay sesión, ignorar

      if (!this.authService.isTokenValid()) {
        console.warn('⚠️ [AppComponent] Token expirado al volver de background → redirigiendo a login');
        this.handleSessionExpiredOnResume();
      } else {
        console.log('✅ [AppComponent] Token válido al volver de background');
      }
    });
  }

  private async handleSessionExpiredOnResume(): Promise<void> {
    this.authService.logout();

    const alert = await this.alertCtrl.create({
      header: 'Sesión expirada',
      message: 'Tu sesión ha expirado por inactividad. Por favor inicia sesión nuevamente.',
      backdropDismiss: false,
      buttons: [{
        text: 'Iniciar sesión',
        handler: () => {
          this.router.navigate(['/auth/login'], { replaceUrl: true, queryParams: { sessionExpired: 'true' } });
        }
      }]
    });
    await alert.present();
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
      this.registerDeepLinkHandler();
    }
  }

  private registerDeepLinkHandler(): void {
    CapApp.addListener('appUrlOpen', (event: { url: string }) => {
      const url = event.url;
      // bapp://home → ir al home según rol
      // bapp://auth/verified → mismo comportamiento que home
      try {
        const parsed = new URL(url);
        const host = parsed.hostname; // "home", "auth", etc.
        if (host === 'payment-result') {
          this.handlePaymentDeepLink(parsed);
          return;
        }

        if (host === 'home' || host === 'auth' || parsed.pathname.startsWith('/auth')) {
          const verifiedEmail = parsed.searchParams.get('emailVerified') === 'true';
          const user = this.authService.getCurrentUser();
          if (user?.role === 'PROVIDER') {
            this.router.navigate(['/provider/tabs/home']);
          } else if (user?.role === 'CLIENT') {
            this.router.navigate(['/client/tabs/home']);
          } else {
            this.router.navigate(['/auth/login'], {
              queryParams: verifiedEmail ? { emailVerified: 'true' } : undefined,
            });
          }
        }
      } catch {
        this.router.navigate(['/auth/login']);
      }
    });
  }

  private handlePaymentDeepLink(parsed: URL): void {
    const status = (parsed.searchParams.get('status') ?? '').toLowerCase();
    const returnTo = parsed.searchParams.get('returnTo');
    const action = parsed.searchParams.get('action');

    if (status === 'success') {
      this.authService.fetchUserProfileFromApi().subscribe({ error: () => {} });
    }

    const target = this.resolveReturnTarget(returnTo);
    const queryParams: Record<string, string> = {
      paymentSuccess: status === 'success' ? 'true' : 'false',
    };

    if (action) {
      queryParams['action'] = action;
    }

    this.router.navigate([target], { queryParams, replaceUrl: true });
  }

  private resolveReturnTarget(returnTo: string | null): string {
    if (returnTo && returnTo.startsWith('/')) {
      return returnTo;
    }

    const role = this.authService.getCurrentUser()?.role;
    return role === 'PROVIDER' ? '/provider/tabs/service-details' : '/client/tabs/home';
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
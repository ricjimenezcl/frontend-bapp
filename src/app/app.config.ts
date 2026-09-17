// src/app/app.config.ts
import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular/standalone';

import {
  SocialLoginModule,
  GoogleLoginProvider,
  FacebookLoginProvider,
} from '@abacritt/angularx-social-login';
import type { SocialAuthServiceConfig } from '@abacritt/angularx-social-login';

import { environment } from '../environments/environment';
import { addIcons } from 'ionicons';
import * as allIonIcons from 'ionicons/icons';
import {
  addCircle,
  removeCircle,
  refreshOutline,
  lockClosedOutline,
  listOutline,
} from 'ionicons/icons';

import { routes } from './app.routes';
import { authInterceptor, errorInterceptor } from './core/interceptors/auth.interceptor';
import { nativeHttpInterceptor } from './core/interceptors/native-http.interceptor';

// Registrar TODO el set de ionicons: los nombres de icono de categorías/subcategorías
// vienen dinámicamente desde la BD (no se conocen en tiempo de compilación), por lo
// que una lista manual curada queda obsoleta cada vez que se agrega una categoría
// nueva. Se mantienen además los alias cortos ya usados en templates existentes.
addIcons({
  ...allIonIcons,
  // Aliases - mapear nombres simples a iconos existentes (compatibilidad con templates previos)
  add: addCircle,
  remove: removeCircle,
  refresh: refreshOutline,
  lockClosed: lockClosedOutline,
  list: listOutline,
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor, nativeHttpInterceptor])),
    provideIonicAngular({ mode: 'ios' }),
    importProvidersFrom(SocialLoginModule),
    
{
  provide: 'SocialAuthServiceConfig',
  useValue: {
    autoLogin: false,
    providers: [
      {
        id: GoogleLoginProvider.PROVIDER_ID,
        provider: new GoogleLoginProvider(environment.googleClientId),
      },
      {
        id: FacebookLoginProvider.PROVIDER_ID,
        provider: new FacebookLoginProvider(environment.facebookAppId),
      },
    ],
    onError: (err) => console.error('[SocialAuth] Error:', err),
  } as SocialAuthServiceConfig,
}
,
  ]
};
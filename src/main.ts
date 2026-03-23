// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// Initialize PWA Elements for camera access on web
// This is required for @ionic/pwa-elements to work properly in browser
if (customElements.get('pwa-camera-modal') === undefined) {
  import('@ionic/pwa-elements/loader').then(({ defineCustomElements }) => {
    defineCustomElements(window);
    console.log('[PWA_ELEMENTS] Initialized successfully');
  }).catch(err => {
    console.warn('[PWA_ELEMENTS] Failed to initialize:', err);
  });
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
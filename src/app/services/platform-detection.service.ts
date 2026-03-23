import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

/**
 * Platform Type
 */
export type PlatformType = 'android' | 'ios' | 'web';

/**
 * Platform Detection Service
 * Detects the current platform (Android, iOS, or Web)
 */
@Injectable({
  providedIn: 'root'
})
export class PlatformDetectionService {

  private platformType: PlatformType;

  constructor(private platform: Platform) {
    this.platformType = this.detectPlatform();
  }

  /**
   * Detect current platform
   */
  private detectPlatform(): PlatformType {
    if (Capacitor.isNativePlatform()) {
      if (this.platform.is('android')) {
        return 'android';
      } else if (this.platform.is('ios')) {
        return 'ios';
      }
    }
    return 'web';
  }

  /**
   * Get current platform type
   */
  getPlatform(): PlatformType {
    return this.platformType;
  }

  /**
   * Check if running on Android
   */
  isAndroid(): boolean {
    return this.platformType === 'android';
  }

  /**
   * Check if running on iOS
   */
  isIOS(): boolean {
    return this.platformType === 'ios';
  }

  /**
   * Check if running on Web
   */
  isWeb(): boolean {
    return this.platformType === 'web';
  }

  /**
   * Check if running on native platform (Android or iOS)
   */
  isNative(): boolean {
    return this.platformType === 'android' || this.platformType === 'ios';
  }

  /**
   * Get platform-specific product ID prefix
   */
  getPlatformProductPrefix(): string {
    switch (this.platformType) {
      case 'android':
        return 'io.ionic.bappsearch.';
      case 'ios':
        return 'bappsearch_';
      case 'web':
        return 'web_';
    }
  }

  /**
   * Get payment platform identifier for API
   */
  getPaymentPlatform(): 'google_play' | 'apple_iap' | 'web' {
    switch (this.platformType) {
      case 'android':
        return 'google_play';
      case 'ios':
        return 'apple_iap';
      case 'web':
        return 'web';
    }
  }

  /**
   * Check if platform supports in-app purchases
   */
  supportsIAP(): boolean {
    return this.isAndroid() || this.isIOS();
  }

  /**
   * Get device information for analytics
   */
  getDeviceInfo(): any {
    return {
      platform: this.platformType,
      isNative: this.isNative(),
      platforms: this.platform.platforms(),
      width: this.platform.width(),
      height: this.platform.height(),
      isLandscape: this.platform.isLandscape(),
      isPortrait: this.platform.isPortrait()
    };
  }
}

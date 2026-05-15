import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { AlertController, Platform } from '@ionic/angular';

export interface GPSStatus {
  hasPermission: boolean;
  isEnabled: boolean;
  canRequest: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GpsValidationService {

  constructor(
    private readonly alertController: AlertController,
    private readonly platform: Platform
  ) {}

  /**
   * Verifica el estado completo del GPS/ubicación
   * @returns Estado del GPS con permisos y disponibilidad
   */
  async checkGPSStatus(): Promise<GPSStatus> {
    try {
      // Verificar permisos
      const permissions = await Geolocation.checkPermissions();
      
      const hasPermission = permissions.location === 'granted';
      const canRequest = permissions.location === 'prompt' || permissions.location === 'prompt-with-rationale';
      
      // Intentar obtener ubicación solo si tenemos permiso
      if (!hasPermission && !canRequest) {
        return {
          hasPermission: false,
          isEnabled: false,
          canRequest: false,
          message: 'Los permisos de ubicación han sido denegados. Por favor, habilítalos en la configuración de la aplicación.'
        };
      }

      if (!hasPermission && canRequest) {
        return {
          hasPermission: false,
          isEnabled: false,
          canRequest: true,
          message: 'Se requiere acceso a la ubicación para usar esta función.'
        };
      }

      // Verificar si el GPS está habilitado intentando obtener la posición
      try {
        await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 60000
        });
        
        return {
          hasPermission: true,
          isEnabled: true,
          canRequest: false,
          message: 'GPS habilitado y funcionando correctamente.'
        };
      } catch (locationError: any) {
        // Error específico cuando el GPS está deshabilitado
        if (locationError.code === 2 || locationError.message?.includes('disabled')) {
          return {
            hasPermission: true,
            isEnabled: false,
            canRequest: false,
            message: 'El GPS está deshabilitado. Por favor, actívalo en la configuración del dispositivo.'
          };
        }
        
        // Otros errores (timeout, etc.)
        return {
          hasPermission: true,
          isEnabled: false,
          canRequest: false,
          message: `Error al verificar GPS: ${locationError.message}`
        };
      }
      
    } catch (error: any) {
      console.error('Error verificando estado del GPS:', error);
      return {
        hasPermission: false,
        isEnabled: false,
        canRequest: false,
        message: `Error al verificar el estado del GPS: ${error.message}`
      };
    }
  }

  /**
   * Solicita permisos de ubicación si aún no se han otorgado
   * @returns true si se otorgaron los permisos, false en caso contrario
   */
  async requestLocationPermissions(): Promise<boolean> {
    try {
      const permissions = await Geolocation.requestPermissions();
      return permissions.location === 'granted';
    } catch (error) {
      console.error('Error solicitando permisos:', error);
      return false;
    }
  }

  /**
   * Muestra una alerta al usuario indicando que debe habilitar el GPS
   * @param status Estado del GPS
   * @returns Promise que se resuelve cuando el usuario cierra la alerta
   */
  async showGPSAlert(status: GPSStatus): Promise<void> {
    let header = '📍 Ubicación Requerida';
    let message = status.message || 'Se necesita acceso a tu ubicación.';
    let buttons: any[] = [];

    if (!status.hasPermission && status.canRequest) {
      // Caso 1: Podemos solicitar permisos
      header = '📍 Permiso de Ubicación';
      message = 'Esta función necesita acceso a tu ubicación para funcionar correctamente.';
      buttons = [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'alert-button-cancel'
        },
        {
          text: 'Permitir',
          cssClass: 'alert-button-confirm',
          handler: async () => {
            await this.requestLocationPermissions();
          }
        }
      ];
    } else if (!status.hasPermission && !status.canRequest) {
      // Caso 2: Permisos denegados permanentemente
      header = '⚠️ Permisos Denegados';
      message = 'Los permisos de ubicación han sido denegados. Para usar esta función, debes habilitarlos manualmente en la configuración de tu dispositivo.';
      buttons = [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'alert-button-cancel'
        },
        {
          text: 'Ver Instrucciones',
          cssClass: 'alert-button-confirm',
          handler: () => {
            this.openAppSettings();
          }
        }
      ];
    } else if (status.hasPermission && !status.isEnabled) {
      // Caso 3: GPS deshabilitado
      header = '📡 GPS Deshabilitado';
      message = 'El GPS de tu dispositivo está deshabilitado. Por favor, actívalo para usar esta función.';
      buttons = [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'alert-button-cancel'
        },
        {
          text: 'Ver Instrucciones',
          cssClass: 'alert-button-confirm',
          handler: () => {
            this.openLocationSettings();
          }
        }
      ];
    }

    const alert = await this.alertController.create({
      header,
      message,
      buttons,
      cssClass: 'gps-alert',
      backdropDismiss: false
    });

    await alert.present();
  }

  /**
   * Valida el GPS y muestra alertas si es necesario
   * @returns true si el GPS está habilitado y tiene permisos, false en caso contrario
   */
  async validateAndRequestGPS(): Promise<boolean> {
    const status = await this.checkGPSStatus();
    
    if (status.hasPermission && status.isEnabled) {
      return true;
    }

    await this.showGPSAlert(status);
    return false;
  }

  /**
   * Muestra instrucciones para abrir la configuración de la aplicación
   */
  private async openAppSettings(): Promise<void> {
    let message = 'Para habilitar los permisos de ubicación:';
    
    if (this.platform.is('ios')) {
      message += '\n\n1. Abre Configuración\n2. Busca BAPP\n3. Toca Ubicación\n4. Selecciona "Mientras usas la app"';
    } else if (this.platform.is('android')) {
      message += '\n\n1. Abre Configuración\n2. Toca Aplicaciones\n3. Busca BAPP\n4. Toca Permisos\n5. Toca Ubicación\n6. Selecciona "Permitir solo mientras usas la app"';
    } else {
      message = 'Por favor, permite el acceso a tu ubicación cuando el navegador lo solicite.';
    }

    const alert = await this.alertController.create({
      header: 'Configuración de Permisos',
      message,
      buttons: ['Entendido']
    });
    await alert.present();
  }

  /**
   * Muestra instrucciones para abrir la configuración de ubicación del dispositivo
   */
  private async openLocationSettings(): Promise<void> {
    let message = 'Para activar el GPS:';
    
    if (this.platform.is('android')) {
      message += '\n\n1. Desliza hacia abajo desde la parte superior\n2. Mantén presionado el ícono de Ubicación\n3. Activa "Usar ubicación"';
    } else if (this.platform.is('ios')) {
      message += '\n\n1. Abre Configuración\n2. Toca Privacidad y seguridad\n3. Toca Servicios de ubicación\n4. Activa Servicios de ubicación';
    } else {
      message = 'Por favor, asegúrate de que tu navegador tenga permisos de ubicación habilitados.';
    }

    const alert = await this.alertController.create({
      header: 'Activar GPS',
      message,
      buttons: ['Entendido']
    });
    await alert.present();
  }

  /**
   * Verifica rápidamente si el GPS está disponible sin mostrar alertas
   * @returns true si está disponible, false en caso contrario
   */
  async isGPSAvailable(): Promise<boolean> {
    const status = await this.checkGPSStatus();
    return status.hasPermission && status.isEnabled;
  }
}

import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.bappsearch',
  appName: 'BappSearch',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  // Custom URL scheme para deep links: bapp://
  // El enlace de verificaci\u00f3n en el correo redirige a bapp://home tras verificar en la web
  appUrlScheme: 'bapp',
  plugins: {
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      androidIsEncryption: false,
      electronIsEncryption: false,
      electronWindowsLocation: 'C:\\ProgramData\\CapacitorDatabases'
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1a2e'
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1a1a2e',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    Geolocation: {
      // Configuración para Android
      android: {
        enableHighAccuracy: true
      },
      // Configuración para iOS
      ios: {
        whenInUsePermission: 'Necesitamos tu ubicación para encontrar proveedores cercanos.'
      }
    },
    // Otros plugins que puedas necesitar
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF",
      sound: "beep.wav"
    },
    Camera: {
      enable: true
    }
  }
};

export default config;
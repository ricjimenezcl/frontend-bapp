import { CapacitorConfig } from '@capacitor/cli';
import * as fs from 'fs';
import * as path from 'path';

function readDotEnv(): Record<string, string> {
  const envPath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(envPath)) return {};

  const values: Record<string, string> = {};
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    values[key] = value;
  }

  return values;
}

const env = {
  ...process.env,
  ...readDotEnv(),
};

const config: CapacitorConfig = {
  appId: 'io.ionic.bappsearch',
  appName: 'Bappsearch',
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
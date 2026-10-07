export const environment = {
  production: false,
  apiUrl: 'https://backend-bapp.onrender.com/api/v1',
  wsUrl: '',
  appName: 'Bappsearch',
  version: '1.0.0',
  // Cliente web: para navegador / Render / OAuth del front.
  googleClientId: '713984511036-kvn0om4d75dq5gqdpokjg2up7eim6gq.apps.googleusercontent.com',
  // Cliente Android de Google Console (package + SHA-1). Este valor es el que usa GoogleAuth.initialize() en APK.
  googleAndroidClientId: '713984511036-s04aakme1l0norgd7g6djk08b0ur3gqo.apps.googleusercontent.com',
  googleWebClientId: '713984511036-kvn0om4d75dq5gqdpokjg2up7eim6gq.apps.googleusercontent.com',
  facebookAppId: '',
  cloudinaryCloudName: '',
  cloudinaryUploadPreset: '',
  mapDefaultStyle: 'liberty' as 'liberty' | 'positron' | 'dark-matter',
  // API key pública de RevenueCat (Apple App Store / Google Play).
  revenueCatApiKeyIos: 'appl_UfSHBTWyETvfRsUmuxmoMnRuCrZ',
  revenueCatApiKeyAndroid: '',
};

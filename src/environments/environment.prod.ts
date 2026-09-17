export const environment = {
  production: true,
  apiUrl: 'https://backend-bapp.onrender.com/api/v1',
  wsUrl: 'wss://backend-bapp.onrender.com/api/v1/ws',
  appName: 'BappSearch',
  version: '1.0.0',
  // Replica la configuración del proyecto web que ya funciona con Google/Facebook.
  googleClientId: '713984511036-kvn0om47d75dq5gqdpokgj2up7eim6jq.apps.googleusercontent.com',
  facebookAppId: '864227603333716',
  cloudinaryCloudName: '',
  cloudinaryUploadPreset: 'ml_default',
  mapDefaultStyle: 'liberty' as 'liberty' | 'positron' | 'dark-matter',
};

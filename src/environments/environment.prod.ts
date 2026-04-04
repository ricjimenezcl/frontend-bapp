export const environment = {
  production: true,
  apiUrl: 'https://backend-bapp.onrender.com/api/v1',
  wsUrl: 'wss://backend-bapp.onrender.com/api/v1/ws',
  appName: 'BappSearch',
  version: '1.0.0',
  // ✅ geoapifyApiKey: Migrada al backend (/api/v1/geocoding/static-map)
  googleClientId: '181446851130-fc2b6ppn6qpgume9guj49kieu6ac7fet.apps.googleusercontent.com',
  facebookAppId: '864227603333716',
  cloudinaryCloudName: '',
  cloudinaryUploadPreset: 'ml_default',
  mapDefaultStyle: 'liberty' as 'liberty' | 'positron' | 'dark-matter',
};

// Variables cargadas desde .env via: npm run set-env
// NO commitear este archivo con valores reales — usa .env.example como referencia
export const environment = {
  production: true,
  apiUrl: '${API_URL}',
  appName: 'front-bapp',
  version: '1.0.0',
  geoapifyApiKey: '${GEOAPIFY_API_KEY}',
  googleClientId: '${GOOGLE_CLIENT_ID}',
  facebookAppId: '${FACEBOOK_APP_ID}',
  mapDefaultStyle: 'liberty' as 'liberty' | 'positron' | 'dark-matter',
};

// Variables cargadas desde .env via: npm run set-env
// NO commitear este archivo con valores reales — usa .env.example como referencia
export const environment = {
  production: true,
  apiUrl: 'https://backend-bapp.onrender.com/api/v1',
  appName: 'front-bapp',
  version: '1.0.0',
  geoapifyApiKey: 'bdd29470271042c4b0751a91c0d4e9f8',
  googleClientId: '181446851130-fc2b6ppn6qpgume9guj49kieu6ac7fet.apps.googleusercontent.com',
  facebookAppId: '864227603333716',
  mapDefaultStyle: 'liberty' as 'liberty' | 'positron' | 'dark-matter',
};

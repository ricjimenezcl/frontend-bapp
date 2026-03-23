// Variables cargadas desde frontend/.env via: npm run set-env
// NO commitear este archivo con valores reales — usa .env.example como referencia
export const environment = {
  production: false,
  apiUrl: 'https://backend-bapp.onrender.com/api/v1',
  appName: 'front-bapp',
  version: '1.0.0',
  // Geocoding / mapas estáticos (Geoapify) — cargado desde .env
  geoapifyApiKey: 'bdd29470271042c4b0751a91c0d4e9f8',
  // OAuth — configurar en Google Cloud Console y Meta Developers, luego agregar al .env
  googleClientId: '181446851130-fc2b6ppn6qpgume9guj49kieu6ac7fet.apps.googleusercontent.com',
  facebookAppId: '864227603333716',
  // Mapas: OpenFreeMap tiles vía MapLibre GL ($0/mes, CDN producción)
  mapDefaultStyle: 'dark-matter' as 'liberty' | 'positron' | 'dark-matter',
};

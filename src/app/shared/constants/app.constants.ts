export const APP_CONSTANTS = {
  // URLs de la API
  API: {
    BASE_URL: 'http://localhost:8000/api/v1',
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3
  },

  // Coordenadas y ubicación
  COORDINATES: {
    // Centro de Santiago
    DEFAULT_LAT: -33.451060,
    DEFAULT_LNG: -70.591697,
    
    // Offset para mapas
    OFFSET_LATITUDE: 0.005068,
    OFFSET_LONGITUDE: -0.0126018,
    
    // Zoom por defecto en mapas
    DEFAULT_ZOOM: 14,
    
    // Margen de búsqueda
    SEARCH_RADIUS_KM: 50,
    
    // Umbral de precisión de GPS
    ACCURACY_THRESHOLD: 500 // metros
  },

  // Imagen
  IMAGE: {
    MAX_WIDTH: 400,
    MAX_HEIGHT: 400,
    QUALITY: 0.5,
    ALLOWED_FORMATS: ['image/jpeg', 'image/png', 'image/webp'],
    MAX_FILE_SIZE: 5242880 // 5MB
  },

  // Validación
  VALIDATION: {
    PHONE_REGEX: /^(56)?9\d{8}$/,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    RUT_REGEX: /^(\d{1,2})\.?(\d{3})\.?(\d{3})-?([\dK])$/i,
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_REGEX: /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/
  },

  // Paginación
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100
  },

  // Tiempo
  TIME: {
    DEBOUNCE_SEARCH: 300, // ms
    DEBOUNCE_FORM: 500, // ms
    TOAST_DURATION: 3000, // ms
    TOAST_ERROR_DURATION: 5000, // ms
    SESSION_TIMEOUT: 3600000 // 1 hora en ms
  },

  // Storage keys
  STORAGE_KEYS: {
    STATE: 'app-state',
    USER: 'app-user',
    TOKEN: 'app-token',
    PREFERENCES: 'app-preferences',
    LOCATION: 'app-location',
    SEARCH_HISTORY: 'app-search-history'
  },

  // Roles
  ROLES: {
    CLIENT: 'client',
    PROVIDER: 'provider',
    ADMIN: 'admin'
  },

  // Estados
  STATUS: {
    PENDING: 'pending',
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed'
  },

  // Errores
  ERROR_CODES: {
    NETWORK_ERROR: 'NETWORK_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    SERVER_ERROR: 'SERVER_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
  },

  // Rutas
  ROUTES: {
    AUTH_LOGIN: '/auth/login',
    AUTH_REGISTER: '/auth/register',
    HOME: '/home',
    PROFILE: '/profile',
    SETTINGS: '/settings',
    PROVIDER_DASHBOARD: '/provider/dashboard',
    CLIENT_BOOKINGS: '/client/bookings'
  },

  // Mapbox
  MAPBOX: {
    ACCESS_TOKEN: 'YOUR_MAPBOX_TOKEN_HERE',
    STYLE: 'mapbox://styles/mapbox/streets-v12'
  }
};

// Variables de entorno (por ambiente)
export const ENV_CONFIG = {
  development: {
    api: 'http://localhost:8000/api/v1',
    debug: true
  },
  staging: {
    api: 'https://staging-api.example.com/api/v1',
    debug: false
  },
  production: {
    api: 'https://api.example.com/api/v1',
    debug: false
  }
};

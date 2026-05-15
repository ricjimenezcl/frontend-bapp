# 🔍 Análisis Comparativo: Provider Services (Web vs Móvil)

**Fecha:** 15 de mayo de 2026  
**Proyecto Web:** `/Users/rjimenezl/Documents/bapp/web-bapp/`  
**Proyecto Móvil:** `/Users/rjimenezl/Documents/bapp/frontend-bapp/`

---

## 📋 Índice
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura de Servicios](#arquitectura-de-servicios)
3. [Comparación Detallada por Servicio](#comparación-detallada-por-servicio)
4. [Diferencias Críticas](#diferencias-críticas)
5. [Recomendaciones](#recomendaciones)

---

## 🎯 Resumen Ejecutivo

### Archivos Encontrados

#### **Proyecto Web** (Angular 18)
```
src/app/core/
├── services/
│   ├── provider.service.ts        ← SERVICIO PRINCIPAL CONSOLIDADO
│   └── profile.service.ts          ← Perfil de clientes (no providers)
└── models/
    └── provider.model.ts           ← Modelos compartidos
```

#### **Proyecto Móvil** (Ionic v8 + Angular 18)
```
src/app/
├── provider/services/
│   ├── provider.service.ts                ← SERVICIO PRINCIPAL
│   ├── provider-booking.service.ts        ← Gestión de reservas
│   └── provider-validation.service.ts     ← Validación de identidad
├── client/services/
│   └── client-provider.service.ts         ← Búsqueda geoespacial
├── shared/services/
│   └── provider.service.ts                ← Servicio legacy/alternativo
└── core/models/
    └── provider.model.ts                  ← Modelo compartido
```

### Hallazgos Clave

| Aspecto | Web | Móvil |
|---------|-----|-------|
| **Arquitectura** | ✅ Monolítico consolidado | ⚠️ Servicios fragmentados en 5 archivos |
| **Gestión de Estado** | ✅ Signals (write + readonly) | ✅ Signals (write + readonly) |
| **Endpoints** | ✅ Completos y actualizados | ⚠️ Mix de endpoints nuevos y legacy |
| **Modelos** | ✅ Centralizados en `provider.model.ts` | ✅ Centralizados, pero duplicados |
| **Funcionalidad Horarios** | ✅ Completa (working hours + schedules + slots) | ❌ No implementada |
| **Búsqueda Geoespacial** | ✅ Integrada en servicio principal | ⚠️ Separada en `client-provider.service` |

---

## 🏗️ Arquitectura de Servicios

### Web: Arquitectura Consolidada

```typescript
ProviderService
├── Perfil (CRUD)
├── Servicios publicados (CRUD)
├── Búsqueda geoespacial
├── Horarios de trabajo (Working Hours)
├── Disponibilidad de slots
└── Estadísticas
```

**Ventajas:**
- ✅ Un único punto de acceso
- ✅ Gestión de estado centralizada
- ✅ Menor complejidad de imports
- ✅ Caché compartido eficiente

### Móvil: Arquitectura Fragmentada

```typescript
provider.service.ts (PRINCIPAL)
├── Perfil (CRUD)
├── Servicios publicados (CRUD)
└── Estadísticas

client-provider.service.ts
└── Búsqueda geoespacial (GeoJSON)

provider-booking.service.ts
└── Gestión de reservas del provider

provider-validation.service.ts
└── Validación de identidad (KYC)

shared/provider.service.ts (LEGACY)
└── Métodos legacy/duplicados
```

**Desventajas:**
- ⚠️ Lógica dispersa en múltiples archivos
- ⚠️ Duplicación de endpoints
- ⚠️ Mayor complejidad de mantenimiento
- ⚠️ Estado fragmentado

---

## 🔬 Comparación Detallada por Servicio

### 1. Provider Service Principal

#### **Web:** `/src/app/core/services/provider.service.ts`

##### Métodos Públicos (28 métodos)

**🟢 Perfil del Proveedor**
```typescript
getMyProfile(): Observable<ProviderProfile>
getProviderProfile(id: number): Observable<ProviderProfile>
getProviderDetailedProfile(id: number): Observable<ProviderProfile>
  // ↳ Endpoint: GET /providers/{id}/detailed
  // ↳ Incluye servicios embebidos

updateProfile(data: Partial<ProviderProfile>): Observable<ProviderProfile>
  // ↳ Endpoint: PATCH /providers/me

validateIdentity(formData: FormData): Observable<any>
  // ↳ Endpoint: POST /providers/validate-identity
```

**🟢 Servicios Publicados**
```typescript
getMyServices(): Observable<ServiceProvider[]>
  // ↳ Flujo: GET /providers/me → GET /providers/services/{id}
  // ↳ Mapea campos anidados (avatar, full_name)

getProviderServices(id: number): Observable<ServiceProvider[]>
  // ↳ Endpoint: GET /providers/services/{id}

createService(data: Record<string, unknown>): Observable<ServiceProvider>
  // ↳ Endpoint: POST /providers/services
  // ↳ Campos en español: servicio, categoria, nombre_prestador, etc.

updateService(
  providerId: number, 
  serviceId: number, 
  data: Partial<ServiceProvider>
): Observable<ServiceProvider>
  // ↳ Endpoint: PUT /providers/{providerId}/services/{serviceId}

deleteService(serviceId: number): Observable<void>
  // ↳ Endpoint: DELETE /providers/services/{serviceId}
```

**🟢 Horarios y Disponibilidad** (✨ Solo en Web)
```typescript
// Working Hours (horarios generales del proveedor)
getMyWorkingHours(): Observable<ProviderWorkingHours[]>
  // ↳ Endpoint: GET /working-hours/me

saveWorkingHours(data: ProviderWorkingHours): Observable<ProviderWorkingHours>
  // ↳ Endpoint: POST /working-hours/me

getProviderWorkingHours(providerId: number): Observable<ProviderWorkingHours[]>
  // ↳ Endpoint: GET /working-hours/provider/{providerId}

// Service Schedules (horarios específicos por servicio)
saveServiceSchedule(
  providerId: number,
  serviceProviderId: number,
  data: { day_of_week, start_time, end_time, is_available }
): Observable<any>
  // ↳ Endpoint: POST /providers/{providerId}/services/{serviceProviderId}/schedules
  // ↳ Tabla: service_availability

getServiceSchedules(
  providerId: number, 
  serviceProviderId: number
): Observable<any[]>
  // ↳ Endpoint: GET /providers/{providerId}/services/{serviceProviderId}/schedules

// Available Slots (slots reales considerando reservas existentes)
getAvailableSlotsByService(
  providerId: number,
  serviceProviderId: number,
  date: string
): Observable<{ date, service_provider_id, slots: {time, available}[] }>
  // ↳ Endpoint: GET /providers/{providerId}/services/{serviceProviderId}/available-slots
  // ↳ Integra: service_availability + bookings → disponibilidad real
```

**🟢 Búsqueda Geoespacial**
```typescript
getNearbyProviders(
  lat: number, 
  lng: number, 
  radius: number = 10
): Observable<ServiceProvider[]>
  // ↳ Endpoint: GET /providers/nearby?lat={}&lng={}&radius={}

getNearbyProvidersByServiceId(
  lat: number,
  lng: number,
  radius: number,
  serviceId: number,
  skip: number = 0,
  limit: number = 10
): Observable<ServiceProvider[]>
  // ↳ Endpoint: GET /providers/nearby/service/{serviceId}
  // ↳ Parámetros: lat, lng, radius, skip, limit
  // ↳ Mapea: avatar, full_name, is_available, rating, distance, service_category

searchProviders(params: {
  category_id?: number;
  query?: string;
}): Observable<ServiceProvider[]>
  // ↳ Endpoint: GET /providers/text-search?q={}
  // ↳ Validación: mínimo 2 caracteres
```

**🟢 Estadísticas**
```typescript
getMyStats(): Observable<ProviderStats>
  // ↳ Flujo: GET /providers/me → GET /providers/{id}/stats
```

**🎨 Gestión de Estado (Signals)**
```typescript
private _profile  = signal<ProviderProfile | null>(null);
private _services = signal<ServiceProvider[]>([]);
private _stats    = signal<ProviderStats | null>(null);
private _loading  = signal<boolean>(false);

readonly profile  = this._profile.asReadonly();
readonly services = this._services.asReadonly();
readonly stats    = this._stats.asReadonly();
readonly loading  = this._loading.asReadonly();
```

---

#### **Móvil:** `/src/app/provider/services/provider.service.ts`

##### Métodos Públicos (18 métodos)

**🟢 Perfil del Proveedor**
```typescript
getProviderProfile(providerId?: string): Observable<ProviderProfile>
  // ↳ Endpoint: GET /providers/me

getMyProfile(): Observable<ProviderProfile>
  // ↳ Con caché + in-flight request deduplication
  // ↳ Pattern: shareReplay(1) para evitar múltiples HTTP

invalidateProfileCache(): void

updateProviderProfile(
  providerId?: string, 
  data?: Partial<ProviderProfile>
): Observable<ProviderProfile>
  // ↳ Endpoint: PATCH /providers/me

putProviderProfileEdit(...): Observable<ProviderProfile>
  // ↳ Alias para compatibilidad
```

**🟢 Servicios Publicados**
```typescript
getProviderServices(providerId: string): Observable<ProviderServices[]>
  // ↳ Endpoint: GET /providers/services/{providerId}

getProviderService(
  providerId: number, 
  serviceId: number
): Observable<ProviderServices>
  // ↳ Endpoint: GET /providers/{providerId}/services/{serviceId}

getProviderServiceById(
  providerId: number, 
  serviceId: number
): Observable<ServiceProviderData>
  // ↳ Retorna interfaz expandida ServiceProviderData

createProviderService(
  data: Partial<ProviderServices>
): Observable<ProviderServices>
  // ↳ Endpoint: POST /provider-services

updateProviderService(
  providerId: number,
  serviceId: number,
  data: Partial<ProviderServices>
): Observable<ProviderServices>
  // ↳ Endpoint: PUT /providers/{providerId}/services/{serviceId}

deleteProviderService(serviceId: number): Observable<any>
  // ↳ Endpoint: DELETE /provider-services/{serviceId}

toggleServiceAvailability(
  serviceId: number, 
  isAvailable: boolean
): Observable<ProviderServices>
  // ↳ Endpoint: PATCH /providers/provider-services/{serviceId}
```

**🟢 Estadísticas**
```typescript
getProviderStats(providerId: string): Observable<ProviderStats>
  // ↳ Endpoint: GET /providers/{providerId}/stats
```

**🟢 Reservas (Bookings)**
```typescript
getProviderBookings(
  providerId: string, 
  status?: string
): Observable<any[]>
  // ↳ Endpoint: GET /providers/{providerId}/bookings?status={}

updateBookingStatus(
  bookingId: number, 
  status: string
): Observable<any>
  // ↳ Endpoint: PATCH /bookings/{bookingId}
```

**🟢 Disponibilidad**
```typescript
updateAvailability(
  providerId: string, 
  isAvailable: boolean
): Observable<ProviderProfile>
  // ↳ Endpoint: PATCH /providers/{providerId}
```

**🟢 Registro**
```typescript
registerProvider(data: any): Observable<any>
  // ↳ Endpoint: POST /providers/register
```

**🟢 Utilidades**
```typescript
clearCache(): void
  // ↳ Limpia todos los signals
```

**🎨 Gestión de Estado (Signals)**
```typescript
private _providerProfile = signal<ProviderProfile | null>(null);
private _providerServices = signal<ProviderServices[]>([]);
private _providerStats = signal<ProviderStats | null>(null);
private _isLoading = signal<boolean>(false);

public readonly providerProfile = this._providerProfile.asReadonly();
public readonly providerServices = this._providerServices.asReadonly();
public readonly providerStats = this._providerStats.asReadonly();
public readonly isLoading = this._isLoading.asReadonly();
```

**✨ Optimización Única en Móvil:**
```typescript
// Previene múltiples HTTP calls paralelos durante init simultáneo
private _profileRequest$: Observable<ProviderProfile> | null = null;

getMyProfile(): Observable<ProviderProfile> {
  const cached = this._providerProfile();
  if (cached) return of(cached);
  if (!this._profileRequest$) {
    this._profileRequest$ = this.getProviderProfile().pipe(
      tap(() => { this._profileRequest$ = null; }),
      shareReplay(1)
    );
  }
  return this._profileRequest$;
}
```

---

### 2. Client Provider Service (Búsqueda Geoespacial)

#### **Móvil:** `/src/app/client/services/client-provider.service.ts`

##### Función Especializada
```typescript
getNearbyProviders(
  lat: number,
  lng: number,
  radiusKm: number = 10,
  serviceId?: number
): Observable<GeoJSONFeatureCollection>
  // ↳ Endpoint condicional:
  //   - Sin serviceId: GET /providers/nearby
  //   - Con serviceId: GET /providers/nearby/service/{serviceId}
  // ↳ Transforma resultado a formato GeoJSON
  // ↳ Estructura: FeatureCollection con geometrías Point

private toGeoJSON(providers: any[]): GeoJSONFeatureCollection
  // ↳ Mapea providers a formato GeoJSON estándar
  // ↳ Estructura:
  //   {
  //     type: 'FeatureCollection',
  //     features: [
  //       {
  //         type: 'Feature',
  //         geometry: { type: 'Point', coordinates: [lng, lat] },
  //         properties: { id, provider_id, business_name, ... }
  //       }
  //     ]
  //   }
```

**⚠️ Duplicación con Web:**
- Web: `provider.service.ts` incluye `getNearbyProviders()` y `getNearbyProvidersByServiceId()`
- Móvil: Funcionalidad separada en servicio dedicado con transformación GeoJSON

---

### 3. Provider Booking Service

#### **Móvil:** `/src/app/provider/services/provider-booking.service.ts`

##### Métodos Públicos (3 métodos)
```typescript
getBookings(): Observable<BookingResponse[]>
  // ↳ Endpoint: GET /bookings/provider

acceptBooking(
  bookingId: number, 
  notes?: string
): Observable<BookingResponse>
  // ↳ Endpoint: POST /bookings/{bookingId}/confirm

rejectBooking(
  bookingId: number,
  reason: string = 'PROVIDER_REQUEST',
  reasonComment?: string
): Observable<BookingResponse>
  // ↳ Endpoint: POST /bookings/{bookingId}/cancel
```

**⚠️ Duplicación con Principal:**
- `provider.service.ts` móvil ya tiene:
  - `getProviderBookings(providerId, status?)`
  - `updateBookingStatus(bookingId, status)`
- Servicio separado solo añade azúcar sintáctico (`acceptBooking`, `rejectBooking`)

---

### 4. Provider Validation Service

#### **Móvil:** `/src/app/provider/services/provider-validation.service.ts`

##### Métodos Públicos (2 métodos)
```typescript
validateIdentity(
  providerId: number,
  docFile: File,
  selfieFile: File
): Observable<any>
  // ↳ Endpoint: POST /providers/validate-identity
  // ↳ FormData: provider_id, identity_document, selfie

getVerificationStatus(verificationId: number): Observable<any>
  // ↳ Endpoint: GET /api/v1/documents/verification-status/{verificationId}
```

**🔍 Comparación con Web:**
- Web: `provider.service.ts` incluye `validateIdentity(formData)`
- Móvil: Servicio separado con método helper adicional `getVerificationStatus()`

---

### 5. Shared Provider Service (Legacy)

#### **Móvil:** `/src/app/shared/services/provider.service.ts`

##### Análisis
```typescript
// ⚠️ SERVICIO LEGACY - Probablemente duplicado/obsoleto
// ↳ Usa APP_CONSTANTS.API.BASE_URL (diferente de environment.apiUrl)
// ↳ Usa ErrorHandlerService (no usado en otros servicios)
// ↳ Endpoints legacy: /providers/me/services (no usado en backend actual)
```

**Métodos Legacy:**
```typescript
getProfile(): Observable<any>
  // ↳ Endpoint: GET /providers/me

updateProfile(data): Observable<any>
  // ↳ Endpoint: PUT /providers/me (debería ser PATCH)

getServices(): Observable<Service[]>
  // ↳ Endpoint: GET /providers/me/services ⚠️ No existe en backend

createService(data: CreateServiceRequest): Observable<Service>
  // ↳ Usa FormData builder
  // ↳ Endpoint: POST /providers/me/services ⚠️ No coincide con backend

updateService(serviceId, data): Observable<Service>
  // ↳ Endpoint: PUT /providers/me/services/{id} ⚠️ No coincide

deleteService(serviceId): Observable<any>
  // ↳ Endpoint: DELETE /providers/me/services/{id} ⚠️ No coincide

getNearbyServices(lat, lng, radiusKm): Observable<ProviderService[]>
  // ↳ Endpoint: GET /providers/nearby

searchServices(category, page, pageSize): Observable<{...}>
  // ↳ Endpoint: GET /providers/search

getFeaturedProviders(): Observable<any[]>
  // ↳ Endpoint: GET /providers/featured

getProviderDetails(providerId): Observable<any>
  // ↳ Endpoint: GET /providers/{providerId}
```

**🚨 CRÍTICO:** Este servicio usa endpoints que **NO coinciden** con el backend actual. Posible código legacy no migrado.

---

## ⚠️ Diferencias Críticas

### 1. 🔴 Gestión de Horarios y Disponibilidad

| Funcionalidad | Web | Móvil |
|---------------|-----|-------|
| **Working Hours** (horarios generales) | ✅ Implementado | ❌ **NO implementado** |
| **Service Schedules** (horarios por servicio) | ✅ Implementado | ❌ **NO implementado** |
| **Available Slots** (slots reales) | ✅ Implementado | ❌ **NO implementado** |

**Impacto:**
- ❌ La app móvil **NO puede** gestionar horarios de trabajo
- ❌ Los providers **NO pueden** configurar disponibilidad por servicio
- ❌ Los clientes **NO pueden** ver slots disponibles
- ❌ Sistema de reservas **incompleto** en móvil

**Endpoints Faltantes en Móvil:**
```
GET  /working-hours/me
POST /working-hours/me
GET  /working-hours/provider/{id}
POST /providers/{pid}/services/{sid}/schedules
GET  /providers/{pid}/services/{sid}/schedules
GET  /providers/{pid}/services/{sid}/available-slots
```

---

### 2. 🟡 Arquitectura Fragmentada vs Consolidada

**Web:** 1 servicio principal consolidado  
**Móvil:** 5 servicios separados con lógica duplicada

| Operación | Web | Móvil |
|-----------|-----|-------|
| Buscar providers cercanos | `provider.service.ts` | `client-provider.service.ts` |
| Gestionar reservas | `provider.service.ts` (stats) | `provider-booking.service.ts` |
| Validar identidad | `provider.service.ts` | `provider-validation.service.ts` |
| CRUD servicios | `provider.service.ts` | `provider.service.ts` + `shared/provider.service.ts` |

**Problemas:**
- ⚠️ Duplicación de lógica
- ⚠️ Endpoints inconsistentes entre servicios
- ⚠️ Mayor superficie de bugs
- ⚠️ Caché fragmentado

---

### 3. 🟡 Endpoints Inconsistentes

#### Crear Servicio

| Proyecto | Endpoint | Cuerpo |
|----------|----------|--------|
| **Web** | `POST /providers/services` | Campos en español: `servicio`, `categoria`, `nombre_prestador` |
| **Móvil (principal)** | `POST /provider-services` | Campos en inglés: `service_id`, `business_name` |
| **Móvil (shared)** | `POST /providers/me/services` | FormData con `image` |

#### Actualizar Servicio

| Proyecto | Endpoint |
|----------|----------|
| **Web** | `PUT /providers/{providerId}/services/{serviceId}` |
| **Móvil (principal)** | `PUT /providers/{providerId}/services/{serviceId}` ✅ |
| **Móvil (shared)** | `PUT /providers/me/services/{serviceId}` ⚠️ |

#### Eliminar Servicio

| Proyecto | Endpoint |
|----------|----------|
| **Web** | `DELETE /providers/services/{serviceId}` |
| **Móvil (principal)** | `DELETE /provider-services/{serviceId}` |
| **Móvil (shared)** | `DELETE /providers/me/services/{serviceId}` ⚠️ |

---

### 4. 🟢 Funcionalidad Única en Móvil

#### Caché In-Flight Request Deduplication
```typescript
// Previene múltiples HTTP calls paralelos durante init
private _profileRequest$: Observable<ProviderProfile> | null = null;

getMyProfile(): Observable<ProviderProfile> {
  const cached = this._providerProfile();
  if (cached) return of(cached);
  if (!this._profileRequest$) {
    this._profileRequest$ = this.getProviderProfile().pipe(
      tap(() => { this._profileRequest$ = null; }),
      shareReplay(1)
    );
  }
  return this._profileRequest$;
}
```
**Ventaja:** Evita race conditions cuando múltiples componentes cargan en paralelo

#### Transformación GeoJSON
```typescript
// client-provider.service.ts
getNearbyProviders(): Observable<GeoJSONFeatureCollection>
```
**Ventaja:** Formato estándar para librerías de mapas (Leaflet, Mapbox)

---

### 5. 🟢 Funcionalidad Única en Web

#### 1. Gestión Completa de Horarios
```typescript
// Working Hours (tabla working_hours)
getMyWorkingHours()
saveWorkingHours()
getProviderWorkingHours()

// Service Schedules (tabla service_availability)
saveServiceSchedule()
getServiceSchedules()

// Available Slots (integra availability + bookings)
getAvailableSlotsByService()
```

#### 2. Perfil Detallado con Servicios Embebidos
```typescript
getProviderDetailedProfile(id: number): Observable<ProviderProfile>
  // ↳ Endpoint: GET /providers/{id}/detailed
  // ↳ Respuesta incluye: servicios[], rating, reviews
```

#### 3. Mapeo Avanzado de Campos
```typescript
// Web mapea automáticamente campos anidados
getNearbyProvidersByServiceId(): Observable<ServiceProvider[]> {
  // ...
  map(items => items.map(item => ({
    ...item,
    avatar: item.provider?.avatar || item.avatar,
    full_name: item.provider?.full_name || item.full_name,
    is_available: item.is_available ?? true,
    service_category: item.service_category ?? {...}, // construye objeto
    distance_km: item.distance ?? item.distance_km
  })))
}
```

---

## 🎯 Interfaces y Modelos

### ProviderProfile (Compartido)
```typescript
// Ambos proyectos usan modelo similar desde core/models/provider.model.ts
interface ProviderProfile {
  id: number;
  user_id: number;
  full_name: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  rating_avg?: number;
  email?: string;
  status?: 'ACTIVE' | 'PENDING' | 'REJECTED';
  is_available?: boolean;
  address?: string;
  total_reviews?: number;
  validation_status?: 'pending' | 'approved' | 'rejected';
  has_premium?: boolean;
  business_name?: string;
  services?: ServiceProvider[];  // Solo en Web (detailed endpoint)
}
```

### ServiceProvider (Ligeramente diferente)

#### Web:
```typescript
interface ServiceProvider {
  id: number;
  provider_id: number;
  service_id: number;
  business_name: string;
  description?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone: string;
  hourly_rate?: number;
  is_available: boolean;
  validation_status: string;
  rating_avg?: number;
  total_reviews?: number;
  service_category?: ServiceCategory;
  provider?: ProviderProfile;
  distance_km?: number;
  avatar?: string;
  full_name?: string;
  service_category_name?: string;  // Campos planos del backend
  service_icon?: string;
}
```

#### Móvil:
```typescript
interface ProviderServices {  // Nombre diferente
  id: number;
  provider_id: number;
  service_category_id: number;  // ← Nombre diferente
  business_name: string;
  description: string;
  hourly_rate: number;
  is_available: boolean;
  validation_status: string;
  service_category?: {
    id: number;
    name: string;
    icon?: string;
  };
  created_at?: string;
}

interface ServiceProviderData {  // Modelo expandido
  id: number;
  provider_id: number;
  service_id: number;  // ← Coincide con Web
  business_name: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  hourly_rate: number;
  is_available: boolean;
  validation_status: string;
  rating_avg: number;
  total_reviews: number;
  created_at: string;
  service_category?: {
    id: number;
    name: string;
    description: string;
    icon: string;
  };
}
```

### ProviderStats (Idéntico)
```typescript
interface ProviderStats {
  total_services: number;
  active_services: number;
  pending_services: number;
  total_bookings: number;
  completed_bookings: number;
  pending_bookings: number;
  total_earnings: number;
  average_rating: number;
  profile_views: number;
  service_views: number;
  zone_searches: number;
}
```

---

## 📊 Tabla de Cobertura Funcional

| Funcionalidad | Web | Móvil Principal | Móvil Client | Móvil Booking | Móvil Validation | Móvil Shared |
|---------------|-----|----------------|--------------|---------------|------------------|--------------|
| **Perfil** |
| Get perfil propio | ✅ | ✅ | - | - | - | ✅ |
| Get perfil de otro provider | ✅ | ❌ | - | - | - | ✅ |
| Get perfil detallado (con servicios) | ✅ | ❌ | - | - | - | - |
| Actualizar perfil | ✅ | ✅ | - | - | - | ✅ |
| Validar identidad | ✅ | ❌ | - | - | ✅ | - |
| **Servicios Publicados** |
| Listar mis servicios | ✅ | ✅ | - | - | - | ✅ |
| Listar servicios de provider | ✅ | ✅ | - | - | - | - |
| Obtener servicio específico | - | ✅ | - | - | - | ✅ |
| Crear servicio | ✅ | ✅ | - | - | - | ✅ |
| Actualizar servicio | ✅ | ✅ | - | - | - | ✅ |
| Eliminar servicio | ✅ | ✅ | - | - | - | ✅ |
| Toggle disponibilidad | - | ✅ | - | - | - | - |
| **Horarios** |
| Working hours (horarios generales) | ✅ | ❌ | - | - | - | - |
| Service schedules (horarios por servicio) | ✅ | ❌ | - | - | - | - |
| Available slots (slots reales) | ✅ | ❌ | - | - | - | - |
| **Búsqueda Geoespacial** |
| Providers cercanos | ✅ | - | ✅ | - | - | ✅ |
| Providers por categoría | ✅ | - | ✅ | - | - | - |
| Búsqueda por texto | ✅ | - | - | - | - | ✅ |
| Formato GeoJSON | - | - | ✅ | - | - | - |
| **Reservas** |
| Listar reservas | - | ✅ | - | ✅ | - | - |
| Aceptar reserva | - | ✅ | - | ✅ | - | - |
| Rechazar reserva | - | ✅ | - | ✅ | - | - |
| **Estadísticas** |
| Stats del provider | ✅ | ✅ | - | - | - | - |
| **Otros** |
| Registro de provider | - | ✅ | - | - | - | - |
| Providers destacados | - | - | - | - | - | ✅ |

**Leyenda:**
- ✅ Implementado
- ❌ NO implementado
- `-` No aplica

---

## 🚨 Recomendaciones

### 1. CRÍTICO: Implementar Gestión de Horarios en Móvil

**Problema:** Sistema de reservas incompleto — no se pueden gestionar horarios.

**Solución:**
```typescript
// Agregar a provider.service.ts móvil:

// Working Hours
getMyWorkingHours(): Observable<ProviderWorkingHours[]> {
  return this.http.get<ProviderWorkingHours[]>(`${this.apiUrl}/working-hours/me`);
}

saveWorkingHours(data: ProviderWorkingHours): Observable<ProviderWorkingHours> {
  return this.http.post<ProviderWorkingHours>(`${this.apiUrl}/working-hours/me`, data);
}

getProviderWorkingHours(providerId: number): Observable<ProviderWorkingHours[]> {
  return this.http.get<ProviderWorkingHours[]>(`${this.apiUrl}/working-hours/provider/${providerId}`);
}

// Service Schedules
saveServiceSchedule(
  providerId: number,
  serviceProviderId: number,
  data: { day_of_week: number; start_time: string; end_time: string; is_available: boolean }
): Observable<any> {
  return this.http.post(
    `${this.apiUrl}/providers/${providerId}/services/${serviceProviderId}/schedules`,
    data
  );
}

getServiceSchedules(providerId: number, serviceProviderId: number): Observable<any[]> {
  return this.http.get<any[]>(
    `${this.apiUrl}/providers/${providerId}/services/${serviceProviderId}/schedules`
  );
}

// Available Slots
getAvailableSlotsByService(
  providerId: number,
  serviceProviderId: number,
  date: string
): Observable<{ date: string; service_provider_id: number; slots: { time: string; available: boolean }[] }> {
  return this.http.get<any>(
    `${this.apiUrl}/providers/${providerId}/services/${serviceProviderId}/available-slots`,
    { params: { date } }
  );
}
```

---

### 2. CRÍTICO: Eliminar Servicio Legacy

**Problema:** `shared/provider.service.ts` usa endpoints **NO compatibles** con backend.

**Acción:**
1. ✅ Identificar usos de `shared/provider.service.ts` en el código
2. ✅ Migrar a `provider/services/provider.service.ts`
3. ✅ Eliminar archivo legacy

**Comando:**
```bash
# Buscar referencias
grep -r "shared/services/provider.service" src/app/

# Verificar que no hay importaciones
```

---

### 3. ALTO: Consolidar Servicios Fragmentados

**Problema:** Lógica dispersa en 5 archivos.

**Propuesta:** Seguir patrón Web — servicio monolítico con submódulos internos.

**Estructura Propuesta:**
```typescript
// provider.service.ts (CONSOLIDADO)
export class ProviderService {
  // PERFIL
  getMyProfile()
  updateProfile()
  validateIdentity()
  
  // SERVICIOS
  getMyServices()
  createService()
  updateService()
  deleteService()
  
  // HORARIOS (nuevo)
  getMyWorkingHours()
  saveWorkingHours()
  getAvailableSlots()
  
  // BÚSQUEDA GEOESPACIAL (migrar desde client-provider.service)
  getNearbyProviders()
  getNearbyProvidersByServiceId()
  searchProviders()
  
  // RESERVAS (migrar desde provider-booking.service)
  getProviderBookings()
  acceptBooking()
  rejectBooking()
  
  // ESTADÍSTICAS
  getProviderStats()
}
```

**Beneficios:**
- ✅ Un único import
- ✅ Caché centralizado
- ✅ Menor duplicación
- ✅ Más fácil mantener

---

### 4. MEDIO: Estandarizar Endpoints

**Problema:** Inconsistencias entre Web y Móvil.

**Endpoints a Estandarizar:**

| Operación | Endpoint Estándar (Backend) |
|-----------|---------------------------|
| Crear servicio | `POST /providers/services` |
| Actualizar servicio | `PUT /providers/{pid}/services/{sid}` |
| Eliminar servicio | `DELETE /providers/services/{id}` |
| Obtener servicios | `GET /providers/services/{providerId}` |

**Acción:**
- Revisar documentación de backend (Swagger/OpenAPI)
- Actualizar móvil para usar endpoints correctos
- Eliminar variantes `/provider-services/` si no son necesarias

---

### 5. MEDIO: Implementar Perfil Detallado en Móvil

**Problema:** Móvil no puede obtener perfil con servicios embebidos.

**Endpoint Faltante:**
```typescript
getProviderDetailedProfile(id: number): Observable<ProviderProfile> {
  return this.http.get<ProviderProfile>(`${this.apiUrl}/providers/${id}/detailed`);
}
```

**Beneficio:**
- Una sola llamada HTTP en lugar de dos
- Menor latencia en pantallas de perfil

---

### 6. BAJO: Mejorar Mapeo de Datos

**Problema:** Web mapea campos anidados automáticamente, móvil no.

**Solución:** Agregar función helper en móvil:
```typescript
private mapServiceProvider(item: any): ServiceProvider {
  return {
    ...item,
    avatar: item.provider?.avatar || item.avatar,
    full_name: item.provider?.full_name || item.full_name,
    is_available: item.is_available ?? true,
    rating_avg: item.rating_avg ?? undefined,
    total_reviews: item.total_reviews ?? undefined,
    hourly_rate: item.hourly_rate ?? undefined,
    service_category: item.service_category ?? (item.service_category_name ? {
      id: item.service_id,
      name: item.service_category_name,
      icon: item.service_icon ?? null
    } : undefined),
    distance_km: item.distance ?? item.distance_km,
    description: item.description ?? undefined
  };
}
```

---

### 7. BAJO: Documentar Interfaces

**Problema:** Nombres de interfaces diferentes entre proyectos.

**Propuesta:** Unificar nomenclatura:

| Web | Móvil | Propuesta Estándar |
|-----|-------|-------------------|
| `ServiceProvider` | `ProviderServices` | `ServiceProvider` |
| - | `ServiceProviderData` | `ServiceProviderDetailed` |

---

## 📈 Métricas de Comparación

| Métrica | Web | Móvil (Total) |
|---------|-----|---------------|
| **Archivos de servicio** | 1 | 5 |
| **Métodos públicos** | 28 | ~45 (con duplicados) |
| **Endpoints únicos** | 22 | ~30 (con inconsistencias) |
| **Signals** | 4 | 4 |
| **Funcionalidad horarios** | ✅ Completa | ❌ Ausente |
| **Búsqueda geoespacial** | ✅ Integrada | ⚠️ Separada |
| **GeoJSON** | - | ✅ Implementado |
| **Caché in-flight** | - | ✅ Implementado |
| **Perfil detallado** | ✅ | ❌ |
| **Código legacy** | - | ⚠️ 1 archivo |

---

## ✅ Conclusión

### Fortalezas Web
- ✅ Arquitectura consolidada y limpia
- ✅ Funcionalidad completa de horarios
- ✅ Endpoints consistentes con backend
- ✅ Mapeo avanzado de datos
- ✅ Perfil detallado con servicios embebidos

### Fortalezas Móvil
- ✅ Caché in-flight request deduplication
- ✅ Formato GeoJSON para mapas
- ✅ Servicios especializados (validación, bookings)

### Debilidades Móvil
- ❌ **CRÍTICO:** Sistema de horarios NO implementado
- ⚠️ Arquitectura fragmentada (5 archivos)
- ⚠️ Código legacy con endpoints incorrectos
- ⚠️ Duplicación de lógica
- ⚠️ Endpoints inconsistentes

### Prioridades de Acción

**P0 (Crítico - Bloquea funcionalidad):**
1. ✅ Implementar gestión de horarios en móvil
2. ✅ Eliminar `shared/provider.service.ts` legacy

**P1 (Alto - Mejora arquitectura):**
3. ✅ Consolidar servicios fragmentados
4. ✅ Estandarizar endpoints con backend

**P2 (Medio - Mejora calidad):**
5. ✅ Implementar perfil detallado
6. ✅ Mejorar mapeo de datos

**P3 (Bajo - Mantenibilidad):**
7. ✅ Documentar y unificar interfaces

---

**Generado:** 15 de mayo de 2026  
**Última actualización:** 15 de mayo de 2026

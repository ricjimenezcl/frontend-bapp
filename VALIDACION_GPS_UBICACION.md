# Validación de GPS y Ubicación - BAPP Mobile

## 📍 Descripción

Sistema de validación de GPS y permisos de ubicación que verifica automáticamente el estado del GPS, permisos de usuario y muestra alertas apropiadas para guiar al usuario a habilitar las configuraciones necesarias.

## 🚀 Implementación

### Archivos Creados

#### 1. **GpsValidationService** (`core/services/gps-validation.service.ts`)

Servicio centralizado para validar y gestionar permisos de ubicación y estado del GPS.

**Características principales:**
- ✅ Verifica permisos de ubicación
- ✅ Detecta si el GPS está habilitado
- ✅ Solicita permisos cuando es necesario
- ✅ Muestra alertas contextuales según el estado
- ✅ Redirige a configuración del dispositivo (iOS/Android)
- ✅ Soporte para web con navigator.geolocation

**Métodos públicos:**

```typescript
// Verificar estado completo del GPS
async checkGPSStatus(): Promise<GPSStatus>

// Solicitar permisos de ubicación
async requestLocationPermissions(): Promise<boolean>

// Mostrar alerta según estado
async showGPSAlert(status: GPSStatus): Promise<void>

// Validar GPS y mostrar alertas si es necesario
async validateAndRequestGPS(): Promise<boolean>

// Verificar disponibilidad sin alertas
async isGPSAvailable(): Promise<boolean>
```

**Interface GPSStatus:**

```typescript
interface GPSStatus {
  hasPermission: boolean;    // Tiene permisos otorgados
  isEnabled: boolean;        // GPS está habilitado
  canRequest: boolean;       // Puede solicitar permisos
  message?: string;          // Mensaje descriptivo del estado
}
```

### Archivos Modificados

#### 2. **GeoLocationService** (`shared/services/geo-location.service.ts`)

Servicio Capacitor para geolocalización nativa (iOS/Android).

**Cambios:**
- ✅ Inyecta `GpsValidationService`
- ✅ Parámetro opcional `validateGPS` en métodos
- ✅ Valida GPS antes de obtener ubicación

**Uso actualizado:**

```typescript
// Con validación (recomendado)
const position = await this.geoLocationService.getCurrentLocation();

// Sin validación (solo para casos específicos)
const position = await this.geoLocationService.getCurrentLocation(false);

// Watch location con validación
const watchId = await this.geoLocationService.watchLocation();

// Watch location sin validación
const watchId = await this.geoLocationService.watchLocation(false);
```

#### 3. **LocationService** (`core/services/location.service.ts`)

Servicio para geolocalización web (navigator.geolocation API).

**Cambios:**
- ✅ Inyecta `GpsValidationService`
- ✅ Parámetro opcional `validateGPS` en getCurrentPosition
- ✅ Valida permisos antes de obtener ubicación

**Uso actualizado:**

```typescript
// Con validación (recomendado)
this.locationService.getCurrentPosition().subscribe({
  next: (location) => {
    console.log('Ubicación obtenida:', location);
  },
  error: (error) => {
    console.error('Error:', error);
  }
});

// Sin validación
this.locationService.getCurrentPosition(false).subscribe(...);
```

#### 4. **Estilos** (`theme/components.scss`)

Añadido clase `.gps-alert` para alertas de GPS con mejor spacing y formato.

### Dependencias Agregadas

```json
"@capacitor/app": "6.0.1"
```

Requerido para abrir la configuración del dispositivo.

## 📱 Flujo de Usuario

### Caso 1: Permisos No Otorgados (Primera Vez)

1. Usuario intenta usar función que requiere ubicación
2. Se muestra alerta: "📍 Permiso de Ubicación"
3. Mensaje: "Esta función necesita acceso a tu ubicación"
4. Botones: [Cancelar] [Permitir]
5. Si presiona "Permitir" → Solicita permisos del sistema

### Caso 2: Permisos Denegados Permanentemente

1. Usuario denegó permisos previamente
2. Se muestra alerta: "⚠️ Permisos Denegados"
3. Mensaje: "Debes habilitar permisos en configuración"
4. Botones: [Cancelar] [Ir a Configuración]
5. Si presiona "Ir a Configuración" → Abre settings del dispositivo

### Caso 3: GPS Deshabilitado

1. Tiene permisos pero GPS está apagado
2. Se muestra alerta: "📡 GPS Deshabilitado"
3. Mensaje: "Por favor, activa el GPS"
4. Botones: [Cancelar] [Ir a Configuración]
5. Si presiona "Ir a Configuración" → Abre settings de ubicación

### Caso 4: Todo Correcto

1. Permisos otorgados y GPS habilitado
2. No se muestra alerta
3. Función continúa normalmente

## 🔧 Ejemplo de Integración

### Flujo de Usuario Actualizado

**Escenarios:**

1. **Permisos no otorgados (primera vez)**:
   - Alert: "📍 Permiso de Ubicación"
   - Botones: [Cancelar] [Permitir]
   - Acción "Permitir": Solicita permisos del sistema

2. **Permisos denegados permanentemente**:
   - Alert: "⚠️ Permisos Denegados"
   - Mensaje: Instrucciones para habilitar manualmente
   - Botones: [Cancelar] [Ver Instrucciones]
   - Acción "Ver Instrucciones": Muestra pasos detallados según plataforma

3. **GPS deshabilitado**:
   - Alert: "📡 GPS Deshabilitado"
   - Mensaje: El GPS está desactivado
   - Botones: [Cancelar] [Ver Instrucciones]
   - Acción "Ver Instrucciones": Muestra pasos para activar GPS

4. **Todo correcto**:
   - No muestra alertas
   - Función continúa normalmente

### Instrucciones Mostradas

**iOS (Permisos):**
```
1. Abre Configuración
2. Busca BAPP
3. Toca Ubicación
4. Selecciona "Mientras usas la app"
```

**Android (Permisos):**
```
1. Abre Configuración
2. Toca Aplicaciones
3. Busca BAPP
4. Toca Permisos
5. Toca Ubicación
6. Selecciona "Permitir solo mientras usas la app"
```

**Android (GPS):**
```
1. Desliza hacia abajo desde la parte superior
2. Mantén presionado el ícono de Ubicación
3. Activa "Usar ubicación"
```

**iOS (GPS):**
```
1. Abre Configuración
2. Toca Privacidad y seguridad
3. Toca Servicios de ubicación
4. Activa Servicios de ubicación
```

## 🔧 Ejemplo de Integración

### En un Componente

```typescript
import { Component, inject } from '@angular/core';
import { GeoLocationService } from '../../services/geo-location.service';
import { GpsValidationService } from '../../services/gps-validation.service';

@Component({
  selector: 'app-map-page',
  templateUrl: './map-page.html'
})
export class MapPage {
  private geoLocationService = inject(GeoLocationService);
  private gpsValidationService = inject(GpsValidationService);

  // Opción 1: Validación automática (recomendado)
  async getMyLocation() {
    try {
      const position = await this.geoLocationService.getCurrentLocation();
      console.log('Ubicación:', position);
    } catch (error) {
      console.error('Error obteniendo ubicación:', error);
    }
  }

  // Opción 2: Validación manual
  async getMyLocationManual() {
    // Validar primero
    const isGPSReady = await this.gpsValidationService.validateAndRequestGPS();
    
    if (!isGPSReady) {
      console.log('Usuario canceló o GPS no disponible');
      return;
    }

    // Luego obtener ubicación sin validación adicional
    try {
      const position = await this.geoLocationService.getCurrentLocation(false);
      console.log('Ubicación:', position);
    } catch (error) {
      console.error('Error obteniendo ubicación:', error);
    }
  }

  // Opción 3: Solo verificar disponibilidad
  async checkGPSBeforeAction() {
    const isAvailable = await this.gpsValidationService.isGPSAvailable();
    
    if (!isAvailable) {
      // Mostrar mensaje personalizado o deshabilitar funcionalidad
      console.log('GPS no disponible');
      return;
    }

    // Continuar con la acción
    this.performLocationAction();
  }
}
```

### En un Servicio

```typescript
import { Injectable, inject } from '@angular/core';
import { GeoLocationService } from './geo-location.service';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private geoLocationService = inject(GeoLocationService);

  async searchNearby() {
    try {
      // Validación automática incluida
      const position = await this.geoLocationService.getCurrentLocation();
      
      // Usar posición para búsqueda
      return this.performSearch(position.latitude, position.longitude);
    } catch (error) {
      // Error ya manejado por validación
      console.error('No se pudo obtener ubicación:', error);
      return this.performSearchWithoutLocation();
    }
  }
}
```

## 🌐 Compatibilidad Web

El servicio funciona tanto en móvil (iOS/Android) como en web:

- **Móvil**: Usa `@capacitor/geolocation` y `@capacitor/app`
- **Web**: Usa `navigator.geolocation` del navegador
- **Alertas**: Se adaptan automáticamente según plataforma

## ⚙️ Configuración en AndroidManifest.xml

Asegúrate de tener los permisos necesarios:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-feature android:name="android.hardware.location.gps" />
```

## 📝 Configuración en Info.plist (iOS)

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Necesitamos tu ubicación para mostrarte servicios cercanos</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Necesitamos tu ubicación para mostrarte servicios cercanos</string>
```

## 🎨 Personalización de Alertas

Puedes personalizar los mensajes editando `gps-validation.service.ts`:

```typescript
async showGPSAlert(status: GPSStatus): Promise<void> {
  let header = 'Tu Título';
  let message = 'Tu mensaje personalizado';
  let buttons = [
    { text: 'No', role: 'cancel' },
    { text: 'Sí', handler: () => { /* acción */ } }
  ];
  
  const alert = await this.alertController.create({
    header,
    message,
    buttons,
    cssClass: 'gps-alert custom-alert' // Agrega clases CSS
  });

  await alert.present();
}
```

## 🧪 Testing

```typescript
describe('GpsValidationService', () => {
  it('debe verificar permisos correctamente', async () => {
    const status = await service.checkGPSStatus();
    expect(status.hasPermission).toBeDefined();
    expect(status.isEnabled).toBeDefined();
  });

  it('debe solicitar permisos', async () => {
    const granted = await service.requestLocationPermissions();
    expect(typeof granted).toBe('boolean');
  });

  it('debe validar GPS completo', async () => {
    const isReady = await service.validateAndRequestGPS();
    expect(typeof isReady).toBe('boolean');
  });
});
```

## 📋 Checklist de Implementación

- [x] Crear `GpsValidationService`
- [x] Actualizar `GeoLocationService` con validación
- [x] Actualizar `LocationService` con validación
- [x] Agregar estilos para alertas GPS
- [x] Instalar `@capacitor/app`
- [ ] Actualizar componentes que usan ubicación
- [ ] Verificar permisos en AndroidManifest.xml
- [ ] Verificar permisos en Info.plist
- [ ] Sincronizar capacitor: `npx cap sync`
- [ ] Probar en dispositivo físico (emuladores pueden tener GPS simulado)

## 🔄 Migración de Código Existente

**Antes:**
```typescript
const position = await this.geoLocationService.getCurrentLocation();
```

**Después:**
```typescript
// Validación automática incluida
const position = await this.geoLocationService.getCurrentLocation();

// O sin validación si ya la hiciste antes
const position = await this.geoLocationService.getCurrentLocation(false);
```

**No requiere cambios** si ya usabas el método normalmente. La validación ahora es parte del flujo estándar.

## 🐛 Troubleshooting

### Error: "Cannot find module '@capacitor/app'"

```bash
npm install @capacitor/app
npx cap sync
```

### Alertas no se muestran en iOS

Verifica que Info.plist tenga las claves de ubicación correctas.

### GPS parece habilitado pero falla en Android

- Verifica permisos en Settings > Apps > Tu App > Permissions
- Asegúrate de que Location esté activado en el dispositivo
- Prueba con `enableHighAccuracy: false` temporalmente

### En web siempre dice "GPS no disponible"

- El navegador debe tener permisos de ubicación
- HTTPS es requerido (excepto localhost)
- Algunos navegadores bloquean ubicación si el usuario la denegó previamente

## 📚 Referencias

- [Capacitor Geolocation](https://capacitorjs.com/docs/apis/geolocation)
- [Capacitor App](https://capacitorjs.com/docs/apis/app)
- [MDN Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)

## ✅ Resultado Esperado

Después de implementar este sistema:

1. ✅ Los usuarios reciben guía clara cuando GPS/permisos están deshabilitados
2. ✅ Pueden navegar directamente a configuración con un botón
3. ✅ Menos errores silenciosos de ubicación
4. ✅ Mejor experiencia de usuario (UX)
5. ✅ Código más robusto y mantenible
6. ✅ Funciona tanto en móvil como en web

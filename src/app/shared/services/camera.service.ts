import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo, CameraDirection } from '@capacitor/camera';

@Injectable({
  providedIn: 'root'
})
export class CameraService {

  constructor() { }

  /**
   * Tomar foto con la cámara
   */
  async takePicture(): Promise<string> {
    const image = await Camera.getPhoto({
      quality: 80,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera
    });

    return image.dataUrl!;
  }

    /**
   * Abre la cámara del dispositivo y devuelve la imagen como Blob JPEG.
   * @param direction 'front' para selfie, 'rear' para documento.
   */
  async takePhotoAsBlob(direction: 'front' | 'rear' = 'rear'): Promise<Blob> {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        direction: direction === 'front' ? CameraDirection.Front : CameraDirection.Rear,
        promptLabelHeader: direction === 'front' ? 'Toma una selfie' : 'Toma foto del documento',
        promptLabelPhoto: 'Tomar foto',
        promptLabelPicture: 'Usar foto',
        promptLabelCancel: 'Cancelar'
      });
      // Convertir base64 a Blob
      const res = await fetch(image.dataUrl!);
      return await res.blob();
    } catch (err) {
      throw new Error('No se pudo acceder a la cámara o la foto fue cancelada.');
    }
  }

  /**
   * Seleccionar foto de la galería
   */
  async selectFromGallery(): Promise<string> {
    const image = await Camera.getPhoto({
      quality: 80,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos
    });

    return image.dataUrl!;
  }

  /**
   * Convertir foto a base64
   */
  private async readAsBase64(photo: Photo): Promise<string> {
    const response = await fetch(photo.webPath!);
    const blob = await response.blob();

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject('Error converting to base64');
        }
      };
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Extraer solo la parte base64 de un data URL
   */
  extractBase64(dataUrl: string): string {
    if (dataUrl.includes(',')) {
      return dataUrl.split(',')[1];
    }
    return dataUrl;
  }

  /**
   * Comprimir imagen para reducir tamaño
   */
  async compressImage(base64Data: string, quality: number = 0.7): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Redimensionar si es muy grande
        const maxWidth = 800;
        const maxHeight = 800;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      
      img.onerror = reject;
      img.src = base64Data;
    });
  }

  /**
   * Convertir base64 a data URL para visualización
   */
  base64ToDataUrl(base64: string, mimeType: string = 'image/jpeg'): string {
    return `data:${mimeType};base64,${base64}`;
  }

  /**
   * Comprimir imagen para blob (avatares)
   */
  async compressImageForBlob(base64Data: string, maxWidth: number = 400, quality: number = 0.5): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = base64Data;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // console.log(`🔧 Imagen original: ${width}x${height}`);

        // Redimensionar manteniendo aspect ratio
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        // console.log(`🔧 Imagen comprimida: ${width}x${height}`);

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo obtener el contexto del canvas'));
          return;
        }

        // Configurar para mejor calidad de redimensionamiento
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';

        // Dibujar imagen redimensionada
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a JPEG con calidad ajustable
        try {
          const compressedData = canvas.toDataURL('image/jpeg', quality);
          // console.log(`✅ Imagen comprimida. Longitud: ${compressedData.length} caracteres`);
          resolve(compressedData);
        } catch (error) {
          // Fallback: devolver la original si hay error
          console.warn('⚠️ Error en compresión, usando imagen original');
          resolve(base64Data);
        }
      };
      
      img.onerror = () => {
        console.error('❌ Error al cargar la imagen para compresión');
        reject(new Error('Error al cargar la imagen'));
      };
    });
  }

  /**
   * Calcular tamaño aproximado en bytes del base64
   */
  getBase64Size(base64String: string): number {
    // Fórmula: (n * 3) / 4 - padding
    const padding = (base64String.match(/=/g) || []).length;
    return (base64String.length * 3) / 4 - padding;
  }

  /**
   * Redimensionar imagen manteniendo aspect ratio
   */
  async resizeImage(base64Data: string, maxWidth: number, maxHeight: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        
        // Calcular nuevas dimensiones manteniendo aspect ratio
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      
      img.onerror = reject;
      img.src = base64Data;
    });
  }

  /**
   * Rotar imagen
   */
  async rotateImage(base64Data: string, degrees: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Ajustar dimensiones del canvas para la rotación
        if (degrees === 90 || degrees === 270) {
          canvas.width = img.height;
          canvas.height = img.width;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        
        ctx?.translate(canvas.width / 2, canvas.height / 2);
        ctx?.rotate((degrees * Math.PI) / 180);
        ctx?.drawImage(img, -img.width / 2, -img.height / 2);
        
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      
      img.onerror = reject;
      img.src = base64Data;
    });
  }
}

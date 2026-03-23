import { Injectable } from '@angular/core';
import { FeedbackService } from './feedback.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

interface CloudinarySignature {
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
  upload_preset: string;
  folder: string;
  public_id: string;
}

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface ImageValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class DocumentUploadService {
  private readonly API_URL = `${environment.apiUrl}/documents`;
  private uploadProgress = new Subject<UploadProgress>();
  public uploadProgress$ = this.uploadProgress.asObservable();

  // Image validation constraints
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly MIN_WIDTH = 200;
  private readonly MIN_HEIGHT = 200;
  private readonly MAX_WIDTH = 8000;
  private readonly MAX_HEIGHT = 8000;

  constructor(private http: HttpClient, private feedback: FeedbackService) {}

  /**
   * Validate image before upload
   * Checks format, size, dimensions
   */
  async validateImage(file: File): Promise<ImageValidationResult> {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum 5MB`
      };
    }

    // Check file format
    if (!this.ALLOWED_FORMATS.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid format. Allowed: JPEG, PNG, WebP. Got: ${file.type}`
      };
    }

    // Check image dimensions
    try {
      await this.feedback.showLoading('Validando imagen...');
      const dimensions = await this.getImageDimensions(file);
      await this.feedback.hideLoading();
      if (dimensions.width < this.MIN_WIDTH || dimensions.height < this.MIN_HEIGHT) {
        return {
          valid: false,
          error: `Image too small (${dimensions.width}x${dimensions.height}). Minimum: 200x200`
        };
      }
      if (dimensions.width > this.MAX_WIDTH || dimensions.height > this.MAX_HEIGHT) {
        return {
          valid: false,
          error: `Image too large (${dimensions.width}x${dimensions.height}). Maximum: 8000x8000`
        };
      }
      // Warn if image is very small (but valid)
      const warnings: string[] = [];
      if (dimensions.width < 400 || dimensions.height < 400) {
        warnings.push('Image is small. For better face detection, use at least 400x400 pixels');
      }
      return {
        valid: true,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      await this.feedback.hideLoading();
      return {
        valid: false,
        error: `Failed to validate image dimensions: ${error}`
      };
    }
  }

  /**
   * Get image dimensions
   */
  private getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const img = new Image();
        
        img.onload = () => {
          resolve({
            width: img.naturalWidth,
            height: img.naturalHeight
          });
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        
        img.src = event.target?.result as string;
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get upload signature from backend for direct Cloudinary upload
   */
  generateUploadSignature(documentType: string): Observable<CloudinarySignature> {
    const formData = new FormData();
    formData.append('document_type', documentType);
    
    return this.http.post<CloudinarySignature>(
      `${this.API_URL}/generate-upload-signature`,
      formData
    );
  }

  /**
   * Upload file directly to Cloudinary
   */
  async uploadToCloudinary(
    file: File,
    signature: CloudinarySignature
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // Validate signature
      if (!signature.upload_preset) {
        console.error('[ERROR] Missing upload_preset in signature:', signature);
        reject(new Error('Invalid signature: missing upload_preset'));
        return;
      }

      if (!signature.cloud_name) {
        console.error('[ERROR] Missing cloud_name in signature:', signature);
        reject(new Error('Invalid signature: missing cloud_name'));
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', signature.upload_preset);
      formData.append('folder', signature.folder);

      /* console.log('[UPLOAD_START] Uploading to Cloudinary with parameters:', {
        cloud_name: signature.cloud_name,
        upload_preset: signature.upload_preset,
        folder: signature.folder,
        public_id: signature.public_id,
        file: {
          name: file.name,
          size: file.size,
          type: file.type
        }
      }); */

      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          this.uploadProgress.next({
            loaded: event.loaded,
            total: event.total,
            percentage
          });
        }
      });

      xhr.addEventListener('load', () => {
        // console.log('[UPLOAD_RESPONSE] Status:', xhr.status);
        // console.log('[UPLOAD_RESPONSE] Body:', xhr.responseText);
        
        if (xhr.status === 200) {
          // console.log('[UPLOAD_SUCCESS] File uploaded successfully');
          resolve(JSON.parse(xhr.responseText));
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            const errorMessage = errorResponse.error?.message || xhr.statusText;
            console.error('[UPLOAD_ERROR] Cloudinary error:', errorMessage);
            reject(new Error(`Upload failed: ${errorMessage}`));
          } catch (e) {
            console.error('[UPLOAD_ERROR] Failed to parse error response:', xhr.responseText);
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
          }
        }
      });

      xhr.addEventListener('error', () => {
        console.error('[UPLOAD_ERROR] XHR error event');
        reject(new Error('Upload failed'));
      });

      xhr.addEventListener('abort', () => {
        console.error('[UPLOAD_ERROR] XHR abort event');
        reject(new Error('Upload aborted'));
      });

      const uploadUrl = `https://api.cloudinary.com/v1_1/${signature.cloud_name}/image/upload`;
      // console.log('[UPLOAD_URL]', uploadUrl);
      
      xhr.open('POST', uploadUrl, true);
      xhr.send(formData);
    });
  }

  /**
   * Save document reference in backend database
   */
  saveDocumentReference(
    documentType: string,
    cloudinaryPublicId: string,
    cloudinaryUrl: string,
    fileSize: number,
    mimeType: string
  ): Observable<any> {
    const formData = new FormData();
    formData.append('document_type', documentType);
    formData.append('cloudinary_public_id', cloudinaryPublicId);
    formData.append('cloudinary_url', cloudinaryUrl);
    formData.append('file_size', fileSize.toString());
    formData.append('mime_type', mimeType);

    return this.http.post(
      `${this.API_URL}/save-document`,
      formData
    );
  }

  /**
   * Complete upload flow: direct upload to backend
   * Backend handles Cloudinary upload with signed credentials
   */
  uploadDocument(file: File, documentType: string): Observable<any> {
    return new Observable(observer => {
      this.validateImage(file)
        .then(validation => {
          if (!validation.valid) {
            observer.error(new Error(validation.error));
            return;
          }
          if (validation.warnings && validation.warnings.length > 0) {
            console.warn('[UPLOAD_DOCUMENT] Warnings:', validation.warnings);
          }
          const formData = new FormData();
          formData.append('document_type', documentType);
          formData.append('file', file);
          this.http.post(`${this.API_URL}/upload-signed`, formData).subscribe({
            next: (response) => {
              observer.next(response);
              observer.complete();
            },
            error: (err) => {
              console.error('Document upload failed:', err);
              observer.error(err);
            }
          });
        })
        .catch(error => {
          observer.error(error);
        });
    });
  }

  /**
   * Complete upload flow (legacy): get signature -> upload -> save reference
   * Use only if you need direct Cloudinary uploads with unsigned preset
   */
  uploadDocumentDirectToCloudinary(file: File, documentType: string): Observable<any> {
    return new Observable(observer => {
      this.generateUploadSignature(documentType).subscribe({
        next: async (signature) => {
          if (!signature) {
            observer.error(new Error('Failed to get upload signature'));
            return;
          }
          try {
            const cloudinaryResponse = await this.uploadToCloudinary(file, signature);
            this.saveDocumentReference(
              documentType,
              cloudinaryResponse.public_id,
              cloudinaryResponse.secure_url,
              cloudinaryResponse.bytes,
              cloudinaryResponse.resource_type === 'image' ? file.type : cloudinaryResponse.resource_type
            ).subscribe({
              next: (saveResponse) => {
                observer.next(saveResponse);
                observer.complete();
              },
              error: (err) => {
                observer.error(err);
              }
            });
          } catch (error) {
            observer.error(error);
          }
        },
        error: (err) => {
          observer.error(err);
        }
      });
    });
  }

  /**
   * Get face preview before verification
   * Returns base64 encoded images of detected faces
   */
  getFacePreview(selfieDocumentId: number, idDocumentId: number): Observable<any> {
    return this.http.post(`${this.API_URL}/face-preview`, {
      selfie_document_id: selfieDocumentId,
      id_document_id: idDocumentId
    });
  }

  /**
   * Initiate face verification
   * 
   * Sends JSON body (not FormData) to match backend Pydantic model validation.
   * Backend expects: { "selfie_document_id": number, "id_document_id": number }
   */
  initiateVerification(
    selfieDocumentId: number,
    idDocumentId: number
  ): Observable<any> {
    // Send JSON body instead of FormData
    // This matches the Pydantic InitiateVerificationRequest model on the backend
    const requestBody = {
      selfie_document_id: selfieDocumentId,
      id_document_id: idDocumentId
    };

    return this.http.post(
      `${this.API_URL}/initiate-verification`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }

  /**
   * Get current verification status
   */
  getVerificationStatus(): Observable<any> {
    return this.http.get(`${this.API_URL}/verification-status`);
  }

  /**
   * Get current verification status with timeout
   */
  getVerificationStatusWithTimeout(timeoutMs: number): Observable<any> {
    return new Observable(observer => {
      const timeout = setTimeout(() => {
        observer.error(new Error('Timeout exceeded while waiting for verification status'));
      }, timeoutMs);
      this.getVerificationStatus().subscribe({
        next: (status: any) => {
          clearTimeout(timeout);
          observer.next(status);
          observer.complete();
        },
        error: (error: any) => {
          clearTimeout(timeout);
          observer.error(error);
        },
      });
    });
  }

  /**
   * Check if provider can add services
   */
  canAddServices(): Observable<any> {
    return this.http.get(`${this.API_URL}/can-add-services`);
  }

  /**
   * Retry with exponential backoff
   */
  retryWithExponentialBackoff<T>(operation: () => Promise<T>, maxRetries: number): Promise<T> {
    let attempt = 0;
    const execute = (): Promise<T> => {
      return operation().catch((error: any) => {
        if (attempt < maxRetries) {
          attempt++;
          const delay = Math.pow(2, attempt) * 1000;
          return new Promise<void>((resolve) => setTimeout(resolve, delay)).then(execute);
        }
        throw error;
      });
    };
    return execute();
  }
}


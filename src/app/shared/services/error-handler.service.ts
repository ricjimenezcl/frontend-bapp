import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastController } from '@ionic/angular';
import { AppError } from './state.service';

export interface ErrorResponse {
  code: string;
  message: string;
  userMessage: string;
  statusCode: number;
  details?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {
  private toastDismissTimer: any;

  constructor(private toastCtrl: ToastController) {}

  handleError(error: HttpErrorResponse | any): AppError {
    console.error('❌ Error capturado:', error);

    if (error instanceof HttpErrorResponse) {
      return this.handleHttpError(error);
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: 'Ocurrió un error desconocido',
      details: error
    };
  }

  private handleHttpError(error: HttpErrorResponse): AppError {
    switch (error.status) {
      case 0:
        return {
          code: 'NO_CONNECTION',
          message: 'No hay conexión a internet. Verifica tu conexión.'
        };

      case 400:
        return {
          code: 'BAD_REQUEST',
          message: error.error?.detail || 'Solicitud inválida'
        };

      case 401:
        return {
          code: 'UNAUTHORIZED',
          message: 'No autorizado. Por favor inicia sesión nuevamente.'
        };

      case 403:
        return {
          code: 'FORBIDDEN',
          message: 'No tienes permiso para realizar esta acción.'
        };

      case 404:
        return {
          code: 'NOT_FOUND',
          message: 'Recurso no encontrado'
        };

      case 422:
        return {
          code: 'VALIDATION_ERROR',
          message: this.getValidationMessage(error),
          details: error.error
        };

      case 500:
        return {
          code: 'SERVER_ERROR',
          message: 'Error del servidor. Intenta más tarde.'
        };

      case 503:
        return {
          code: 'SERVICE_UNAVAILABLE',
          message: 'El servidor no está disponible. Intenta más tarde.'
        };

      default:
        return {
          code: `HTTP_${error.status}`,
          message: error.message || 'Error desconocido',
          details: error
        };
    }
  }

  private getValidationMessage(error: HttpErrorResponse): string {
    // Manejo de errores de validación en formato FastAPI
    if (Array.isArray(error.error?.detail)) {
      return error.error.detail
        .map((err: any) => {
          if (err.msg) return err.msg;
          if (err.message) return err.message;
          return 'Error de validación';
        })
        .join(', ');
    }

    // Manejo de objeto único
    if (error.error?.detail) {
      return error.error.detail;
    }

    return 'Error de validación';
  }

  async showError(appError: AppError): Promise<void> {
    // Cancelar toast anterior si existe
    if (this.toastDismissTimer) {
      clearTimeout(this.toastDismissTimer);
    }

    const toast = await this.toastCtrl.create({
      message: appError.message,
      duration: 4000,
      position: 'bottom',
      color: 'danger',
      buttons: [
        {
          text: 'Cerrar',
          role: 'cancel'
        }
      ]
    });

    await toast.present();
  }

  async showSuccess(message: string): Promise<void> {
    if (this.toastDismissTimer) {
      clearTimeout(this.toastDismissTimer);
    }

    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: 'success'
    });

    await toast.present();
  }

  processError(error: any): AppError {
    const appError = this.handleError(error);
    this.showError(appError);
    return appError;
  }

  getErrorMessage(error: any): string {
    const appError = this.handleError(error);
    return appError.message;
  }
}

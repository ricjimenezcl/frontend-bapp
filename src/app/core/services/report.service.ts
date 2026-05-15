import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  ReportCreate,
  ReportResponse,
  ReportType,
  ReportedEntityType,
  ReportStatus
} from '../models/report.model';

/**
 * Report Service - Gestión de reportes
 * Permite a los usuarios reportar contenido inapropiado
 */
@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reports`;

  // Estado reactivo
  myReports = signal<ReportResponse[]>([]);
  isLoading = signal(false);

  /**
   * Crear un reporte
   * @param report Datos del reporte
   * @returns Observable con el reporte creado
   */
  createReport(report: ReportCreate): Observable<ReportResponse> {
    this.isLoading.set(true);
    return this.http.post<ReportResponse>(this.apiUrl, report).pipe(
      tap(() => {
        this.isLoading.set(false);
        this.refreshMyReports();
      }),
      catchError(error => {
        this.isLoading.set(false);
        throw error;
      })
    );
  }

  /**
   * Obtener mis reportes como reportante
   * @returns Observable con array de reportes
   */
  getMyReports(): Observable<ReportResponse[]> {
    this.isLoading.set(true);
    return this.http.get<ReportResponse[]>(`${this.apiUrl}/me`).pipe(
      tap(reports => {
        this.myReports.set(reports);
        this.isLoading.set(false);
      }),
      catchError(error => {
        this.isLoading.set(false);
        throw error;
      })
    );
  }

  /**
   * Obtener detalle de un reporte
   * @param reportId ID del reporte
   * @returns Observable con el reporte
   */
  getReportById(reportId: number): Observable<ReportResponse> {
    return this.http.get<ReportResponse>(`${this.apiUrl}/${reportId}`);
  }

  /**
   * Helper: Reportar un usuario/perfil
   * @param userId ID del usuario
   * @param reportType Tipo de reporte
   * @param description Descripción opcional
   * @param evidenceUrls URLs de evidencia opcional
   * @returns Observable con el reporte creado
   */
  reportUser(
    userId: number,
    reportType: ReportType,
    description?: string,
    evidenceUrls?: string[]
  ): Observable<ReportResponse> {
    return this.createReport({
      report_type: reportType,
      reported_entity_type: ReportedEntityType.USER,
      reported_entity_id: userId,
      reported_user_id: userId,
      description,
      evidence_urls: evidenceUrls
    });
  }

  /**
   * Helper: Reportar una reseña
   * @param reviewId ID de la reseña
   * @param reportType Tipo de reporte
   * @param description Descripción opcional
   * @returns Observable con el reporte creado
   */
  reportReview(
    reviewId: number,
    reportType: ReportType,
    description?: string
  ): Observable<ReportResponse> {
    return this.createReport({
      report_type: reportType,
      reported_entity_type: ReportedEntityType.REVIEW,
      reported_entity_id: reviewId,
      description
    });
  }

  /**
   * Helper: Reportar un servicio
   * @param serviceId ID del servicio
   * @param reportType Tipo de reporte
   * @param description Descripción opcional
   * @returns Observable con el reporte creado
   */
  reportService(
    serviceId: number,
    reportType: ReportType,
    description?: string
  ): Observable<ReportResponse> {
    return this.createReport({
      report_type: reportType,
      reported_entity_type: ReportedEntityType.SERVICE,
      reported_entity_id: serviceId,
      description
    });
  }

  /**
   * Helper: Reportar un mensaje de chat
   * @param messageId ID del mensaje
   * @param reportType Tipo de reporte
   * @param description Descripción opcional
   * @returns Observable con el reporte creado
   */
  reportChatMessage(
    messageId: number,
    reportType: ReportType,
    description?: string
  ): Observable<ReportResponse> {
    return this.createReport({
      report_type: reportType,
      reported_entity_type: ReportedEntityType.CHAT_MESSAGE,
      reported_entity_id: messageId,
      description
    });
  }

  /**
   * Refrescar lista de mis reportes
   */
  private refreshMyReports(): void {
    this.getMyReports().subscribe({
      error: (err) => console.error('Error al refrescar reportes:', err)
    });
  }

  /**
   * Limpiar caché de reportes
   */
  clearCache(): void {
    this.myReports.set([]);
  }

  /**
   * Verificar si un usuario ya fue reportado por mí
   * @param userId ID del usuario
   * @returns true si ya fue reportado
   */
  hasReportedUser(userId: number): boolean {
    return this.myReports().some(
      report => 
        report.reported_user_id === userId &&
        report.status !== ReportStatus.DISMISSED
    );
  }

  /**
   * Contar reportes pendientes
   * @returns Número de reportes pendientes
   */
  getPendingReportsCount(): number {
    return this.myReports().filter(
      report => report.status === ReportStatus.PENDING
    ).length;
  }
}

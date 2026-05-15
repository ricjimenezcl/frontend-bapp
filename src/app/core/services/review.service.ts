import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Review, CreateReviewRequest } from '../models/review.model';

/**
 * Review Service - Sincronizado con proyecto WEB
 * Gestiona la creación y obtención de reseñas de proveedores
 */
@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/reviews`;

  /**
   * Crear una nueva reseña para un proveedor
   * @param review Datos de la reseña (booking_id, rating, comment?)
   * @returns Observable con la reseña creada
   */
  createReview(review: CreateReviewRequest): Observable<Review> {
    return this.http.post<Review>(this.apiUrl, review);
  }

  /**
   * Obtener todas las reseñas de un proveedor específico
   * @param providerId ID del proveedor
   * @returns Observable con array de reseñas
   */
  getProviderReviews(providerId: number): Observable<Review[]> {
    return this.http.get<Review[]>(`${this.apiUrl}/providers/${providerId}/reviews`);
  }

  /**
   * Obtener reseñas de un cliente (opcional, si el backend lo soporta)
   * @param clientId ID del cliente
   * @returns Observable con array de reseñas
   */
  getClientReviews(clientId: number): Observable<Review[]> {
    return this.http.get<Review[]>(`${this.apiUrl}/clients/${clientId}/reviews`);
  }

  /**
   * Obtener una reseña específica por ID
   * @param reviewId ID de la reseña
   * @returns Observable con la reseña
   */
  getReview(reviewId: number): Observable<Review> {
    return this.http.get<Review>(`${this.apiUrl}/${reviewId}`);
  }
}

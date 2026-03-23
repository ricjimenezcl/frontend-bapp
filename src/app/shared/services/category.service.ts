import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorHandlerService } from './error-handler.service';
import { APP_CONSTANTS } from '../constants/app.constants';

export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private apiUrl = `${APP_CONSTANTS.API.BASE_URL}/categories`;
  
  private categoriesCache$ = new BehaviorSubject<Category[]>([]);
  
  // ✅ Observable compartida para evitar múltiples requests
  private categories$ = this.categoriesCache$.asObservable();

  constructor(
    private http: HttpClient,
    private errorHandler: ErrorHandlerService
  ) {
    // Cargar categorías al inicializar
    this.loadCategories();
  }

  /**
   * Obtiene todas las categorías (desde cache si está disponible)
   */
  getCategories(): Observable<Category[]> {
    if (this.categoriesCache$.value.length > 0) {
      return this.categories$;
    }
    return this.loadCategories();
  }

  /**
   * Carga las categorías desde el servidor
   */
  private loadCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(this.apiUrl).pipe(
      tap(categories => {
        this.categoriesCache$.next(categories);
      }),
      shareReplay(1), // ✅ Compartir resultado entre múltiples suscriptores
      catchError(error => {
        console.error('Error cargando categorías:', error);
        this.errorHandler.handleError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene una categoría por ID
   */
  getCategoryById(categoryId: string): Observable<Category> {
    return this.http.get<Category>(`${this.apiUrl}/${categoryId}`).pipe(
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene categorías activas
   */
  getActiveCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}?active=true`).pipe(
      tap(categories => {
        this.categoriesCache$.next(categories);
      }),
      shareReplay(1),
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene categorías recomendadas
   */
  getFeaturedCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}?featured=true`).pipe(
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Busca categorías por nombre
   */
  searchCategories(searchTerm: string): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/search`, {
      params: { q: searchTerm }
    }).pipe(
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Crea una nueva categoría (admin only)
   */
  createCategory(data: Partial<Category>): Observable<Category> {
    return this.http.post<Category>(this.apiUrl, data).pipe(
      tap(() => {
        // Recargar cache
        this.loadCategories().subscribe();
      }),
      tap(() => this.errorHandler.showSuccess('Categoría creada')),
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Actualiza una categoría (admin only)
   */
  updateCategory(categoryId: string, data: Partial<Category>): Observable<Category> {
    return this.http.put<Category>(`${this.apiUrl}/${categoryId}`, data).pipe(
      tap(() => {
        // Recargar cache
        this.loadCategories().subscribe();
      }),
      tap(() => this.errorHandler.showSuccess('Categoría actualizada')),
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Elimina una categoría (admin only)
   */
  deleteCategory(categoryId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${categoryId}`).pipe(
      tap(() => {
        // Recargar cache
        this.loadCategories().subscribe();
      }),
      tap(() => this.errorHandler.showSuccess('Categoría eliminada')),
      catchError(error => {
        this.errorHandler.processError(error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Limpia el cache de categorías
   */
  clearCache(): void {
    this.categoriesCache$.next([]);
  }

  /**
   * Recarga las categorías desde el servidor
   */
  reloadCategories(): Observable<Category[]> {
    this.clearCache();
    return this.loadCategories();
  }
}
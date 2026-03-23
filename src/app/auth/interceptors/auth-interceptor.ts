import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Obtener el token del localStorage
    const token = localStorage.getItem('token');
    
    let clonedRequest = req;

    // Clonar la request y agregar el header Authorization si existe token
    if (token) {
      clonedRequest = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    // Manejar la request y capturar errores
    return next.handle(clonedRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        // Si el error es 401 (Unauthorized), redirigir al login
        if (error.status === 401) {
          localStorage.removeItem('token');
          this.router.navigate(['/auth/login']);
        }
        
        // Re-lanzar el error
        return throwError(() => error);
      })
    );
  }
}
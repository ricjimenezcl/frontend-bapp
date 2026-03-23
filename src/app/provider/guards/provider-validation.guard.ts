import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from 'src/app/auth/services/auth.service';
import { ProviderService } from 'src/app/provider/services/provider.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class ProviderValidationGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private providerService: ProviderService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    const user = this.authService.getCurrentUser();
    if (!user || user.role !== 'PROVIDER') {
      this.router.navigate(['/auth/login']);
      return of(false);
    }
    return this.providerService.getMyProfile().pipe(
      map(provider => {
        if (provider.validation_status === 'approved') {
          return true;
        } else {
          this.router.navigate(['/provider/validacion-pendiente']);
          return false;
        }
      }),
      catchError(() => {
        this.router.navigate(['/provider/validacion-pendiente']);
        return of(false);
      })
    );
  }
}

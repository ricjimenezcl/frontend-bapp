import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { map, catchError, tap } from 'rxjs/operators';

export interface ClientProfile {
  id: number;
  user_id: number;
  run?: string | null;
  full_name: string;
  phone?: string | null;
  avatar?: string | null;
  bio?: string | null;
  rating_avg?: number | null;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  private apiUrl = environment.apiUrl;
    private _clientProfile = signal<ClientProfile | null>(null);
  constructor(private http: HttpClient) {}

  getClientById(clientId: number): Observable<ClientProfile> {
    return this.http.get<ClientProfile>(`${environment.apiUrl}/clients/${clientId}`);
  }
  

    updateClientProfile(clientId?: string, data?: Partial<ClientProfile>): Observable<ClientProfile> {
      return this.http.patch<ClientProfile>(`${this.apiUrl}/clients/me`, data).pipe(
        tap(profile => this._clientProfile.set(profile)),
        catchError(error => {
          console.error('Error updating provider profile:', error);
          return throwError(() => error);
        })
      );
    }
  
}

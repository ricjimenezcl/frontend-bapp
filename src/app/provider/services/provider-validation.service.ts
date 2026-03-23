import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProviderValidationService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  validateIdentity(providerId: number, docFile: File, selfieFile: File): Observable<any> {
    const formData = new FormData();
    formData.append('provider_id', providerId.toString());
    formData.append('identity_document', docFile);
    formData.append('selfie', selfieFile);
    return this.http.post(`${this.apiUrl}/providers/validate-identity`, formData);
  }

  /**
   * Get the current verification status for a provider verification record
   * @param verificationId ID of the ProviderVerification record
   */
  getVerificationStatus(verificationId: number): Observable<any> {
    return this.http.get(`/api/v1/documents/verification-status/${verificationId}`);
  }
}

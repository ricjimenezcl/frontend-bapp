import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export type ContentFilterContext = 'chat' | 'review' | 'profile' | 'service' | 'generic';

export interface ContentFilterPublicRequest {
  text: string;
  context: ContentFilterContext;
}

export interface ContentFilterPublicResponse {
  blocked: boolean;
  flagged: boolean;
  match_count: number;
  severity_detected: Array<'block' | 'flag'>;
  message?: string | null;
  normalized_text: string;
}

@Injectable({
  providedIn: 'root',
})
export class ContentFilterService {
  private readonly apiUrl = `${environment.apiUrl}/content-filter/validate`;

  constructor(private readonly http: HttpClient) {}

  validateText(text: string, context: ContentFilterContext = 'generic'): Observable<ContentFilterPublicResponse> {
    const payload: ContentFilterPublicRequest = { text, context };
    return this.http.post<ContentFilterPublicResponse>(this.apiUrl, payload);
  }
}

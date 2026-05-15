import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { debounceTime, switchMap, map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ContentValidationRequest, ContentValidationResponse } from '../models/report.model';

/**
 * Content Moderation Service
 * Valida contenido contra palabras prohibidas y reglas de moderación
 */
@Injectable({
  providedIn: 'root'
})
export class ContentModerationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/content`;

  /**
   * Validar texto contra palabras prohibidas
   * @param request Request con texto y contexto
   * @returns Observable con resultado de validación
   */
  validateContent(request: ContentValidationRequest): Observable<ContentValidationResponse> {
    return this.http.post<ContentValidationResponse>(`${this.apiUrl}/validate`, request);
  }

  /**
   * Validar en tiempo real con debounce
   * Útil para validación mientras el usuario escribe
   * @param text Texto a validar
   * @param context Contexto del texto
   * @returns Observable con resultado de validación
   */
  validateContentRealTime(
    text: string,
    context?: 'bio' | 'review' | 'chat' | 'service_description' | 'service_name'
  ): Observable<ContentValidationResponse> {
    if (!text || text.trim().length === 0) {
      return of({
        is_valid: true,
        blocked_words: [],
        severity: 'LOW'
      });
    }

    return of(text).pipe(
      debounceTime(300),
      switchMap(() => this.validateContent({ text, context })),
      catchError(() => of({
        is_valid: true,
        blocked_words: [],
        severity: 'LOW'
      }))
    );
  }

  /**
   * Censurar palabras prohibidas en un texto
   * Reemplaza palabras bloqueadas por asteriscos
   * @param text Texto original
   * @param blockedWords Array de palabras bloqueadas
   * @returns Texto censurado
   */
  censorText(text: string, blockedWords: string[]): string {
    if (!text || blockedWords.length === 0) {
      return text;
    }

    let censored = text;
    blockedWords.forEach(word => {
      const regex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'gi');
      censored = censored.replace(regex, '***');
    });
    return censored;
  }

  /**
   * Verificar si un texto es seguro para publicar
   * @param validationResult Resultado de validación
   * @returns true si es seguro publicar
   */
  isTextSafe(validationResult: ContentValidationResponse): boolean {
    return validationResult.is_valid && validationResult.severity !== 'CRITICAL';
  }

  /**
   * Obtener mensaje de error según severidad
   * @param validationResult Resultado de validación
   * @returns Mensaje de error descriptivo
   */
  getErrorMessage(validationResult: ContentValidationResponse): string {
    if (validationResult.is_valid) {
      return '';
    }

    switch (validationResult.severity) {
      case 'CRITICAL':
        return 'Este contenido viola gravemente nuestras normas y no puede ser publicado.';
      case 'HIGH':
        return 'Este contenido contiene palabras prohibidas y no puede ser publicado.';
      case 'MEDIUM':
        return 'Este contenido podría ser inapropiado. Por favor, revísalo.';
      case 'LOW':
        return 'Advertencia: este contenido podría resultar ofensivo para algunos usuarios.';
      default:
        return validationResult.message || 'Contenido inapropiado detectado.';
    }
  }

  /**
   * Obtener color para UI según severidad
   * @param severity Nivel de severidad
   * @returns Color de Ionic (danger, warning, etc.)
   */
  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'CRITICAL': return 'danger';
      case 'HIGH': return 'danger';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'medium';
      default: return 'medium';
    }
  }

  /**
   * Obtener icono para UI según severidad
   * @param severity Nivel de severidad
   * @returns Nombre de icono de Ionic
   */
  getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'CRITICAL': return 'close-circle';
      case 'HIGH': return 'warning';
      case 'MEDIUM': return 'alert-circle';
      case 'LOW': return 'information-circle';
      default: return 'information-circle';
    }
  }

  /**
   * Escapar caracteres especiales de regex
   * @param text Texto a escapar
   * @returns Texto escapado
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Verificar si un texto contiene URLs sospechosas
   * @param text Texto a verificar
   * @returns true si contiene URLs
   */
  containsSuspiciousUrls(text: string): boolean {
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\w+\.(com|net|org|io|xyz))/gi;
    return urlRegex.test(text);
  }

  /**
   * Extraer URLs de un texto
   * @param text Texto del cual extraer URLs
   * @returns Array de URLs encontradas
   */
  extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
    return text.match(urlRegex) || [];
  }

  /**
   * Limpiar texto de caracteres especiales usados para evadir filtros
   * Ej: "h0la" -> "hola", "c@sa" -> "casa"
   * @param text Texto a limpiar
   * @returns Texto normalizado
   */
  normalizeText(text: string): string {
    const replacements: { [key: string]: string } = {
      '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
      '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i'
    };

    let normalized = text.toLowerCase();
    Object.entries(replacements).forEach(([char, replacement]) => {
      normalized = normalized.replace(new RegExp(char, 'g'), replacement);
    });

    return normalized;
  }

  /**
   * Calcular similitud entre dos textos (Levenshtein distance)
   * Útil para detectar variaciones de palabras prohibidas
   * @param text1 Primer texto
   * @param text2 Segundo texto
   * @returns Porcentaje de similitud (0-1)
   */
  calculateSimilarity(text1: string, text2: string): number {
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;

    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calcular distancia de Levenshtein entre dos strings
   * @param str1 Primer string
   * @param str2 Segundo string
   * @returns Distancia de edición
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

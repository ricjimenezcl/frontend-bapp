import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { map, catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { ContentModerationService } from '../../core/services/content-moderation.service';

/**
 * Content Validators
 * Validadores asíncronos para formularios que validan contra palabras prohibidas
 */
export class ContentValidators {
  /**
   * Validador asíncrono para texto
   * Valida contra palabras prohibidas del backend
   * @param moderationService Servicio de moderación
   * @param context Contexto del texto
   * @returns AsyncValidatorFn
   */
  static inappropriateContent(
    moderationService: ContentModerationService,
    context?: 'bio' | 'review' | 'chat' | 'service_description' | 'service_name'
  ): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value || control.value.trim().length === 0) {
        return of(null);
      }

      return of(control.value).pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap(text => 
          moderationService.validateContent({
            text: text.trim(),
            context
          })
        ),
        map(result => {
          if (!result.is_valid) {
            return {
              inappropriateContent: {
                message: moderationService.getErrorMessage(result),
                blockedWords: result.blocked_words,
                severity: result.severity,
                suggestedText: result.suggested_text
              }
            };
          }
          return null;
        }),
        catchError(() => of(null))
      );
    };
  }

  /**
   * Validador para URLs sospechosas
   * Detecta URLs en el texto que podrían ser spam
   * @param moderationService Servicio de moderación
   * @returns Validator function
   */
  static suspiciousUrls(moderationService: ContentModerationService) {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const hasSuspiciousUrls = moderationService.containsSuspiciousUrls(control.value);
      if (hasSuspiciousUrls) {
        const urls = moderationService.extractUrls(control.value);
        return {
          suspiciousUrls: {
            message: 'No se permiten URLs en este campo',
            urls
          }
        };
      }

      return null;
    };
  }

  /**
   * Validador de longitud mínima sin contar espacios
   * @param minLength Longitud mínima requerida
   * @returns Validator function
   */
  static minLengthTrimmed(minLength: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const trimmedLength = control.value.trim().length;
      if (trimmedLength < minLength) {
        return {
          minLengthTrimmed: {
            requiredLength: minLength,
            actualLength: trimmedLength
          }
        };
      }

      return null;
    };
  }

  /**
   * Validador de texto spam (repetición excesiva de caracteres)
   * @returns Validator function
   */
  static spamText() {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const text = control.value.trim();
      
      // Detectar repetición excesiva de caracteres (ej: "aaaaaaa", "!!!!!!!")
      const repeatedCharsRegex = /(.)\1{5,}/g;
      if (repeatedCharsRegex.test(text)) {
        return {
          spamText: {
            message: 'El texto contiene demasiados caracteres repetidos'
          }
        };
      }

      // Detectar texto en mayúsculas excesivo (más del 70%)
      const uppercaseCount = (text.match(/[A-Z]/g) || []).length;
      const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
      if (letterCount > 10 && uppercaseCount / letterCount > 0.7) {
        return {
          spamText: {
            message: 'Por favor, no uses demasiadas mayúsculas'
          }
        };
      }

      return null;
    };
  }

  /**
   * Validador de información personal (emails, teléfonos)
   * @returns Validator function
   */
  static personalInfo() {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const text = control.value.trim();
      const foundInfo: string[] = [];

      // Detectar emails
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      if (emailRegex.test(text)) {
        foundInfo.push('correo electrónico');
      }

      // Detectar teléfonos (varios formatos)
      const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      if (phoneRegex.test(text)) {
        foundInfo.push('número de teléfono');
      }

      if (foundInfo.length > 0) {
        return {
          personalInfo: {
            message: `No compartas ${foundInfo.join(' ni ')} en público`,
            types: foundInfo
          }
        };
      }

      return null;
    };
  }
}

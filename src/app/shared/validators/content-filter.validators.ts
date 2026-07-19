import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { catchError, map, of, switchMap, timer } from 'rxjs';

import { ContentFilterContext, ContentFilterService } from '../services/content-filter.service';

export function offensiveContentAsyncValidator(
  service: ContentFilterService,
  context: ContentFilterContext = 'generic',
  debounceMs = 250,
): AsyncValidatorFn {
  return (control: AbstractControl) => {
    const rawValue = String(control.value ?? '').trim();

    if (!rawValue || rawValue.length < 2) {
      return of(null);
    }

    return timer(debounceMs).pipe(
      switchMap(() => service.validateText(rawValue, context)),
      map((result) => {
        if (!result.blocked) {
          return null;
        }

        return {
          offensiveContent: {
            blocked: result.blocked,
            flagged: result.flagged,
            message: result.message ?? 'Contenido no permitido',
            severity: result.severity_detected,
          },
        } as ValidationErrors;
      }),
      // UX fail-open: si falla el pre-check, no bloqueamos escritura; backend valida de nuevo.
      catchError(() => of(null)),
    );
  };
}

import {
  AbstractControl,
  AsyncValidatorFn,
  ValidationErrors,
  ValidatorFn
} from '@angular/forms';
import { Observable, of } from 'rxjs';
import { map, catchError, debounceTime, first } from 'rxjs/operators';

export class CustomValidators {
  /**
   * Valida formato de teléfono chileno
   * Acepta: 9XXXXXXXX, +569XXXXXXXX, 56 9 XXXXXXXX, etc.
   */
  static phone(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const cleaned = control.value.replace(/\D/g, '');
      const phoneRegex = /^(56)?9\d{8}$/;

      const isValid = phoneRegex.test(cleaned);
      return isValid ? null : { invalidPhone: true };
    };
  }

  /**
   * Valida RUT chileno
   * Formato: XX.XXX.XXX-X o XXXXXXXX-X
   */
  static rut(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const rut = control.value.toString().replace(/[^0-9K]/gi, '').toUpperCase();

      if (rut.length < 8) {
        return { invalidRut: true };
      }

      const body = rut.slice(0, -1);
      const dv = rut.slice(-1);

      const calculatedDV = this.calculateRutCheckDigit(body);

      return dv === calculatedDV ? null : { invalidRut: true };
    };
  }

  /**
   * Calcula el dígito verificador del RUT
   */
  private static calculateRutCheckDigit(body: string): string {
    let sum = 0;
    let multiplier = 2;

    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body[i], 10) * multiplier;
      multiplier = multiplier === 9 ? 2 : multiplier + 1;
    }

    const remainder = 11 - (sum % 11);

    if (remainder === 11) return '0';
    if (remainder === 10) return 'K';
    return remainder.toString();
  }

  /**
   * Valida email con patrón estricto
   */
  static strictEmail(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValid = emailRegex.test(control.value);

      return isValid ? null : { invalidEmail: true };
    };
  }

  /**
   * Valida fortaleza de contraseña
   * Requiere: mayúscula, número, mínimo 8 caracteres
   */
  static passwordStrength(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }

      const password = control.value;
      const errors: ValidationErrors = {};

      if (password.length < 8) {
        errors['minLength'] = true;
      }

      if (!/[A-Z]/.test(password)) {
        errors['noUpperCase'] = true;
      }

      if (!/[0-9]/.test(password)) {
        errors['noNumber'] = true;
      }

      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors['noSpecialChar'] = true;
      }

      return Object.keys(errors).length > 0 ? errors : null;
    };
  }

  /**
   * Valida que dos campos coincidan
   */
  static match(fieldName: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const matchControl = control.parent?.get(fieldName);

      if (!matchControl) {
        return null;
      }

      return control.value === matchControl.value ? null : { match: true };
    };
  }

  /**
   * Validador asincrónico para verificar unicidad
   */
  static unique(checkFunction: (value: string) => Observable<boolean>): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value) {
        return of(null);
      }

      return checkFunction(control.value).pipe(
        debounceTime(500),
        first(),
        map(exists => (exists ? { notUnique: true } : null)),
        catchError(() => of(null))
      );
    };
  }

  /**
   * Obtiene mensaje de error amigable
   */
  static getErrorMessage(control: AbstractControl | null): string {
    if (!control || !control.errors) {
      return '';
    }

    const errors = control.errors;

    if (errors['required']) {
      return 'Este campo es requerido';
    }

    if (errors['invalidPhone']) {
      return 'Teléfono inválido. Formato: 9XXXXXXXX o +569XXXXXXXX';
    }

    if (errors['invalidRut']) {
      return 'RUT inválido';
    }

    if (errors['invalidEmail']) {
      return 'Email inválido';
    }

    if (errors['minlength']) {
      return `Mínimo ${errors['minlength'].requiredLength} caracteres`;
    }

    if (errors['maxlength']) {
      return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    }

    if (errors['pattern']) {
      return 'Formato inválido';
    }

    if (errors['noUpperCase']) {
      return 'Debe contener al menos una mayúscula';
    }

    if (errors['noNumber']) {
      return 'Debe contener al menos un número';
    }

    if (errors['noSpecialChar']) {
      return 'Debe contener al menos un carácter especial';
    }

    if (errors['match']) {
      return 'Los campos no coinciden';
    }

    if (errors['notUnique']) {
      return 'Este valor ya está registrado';
    }

    return 'Campo inválido';
  }
}

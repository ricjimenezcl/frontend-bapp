/**
 * Formatea números telefónicos chilenos
 * Entrada: "987654321" o "987 654 321" o "+56987654321"
 * Salida: "+56 9 8765 4321"
 */
export class PhoneFormatter {
  static format(value: string): string {
    if (!value) {
      return '';
    }

    // Eliminar caracteres no numéricos excepto el símbolo +
    let cleaned = value.replace(/\D/g, '');

    // Si empieza con 56 y tiene 11 dígitos, eliminar el 56
    if (cleaned.startsWith('56') && cleaned.length === 11) {
      cleaned = cleaned.substring(2);
    }

    // Si tiene 9 dígitos y empieza con 9, formatar como +56 9 XXXX XXXX
    if (cleaned.length === 9 && cleaned.startsWith('9')) {
      return `+56 ${cleaned[0]} ${cleaned.substring(1, 5)} ${cleaned.substring(5)}`;
    }

    return value;
  }

  static unformat(value: string): string {
    return value.replace(/\D/g, '');
  }

  static isValid(value: string): boolean {
    const cleaned = value.replace(/\D/g, '');
    const phoneRegex = /^(56)?9\d{8}$/;
    return phoneRegex.test(cleaned);
  }
}

/**
 * Formatea RUT chileno
 * Entrada: "12345678-9" o "123456789"
 * Salida: "12.345.678-9"
 */
export class RUTFormatter {
  static format(rut: string): string {
    if (!rut) {
      return '';
    }

    // Limpiar formato anterior
    const cleaned = rut.toUpperCase().replace(/[^0-9K]/g, '');

    if (cleaned.length < 8) {
      return cleaned;
    }

    const body = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1);

    // Formatear el cuerpo con puntos
    let formatted = '';
    for (let i = body.length - 1, j = 0; i >= 0; i--, j++) {
      if (j > 0 && j % 3 === 0) {
        formatted = '.' + formatted;
      }
      formatted = body[i] + formatted;
    }

    return `${formatted}-${dv}`;
  }

  static unformat(rut: string): string {
    return rut.replace(/[^0-9K]/g, '').toUpperCase();
  }

  static isValid(rut: string): boolean {
    const cleaned = rut.replace(/[^0-9K]/gi, '').toUpperCase();

    if (cleaned.length < 8) {
      return false;
    }

    const body = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1);

    const calculatedDV = this.calculateCheckDigit(body);

    return dv === calculatedDV;
  }

  private static calculateCheckDigit(body: string): string {
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
}

/**
 * Formatea direcciones y ubicaciones
 */
export class AddressFormatter {
  static format(address: string): string {
    if (!address) {
      return '';
    }

    // Capitalizar primera letra de cada palabra
    return address
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  static truncate(address: string, maxLength: number = 50): string {
    if (address.length <= maxLength) {
      return address;
    }
    return address.substring(0, maxLength) + '...';
  }
}

/**
 * Formatea números como moneda
 */
export class CurrencyFormatter {
  static format(value: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(value);
  }

  static parse(value: string): number {
    return parseInt(value.replace(/\D/g, ''), 10);
  }
}

/**
 * Formatea fechas
 */
export class DateFormatter {
  static format(date: Date | string, format: string = 'dd/MM/yyyy'): string {
    const d = typeof date === 'string' ? new Date(date) : date;

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    switch (format) {
      case 'dd/MM/yyyy':
        return `${day}/${month}/${year}`;
      case 'yyyy-MM-dd':
        return `${year}-${month}-${day}`;
      case 'dd/MM/yyyy HH:mm':
        return `${day}/${month}/${year} ${hours}:${minutes}`;
      case 'HH:mm':
        return `${hours}:${minutes}`;
      default:
        return `${day}/${month}/${year}`;
    }
  }

  static formatRelative(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Justo ahora';
    if (diffMins < 60) return `hace ${diffMins}m`;
    if (diffHours < 24) return `hace ${diffHours}h`;
    if (diffDays < 7) return `hace ${diffDays}d`;

    return this.format(date);
  }
}

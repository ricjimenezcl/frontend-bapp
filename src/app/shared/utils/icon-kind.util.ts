/**
 * Utilidad compartida para detectar qué tipo de icono viene desde backend/BD
 * en campos como `category.icon` / `subcategory.icon`, de modo que el mismo
 * campo pueda contener indistintamente:
 *  - Una URL de imagen (icono custom subido)                -> 'image'
 *  - Clases de Font Awesome (ej. "fa-solid fa-house")        -> 'fontawesome'
 *  - Un nombre de Ionicon (ej. "construct-outline")          -> 'ionicon' (default)
 *
 * Homologado con web-bapp (src/app/shared/utils/icon-kind.util.ts).
 */
export type IconKind = 'image' | 'fontawesome' | 'ionicon';

const FONT_AWESOME_PATTERN =
  /(^|\s)(fa-solid|fa-regular|fa-brands|fa-light|fa-duotone|fa-thin|fas|far|fab|fal|fad)(\s|$)/i;
const FONT_AWESOME_ICON_TOKEN = /(^|\s)fa-[a-z0-9-]+/i;

export function getIconKind(icon: string | null | undefined): IconKind {
  const value = (icon ?? '').trim();
  if (!value) return 'ionicon';

  if (/^https?:\/\//i.test(value) || value.startsWith('data:image/')) {
    return 'image';
  }

  if (FONT_AWESOME_PATTERN.test(value) && FONT_AWESOME_ICON_TOKEN.test(value)) {
    return 'fontawesome';
  }

  return 'ionicon';
}

export function isImageIcon(icon: string | null | undefined): boolean {
  return getIconKind(icon) === 'image';
}

export function isFontAwesomeIcon(icon: string | null | undefined): boolean {
  return getIconKind(icon) === 'fontawesome';
}

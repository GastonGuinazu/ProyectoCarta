/**
 * Arma hrefs de contacto para la carta pública a partir de lo que cargó el
 * administrador (teléfono, WhatsApp, Instagram).
 */
export function telHref(value: string): string {
  return `tel:${value.replace(/[^\d+]/g, '')}`;
}

export function whatsappHref(value: string): string {
  return `https://wa.me/${value.replace(/\D/g, '')}`;
}

export function instagramHref(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const handle = trimmed.replace(/^@/, '');
  return `https://www.instagram.com/${encodeURIComponent(handle)}`;
}

export function instagramLabel(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return 'Instagram';
  }
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

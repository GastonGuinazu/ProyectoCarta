/**
 * Zonas IANA habituales para el selector de Configuración.
 * El API acepta cualquier IANA válida (`@IsTimeZone`); si la sucursal tiene
 * otra, el formulario la agrega para no perderla al guardar.
 */
export const BRANCH_TIMEZONE_OPTIONS: readonly {
  readonly value: string;
  readonly label: string;
}[] = [
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { value: 'America/Argentina/Cordoba', label: 'Argentina (Córdoba)' },
  { value: 'America/Argentina/Mendoza', label: 'Argentina (Mendoza)' },
  { value: 'America/Montevideo', label: 'Uruguay (Montevideo)' },
  { value: 'America/Asuncion', label: 'Paraguay (Asunción)' },
  { value: 'America/Santiago', label: 'Chile (Santiago)' },
  { value: 'America/Sao_Paulo', label: 'Brasil (São Paulo)' },
  { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
  { value: 'America/Lima', label: 'Perú (Lima)' },
  { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
  { value: 'Europe/Madrid', label: 'España (Madrid)' },
  { value: 'UTC', label: 'UTC' },
];

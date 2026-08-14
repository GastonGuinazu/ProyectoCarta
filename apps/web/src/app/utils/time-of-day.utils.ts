/** `HH:mm` ↔ minutos desde medianoche `[0, 1439]`. */
export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

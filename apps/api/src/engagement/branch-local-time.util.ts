import type { DayOfWeek } from '@prisma/client';

export interface BranchLocalMoment {
  readonly dayOfWeek: DayOfWeek;
  /** Minutos transcurridos desde las 00:00 locales, en `[0, 1440)`. */
  readonly minuteOfDay: number;
}

const WEEKDAY_LABEL_TO_DAY_OF_WEEK: Readonly<Record<string, DayOfWeek>> = {
  Mon: 'MONDAY',
  Tue: 'TUESDAY',
  Wed: 'WEDNESDAY',
  Thu: 'THURSDAY',
  Fri: 'FRIDAY',
  Sat: 'SATURDAY',
  Sun: 'SUNDAY',
};

/**
 * Resuelve el día de la semana y el minuto del día correspondientes a `now`
 * EN LA ZONA HORARIA de la Sucursal (`docs/domain-modules.md` §4.4 punto 2:
 * "Un Happy Hour debe evaluarse en la zona horaria de la Sucursal, no en la
 * zona horaria del servidor ni en la del dispositivo del comensal").
 *
 * Se usa `Intl.DateTimeFormat` con `timeZone` (soportado nativamente por
 * Node sin dependencias nuevas) en vez de aritmética manual de offsets: así
 * se delega el manejo de horario de verano (DST) por región a la base de
 * datos IANA del runtime, en vez de reimplementarlo.
 *
 * `hourCycle: 'h23'` es deliberado: sin especificarlo explícitamente, algunos
 * motores ICU representan la medianoche como "24" en vez de "00" al pedir
 * `hour12: false`, lo que rompería el cálculo de `minuteOfDay` a la medianoche.
 */
export function resolveBranchLocalMoment(
  now: Date,
  timezone: string,
): BranchLocalMoment {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);

  const weekdayLabel = parts.find((part) => part.type === 'weekday')?.value;
  const hourLabel = parts.find((part) => part.type === 'hour')?.value;
  const minuteLabel = parts.find((part) => part.type === 'minute')?.value;

  const dayOfWeek = weekdayLabel
    ? WEEKDAY_LABEL_TO_DAY_OF_WEEK[weekdayLabel]
    : undefined;
  if (!dayOfWeek || hourLabel === undefined || minuteLabel === undefined) {
    // Solo puede pasar por una `timezone` inválida (no-IANA) persistida en
    // `Branch.timezone`: un problema de integridad de datos administrativos,
    // no un caso de negocio esperado en runtime normal.
    throw new Error(
      `No se pudo resolver la hora local de la sucursal para timezone "${timezone}".`,
    );
  }

  return {
    dayOfWeek,
    minuteOfDay: Number(hourLabel) * 60 + Number(minuteLabel),
  };
}

/**
 * `endMinuteOfDay` se trata como EXCLUSIVO: el Happy Hour deja de estar
 * activo justo en ese minuto (consistente con el ejemplo de
 * features-spec.md §3.3, "...hasta las 23:59:59 de un día" — el último
 * minuto activo es el anterior al límite, nunca el límite mismo).
 *
 * Soporta rangos que cruzan la medianoche (`startMinuteOfDay > endMinuteOfDay`,
 * ej. 23:00–01:00, features-spec.md §3.3): se evalúa como la unión de dos
 * tramos, `[start, 1440)` y `[0, end)`, en vez de un único rango continuo.
 */
export function isWithinMinuteWindow(
  minuteOfDay: number,
  startMinuteOfDay: number,
  endMinuteOfDay: number,
): boolean {
  if (startMinuteOfDay <= endMinuteOfDay) {
    return minuteOfDay >= startMinuteOfDay && minuteOfDay < endMinuteOfDay;
  }
  return minuteOfDay >= startMinuteOfDay || minuteOfDay < endMinuteOfDay;
}

export function isHappyHourActiveNow(
  happyHour: {
    readonly daysOfWeek: readonly DayOfWeek[];
    readonly startMinuteOfDay: number;
    readonly endMinuteOfDay: number;
  },
  timezone: string,
  now: Date,
): boolean {
  const { dayOfWeek, minuteOfDay } = resolveBranchLocalMoment(now, timezone);
  if (!happyHour.daysOfWeek.includes(dayOfWeek)) {
    return false;
  }
  return isWithinMinuteWindow(
    minuteOfDay,
    happyHour.startMinuteOfDay,
    happyHour.endMinuteOfDay,
  );
}

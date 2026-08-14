export interface ServingWindow {
  readonly startMinuteOfDay: number;
  readonly endMinuteOfDay: number;
}

export type ServingWindowError =
  | 'SERVING_HOURS_PAIR'
  | 'SERVING_WINDOW_SAME'
  | 'INVALID_SERVING_WINDOW'
  | 'MAX_SERVING_WINDOWS';

const MAX_WINDOWS = 6;

export function validateServingWindows(
  windows: readonly ServingWindow[],
): ServingWindowError | null {
  if (windows.length > MAX_WINDOWS) {
    return 'MAX_SERVING_WINDOWS';
  }
  for (const window of windows) {
    if (
      !Number.isInteger(window.startMinuteOfDay) ||
      !Number.isInteger(window.endMinuteOfDay) ||
      window.startMinuteOfDay < 0 ||
      window.startMinuteOfDay > 1439 ||
      window.endMinuteOfDay < 0 ||
      window.endMinuteOfDay > 1439
    ) {
      return 'INVALID_SERVING_WINDOW';
    }
    if (window.startMinuteOfDay === window.endMinuteOfDay) {
      return 'SERVING_WINDOW_SAME';
    }
  }
  return null;
}

/**
 * `servedWindows` JSON es la fuente de verdad. `undefined` = no vino en el
 * body (usar el par legado). `null`/[] = sin recorte (todo el día).
 */
export function resolveServingWindows(input: {
  readonly servedWindows?: unknown;
  readonly servedStartMinuteOfDay?: number | null;
  readonly servedEndMinuteOfDay?: number | null;
}): { readonly windows: ServingWindow[]; readonly error: ServingWindowError | null } {
  if (input.servedWindows !== undefined) {
    const windows = parseServingWindowsJson(input.servedWindows) ?? [];
    return { windows, error: validateServingWindows(windows) };
  }
  const start = input.servedStartMinuteOfDay ?? null;
  const end = input.servedEndMinuteOfDay ?? null;
  if (start === null && end === null) {
    return { windows: [], error: null };
  }
  if (start === null || end === null) {
    return { windows: [], error: 'SERVING_HOURS_PAIR' };
  }
  const windows = [{ startMinuteOfDay: start, endMinuteOfDay: end }];
  return { windows, error: validateServingWindows(windows) };
}

export function parseServingWindowsJson(value: unknown): ServingWindow[] | null {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  const windows: ServingWindow[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const start = record.startMinuteOfDay;
    const end = record.endMinuteOfDay;
    if (typeof start !== 'number' || typeof end !== 'number') {
      continue;
    }
    windows.push({ startMinuteOfDay: start, endMinuteOfDay: end });
  }
  return windows;
}

export function firstServingWindow(windows: readonly ServingWindow[]): {
  readonly startMinuteOfDay: number | null;
  readonly endMinuteOfDay: number | null;
} {
  const first = windows[0];
  if (!first) {
    return { startMinuteOfDay: null, endMinuteOfDay: null };
  }
  return {
    startMinuteOfDay: first.startMinuteOfDay,
    endMinuteOfDay: first.endMinuteOfDay,
  };
}

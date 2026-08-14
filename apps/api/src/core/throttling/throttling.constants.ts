/** Named throttlers (docs/backend-architecture.md §3.2, checklist §3). */
export const LOGIN_THROTTLER = 'login';
export const PUBLIC_THROTTLER = 'public';

/** Ventana del campo `Plan.rateLimitPerMinute` (prisma). */
export const PUBLIC_RATE_WINDOW_SECONDS = 60;

import * as Sentry from '@sentry/react-native';
import { APP_ENV, SENTRY_DSN } from '@/config';
import { getSettings } from '@/features/settings/settings';

/** Rapports de plantage (Sentry) : actifs seulement si un DSN est configuré au build. */
export const crashReportingAvailable = !!SENTRY_DSN;

/**
 * Initialise Sentry sans données personnelles : pas d'utilisateur, pas de capture d'écran,
 * pas de journaux ni d'URL d'API dans le fil d'Ariane. L'utilisateur peut refuser dans Réglages.
 */
export function initCrashReporting(): void {
  if (!SENTRY_DSN) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: APP_ENV,
    enabled: !__DEV__,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    tracesSampleRate: 0,
    beforeBreadcrumb: (b) => (b.category === 'console' || b.category === 'fetch' || b.category === 'xhr' ? null : b),
    beforeSend: (event) => {
      if (!getSettings().crashReports) return null;
      delete event.user;
      return event;
    },
  });
}

export function reportError(error: unknown): void {
  if (SENTRY_DSN) Sentry.captureException(error);
}

export const wrapRoot = Sentry.wrap;

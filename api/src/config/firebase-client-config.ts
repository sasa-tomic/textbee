/**
 * The Firebase *client* identifiers the Android app needs to initialize FCM at runtime. They are
 * served (unauthenticated, non-secret) at GET /api/v1/config so a single generic APK can configure
 * itself against this server. Without them the app cannot obtain an FCM token, so the deployment is
 * not usable — the server refuses to start when any are missing (see main.ts).
 */

const isBlank = (value?: string): boolean => !value || value.trim() === ''

/**
 * Returns the names of the required Firebase client env vars that are missing/blank. Empty when the
 * config is complete. `projectId` is satisfied by either FIREBASE_CLIENT_PROJECT_ID or the Admin
 * SDK's FIREBASE_PROJECT_ID (the controller falls back to it).
 */
export function missingFirebaseClientConfig(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const missing: string[] = []
  if (isBlank(env.FIREBASE_CLIENT_APP_ID)) missing.push('FIREBASE_CLIENT_APP_ID')
  if (isBlank(env.FIREBASE_CLIENT_API_KEY)) missing.push('FIREBASE_CLIENT_API_KEY')
  if (isBlank(env.FIREBASE_CLIENT_MESSAGING_SENDER_ID)) {
    missing.push('FIREBASE_CLIENT_MESSAGING_SENDER_ID')
  }
  if (isBlank(env.FIREBASE_CLIENT_PROJECT_ID) && isBlank(env.FIREBASE_PROJECT_ID)) {
    missing.push('FIREBASE_CLIENT_PROJECT_ID (or FIREBASE_PROJECT_ID)')
  }
  return missing
}

/** Human-readable, actionable error explaining what to set and where. */
export function firebaseClientConfigErrorMessage(missing: string[]): string {
  return [
    'Refusing to start: the Android app’s Firebase client config is incomplete.',
    `Missing env var(s): ${missing.join(', ')}.`,
    'These are served at GET /api/v1/config so the app can initialize FCM (push) at runtime;',
    'without them registered devices cannot receive messages.',
    'Set them in api/.env from your Firebase console (Project settings → General → your Android app).',
    'They must be the same Firebase project as the Admin SDK credentials. See SELF_HOST_SECRETS.md.',
  ].join('\n')
}

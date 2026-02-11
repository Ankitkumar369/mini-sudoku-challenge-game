const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "",
  firebaseApiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  firebaseAuthDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  firebaseAppId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  firebaseStorageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  firebaseMessagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  firebaseMeasurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
};

export const isFirebaseConfigured =
  env.firebaseApiKey &&
  env.firebaseAuthDomain &&
  env.firebaseProjectId &&
  env.firebaseAppId;

export function getClientSetupWarnings() {
  const warnings = [];

  if (!isFirebaseConfigured) {
    warnings.push(
      "Firebase keys are missing in .env. Add VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID to enable Google sign-in."
    );
  }

  return warnings;
}

export { env };

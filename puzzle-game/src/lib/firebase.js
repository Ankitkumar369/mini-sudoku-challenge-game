import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { env, isFirebaseConfigured } from "./env";

let auth = null;

if (isFirebaseConfigured) {
  const app = initializeApp({
    apiKey: env.firebaseApiKey,
    authDomain: env.firebaseAuthDomain,
    projectId: env.firebaseProjectId,
    appId: env.firebaseAppId,
    storageBucket: env.firebaseStorageBucket || undefined,
    messagingSenderId: env.firebaseMessagingSenderId || undefined,
    measurementId: env.firebaseMeasurementId || undefined,
  });

  auth = getAuth(app);
}

export { auth };

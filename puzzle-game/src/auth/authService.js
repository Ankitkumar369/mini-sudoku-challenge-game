// Imports: environment helper for API URL resolution and config checks.
import { env, isFirebaseConfigured } from "../lib/env";

// Supports same-origin and deployed API base URL configuration.
function makeApiUrl(path) {
  const base = env.apiBaseUrl || "";
  return `${base}${path}`;
}

// Converts provider-specific user shape to one app user contract.
function normalizeUser(rawUser, provider) {
  return {
    id: rawUser.uid || rawUser.id || "",
    name: rawUser.displayName || rawUser.name || "",
    email: rawUser.email || "",
    phone: rawUser.phoneNumber || rawUser.phone || "",
    avatarUrl: rawUser.photoURL || rawUser.avatarUrl || "",
    provider,
  };
}

// Shared response parser so all auth requests throw consistent errors.
async function parseJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

export async function signInWithGoogle() {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured. Add VITE_FIREBASE_* variables.");
  }

  // Lazy-load Firebase auth only when user starts Google sign-in.
  const [{ GoogleAuthProvider, signInWithPopup }, { auth }] = await Promise.all([
    import("firebase/auth"),
    import("../lib/firebase"),
  ]);

  if (!auth) {
    throw new Error("Firebase auth instance is unavailable.");
  }

  // Firebase popup sign-in handles Google OAuth in browser.
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);

  return normalizeUser(result.user, "google");
}

export async function signInAsGuest() {
  // Guest id is local-only identity; avoids backend auth dependency.
  const random = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");

  return {
    id: `guest_${Date.now()}_${random}`,
    name: "Guest Player",
    email: "",
    phone: "",
    avatarUrl: "",
    provider: "guest",
  };
}

export async function signOutUser() {
  if (!isFirebaseConfigured) {
    return;
  }

  const [{ signOut }, { auth }] = await Promise.all([
    import("firebase/auth"),
    import("../lib/firebase"),
  ]);

  if (auth) {
    await signOut(auth);
  }
}

export async function startTruecallerFlow() {
  // Backend prepares signed authorize URL; frontend only redirects.
  const response = await fetch(makeApiUrl("/api/auth/truecaller/start"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      redirectUri: `${window.location.origin}/auth/callback`,
    }),
  });

  const payload = await parseJsonResponse(response);

  if (!payload.authorizeUrl) {
    throw new Error("Truecaller authorize URL was not returned by backend");
  }

  // Full-page redirect is required for OAuth provider flow.
  window.location.assign(payload.authorizeUrl);
}

export async function tryHandleTruecallerCallback() {
  if (window.location.pathname !== "/auth/callback") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");

  if (error) {
    throw new Error(`Truecaller auth failed: ${error}`);
  }

  const code = params.get("code");

  if (!code) {
    throw new Error("Truecaller callback missing code");
  }

  const response = await fetch(
    makeApiUrl(`/api/auth/truecaller/callback?${params.toString()}`),
    {
      method: "GET",
    }
  );

  const payload = await parseJsonResponse(response);

  if (!payload.user) {
    throw new Error("Truecaller callback did not return a user");
  }

  // Cleanup callback URL after login to keep route stable.
  window.history.replaceState({}, "", "/");
  return normalizeUser(payload.user, "truecaller");
}

export async function syncUser(user) {
  // Best-effort user bootstrap in DB so progress endpoints have known user id.
  const response = await fetch(makeApiUrl("/api/users/upsert"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(user),
  });

  await parseJsonResponse(response);
}

export async function checkApiHealth() {
  const response = await fetch(makeApiUrl("/api/health"), {
    method: "GET",
  });

  return parseJsonResponse(response);
}

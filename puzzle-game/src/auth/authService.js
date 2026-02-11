import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { env } from "../lib/env";

function makeApiUrl(path) {
  const base = env.apiBaseUrl || "";
  return `${base}${path}`;
}

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

async function parseJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

export async function signInWithGoogle() {
  if (!auth) {
    throw new Error("Firebase is not configured. Add VITE_FIREBASE_* variables.");
  }

  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);

  return normalizeUser(result.user, "google");
}

export async function signInAsGuest() {
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
  if (auth) {
    await signOut(auth);
  }
}

export async function startTruecallerFlow() {
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

  window.history.replaceState({}, "", "/");
  return normalizeUser(payload.user, "truecaller");
}

export async function syncUser(user) {
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

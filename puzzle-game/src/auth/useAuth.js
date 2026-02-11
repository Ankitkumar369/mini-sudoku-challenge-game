import { useCallback, useEffect, useState } from "react";
import {
  checkApiHealth,
  signInAsGuest,
  signInWithGoogle,
  signOutUser,
  startTruecallerFlow,
  syncUser,
  tryHandleTruecallerCallback,
} from "./authService";
import {
  clearSessionUser,
  getSessionUser,
  setSessionUser,
} from "../lib/localProgress";

function toErrorMessage(error) {
  return error instanceof Error ? error.message : "Unexpected error";
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [backendStatus, setBackendStatus] = useState("idle");

  const initialize = useCallback(async () => {
    setLoading(true);

    try {
      const callbackUser = await tryHandleTruecallerCallback();

      if (callbackUser) {
        setUser(callbackUser);
        await setSessionUser(callbackUser);
        await syncUser(callbackUser).catch(() => {});
        return;
      }

      const cachedUser = await getSessionUser();

      if (cachedUser) {
        setUser(cachedUser);
      }
    } catch (initializationError) {
      setError(toErrorMessage(initializationError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const checkBackendStatus = useCallback(async () => {
    try {
      setBackendStatus("checking");
      const health = await checkApiHealth();

      if (health.databaseConnected === false) {
        setBackendStatus("degraded");
      } else {
        setBackendStatus("healthy");
      }
    } catch {
      setBackendStatus("offline");
    }
  }, []);

  useEffect(() => {
    checkBackendStatus();
  }, [checkBackendStatus]);

  const loginWithGoogle = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const authenticatedUser = await signInWithGoogle();
      setUser(authenticatedUser);
      await setSessionUser(authenticatedUser);
      await syncUser(authenticatedUser).catch(() => {});
    } catch (authError) {
      setError(toErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  }, []);

  const loginAsGuest = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const guestUser = await signInAsGuest();
      setUser(guestUser);
      await setSessionUser(guestUser);
      await syncUser(guestUser).catch(() => {});
    } catch (authError) {
      setError(toErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithTruecaller = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      await startTruecallerFlow();
    } catch (authError) {
      setError(toErrorMessage(authError));
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      await signOutUser().catch(() => {});
      await clearSessionUser().catch(() => {});
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError("");
  }, []);

  return {
    user,
    loading,
    error,
    backendStatus,
    signInWithGoogle: loginWithGoogle,
    signInAsGuest: loginAsGuest,
    signInWithTruecaller: loginWithTruecaller,
    signOut: logout,
    clearError,
    checkBackendStatus,
  };
}

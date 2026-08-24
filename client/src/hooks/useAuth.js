import { useCallback, useState } from 'react';
import { useAuthStore } from '../stores/auth.store.js';

// Thin convenience wrapper over stores/auth.store.js. See FRONTEND.md §6.
//
// The store itself tracks no per-call pending state (signIn/signUp are plain
// async actions) — `isAuthenticating` is local to this hook so Login/Signup
// can drive their submit-button spinner without the store knowing about UI.
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const storeSignIn = useAuthStore((s) => s.signIn);
  const storeSignUp = useAuthStore((s) => s.signUp);
  const signOut = useAuthStore((s) => s.signOut);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const signIn = useCallback(
    async (email, password) => {
      setIsAuthenticating(true);
      try {
        return await storeSignIn(email, password);
      } finally {
        setIsAuthenticating(false);
      }
    },
    [storeSignIn],
  );

  const signUp = useCallback(
    async (email, password, name) => {
      setIsAuthenticating(true);
      try {
        return await storeSignUp(email, password, name);
      } finally {
        setIsAuthenticating(false);
      }
    },
    [storeSignUp],
  );

  return {
    user,
    isAuthenticated: Boolean(user),
    isAuthenticating,
    signIn,
    signUp,
    signOut,
  };
}

export default useAuth;

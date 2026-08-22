import { useAuthStore } from '../stores/auth.store.js';

// Thin convenience wrapper over stores/auth.store.js. See FRONTEND.md §6.
export function useAuth() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const error = useAuthStore((s) => s.error);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const signOut = useAuthStore((s) => s.signOut);
  const clearError = useAuthStore((s) => s.clearError);

  return {
    user,
    error,
    isAuthenticated: status === 'authenticated',
    isAuthenticating: status === 'authenticating',
    signIn,
    signUp,
    signOut,
    clearError,
  };
}

export default useAuth;

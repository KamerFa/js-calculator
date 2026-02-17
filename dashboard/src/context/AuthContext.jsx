import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isLoggedIn, authMe, authLogout } from '../db';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !isLoggedIn()) {
      setAuthChecked(true);
      return;
    }
    authMe()
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem('dash_token'))
      .finally(() => setAuthChecked(true));
  }, []);

  const handleAuth = useCallback((userData) => setUser(userData), []);
  const logout = useCallback(() => authLogout(), []);

  return (
    <AuthContext.Provider value={{ user, authChecked, handleAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

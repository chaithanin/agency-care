import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokenStore } from '../api/client';

export type Role = 'admin' | 'manager' | 'sales';
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  employee?: { id: string; code: string; zone?: string } | null;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (tokenStore.access) {
        try {
          const { data } = await api.get('/auth/me');
          setUser(data);
        } catch {
          tokenStore.clear();
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    tokenStore.set(data.accessToken, data.refreshToken);
    const me = await api.get('/auth/me');
    setUser(me.data);
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
    window.location.href = '/login';
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

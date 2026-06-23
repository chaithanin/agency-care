import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokenStore } from '../api/client';

export type Role = 'super_admin' | 'admin' | 'closer' | 'sales';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;           // permanent role
  activeRole: Role;     // current active role (for UI scoping)
  additionalRoles: Role[];
  isImpersonated?: boolean;
  impersonatorId?: string;
  impersonatorName?: string;
  employee?: { id: string; code: string; zone?: string } | null;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: Role) => Promise<void>;
  startImpersonation: (targetId: string) => Promise<{ targetName: string }>;
  stopImpersonation: () => void;
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
    // Clear impersonation state too
    sessionStorage.removeItem('orig_access');
    sessionStorage.removeItem('orig_refresh');
    tokenStore.clear();
    setUser(null);
    window.location.href = '/login';
  };

  const switchRole = async (role: Role) => {
    const { data } = await api.patch('/auth/switch-role', { role });
    tokenStore.set(data.accessToken, data.refreshToken);
    const me = await api.get('/auth/me');
    setUser(me.data);
  };

  const startImpersonation = async (targetId: string) => {
    const { data } = await api.post(`/auth/impersonate/${targetId}`);
    // Save original tokens to restore later
    sessionStorage.setItem('orig_access', tokenStore.access ?? '');
    sessionStorage.setItem('orig_refresh', tokenStore.refresh ?? '');
    // Switch to impersonation token (no refresh token for impersonation)
    tokenStore.set(data.impersonateToken, '');
    const me = await api.get('/auth/me');
    setUser(me.data);
    return { targetName: data.targetName as string };
  };

  const stopImpersonation = () => {
    const origAccess = sessionStorage.getItem('orig_access') ?? '';
    const origRefresh = sessionStorage.getItem('orig_refresh') ?? '';
    sessionStorage.removeItem('orig_access');
    sessionStorage.removeItem('orig_refresh');
    tokenStore.set(origAccess, origRefresh);
    api
      .get('/auth/me')
      .then((me) => setUser(me.data))
      .catch(() => {
        tokenStore.clear();
        setUser(null);
        window.location.href = '/login';
      });
  };

  return (
    <Ctx.Provider value={{ user, loading, login, logout, switchRole, startImpersonation, stopImpersonation }}>
      {children}
    </Ctx.Provider>
  );
}

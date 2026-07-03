import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createSupabaseClient,
  getSupabaseConfig,
  isValidSupabaseUrl,
  TOKEN_KEY,
  USER_KEY,
} from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { url, anonKey, rawUrl } = getSupabaseConfig();
  const urlOk = isValidSupabaseUrl(url);
  const keyOk = Boolean(anonKey);
  const configOk = urlOk && keyOk;

  // An unauthenticated client is enough for login/me RPC calls.
  const supabase = useMemo(
    () => (configOk ? createSupabaseClient(null) : null),
    [configOk, url, anonKey]
  );

  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const storedToken = localStorage.getItem(TOKEN_KEY);

    if (!storedToken) {
      setLoading(false);
      return;
    }

    supabase
      .rpc('me', { p_token: storedToken })
      .then(({ data, error }) => {
        if (error || !data) {
          throw error || new Error('Sessiya etibarsızdır');
        }
        setToken(storedToken);
        setUser(data);
        localStorage.setItem(USER_KEY, JSON.stringify(data));
      })
      .catch(() => {
        logout();
      })
      .finally(() => {
        setLoading(false);
      });
  }, [supabase]);

  const login = async ({ role, username, password }) => {
    if (!supabase) {
      throw new Error('Supabase quraşdırılmayıb');
    }

    const { data, error } = await supabase.rpc('login', {
      p_username: username,
      p_password: password,
      p_role: role,
    });

    if (error || !data?.token) {
      throw error || new Error('Giriş uğursuz oldu');
    }

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  if (!configOk) {
    const invalidPostgresUrl =
      rawUrl && rawUrl.startsWith('postgresql://') && !urlOk;

    return (
      <div className="config-error-screen">
        <div className="config-error-card">
          <h1>BOUTIQUE</h1>

          {!keyOk && !rawUrl && (
            <p>
              Supabase quraşdırması çatışmır. Zəhmət olmasa aşağıdakı məlumatlarla <code>.env</code>{' '}
              faylı yaradın:
            </p>
          )}

          {rawUrl && !urlOk && !invalidPostgresUrl && (
            <p>
              <code>VITE_SUPABASE_URL</code> dəyəri yanlışdır.{' '}
              <code>https://</code> ilə başlamalıdır.
            </p>
          )}

          {invalidPostgresUrl && (
            <p>
              <code>VITE_SUPABASE_URL</code> Postgres bağlantı sətirinə bənzəyir. Tətbiq üçün
              Supabase REST URL-si lazımdır və aşağıdakı kimi görünməlidir:
            </p>
          )}

          <pre>
            VITE_SUPABASE_URL=https://your-project.supabase.co{'\n'}
            VITE_SUPABASE_ANON_KEY=your-anon-key
          </pre>

          {invalidPostgresUrl && (
            <p className="hint">
              Qeyd: <code>{url}</code> ünvanı avtomatik düzəldilməyə çalışıldı ama yenə də
              etibarlı deyil. Zəhmət olmasa yuxarıdakı formatda daxil edin.
            </p>
          )}

          <p>
            Sonra <code>npm run dev</code> ilə development serveri yenidən başladın.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

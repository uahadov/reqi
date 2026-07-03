import { createContext, useContext, useMemo } from 'react';
import { createSupabaseClient } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const SupabaseContext = createContext(null);

export function SupabaseProvider({ children }) {
  const { token } = useAuth();
  const supabase = useMemo(() => createSupabaseClient(token), [token]);

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext);
  if (!ctx) throw new Error('useSupabase must be used within SupabaseProvider');
  return ctx;
}

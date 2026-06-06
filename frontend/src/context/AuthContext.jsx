import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Hydrate from any persisted session on first load.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // 2. Keep in sync with sign-in / sign-out / token-refresh events.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  // Client-side role is read from user_metadata for UI routing ONLY. The backend
  // independently resolves the authoritative role from the recruiters table.
  const userRole = user?.user_metadata?.role ?? null;
  const isAuthenticated = Boolean(session);

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUp = (email, password, metadata) =>
    supabase.auth.signUp({ email, password, options: { data: metadata } });

  const signOut = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider
      value={{ session, user, userRole, isAuthenticated, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

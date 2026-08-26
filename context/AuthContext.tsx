import type { Session } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

import { supabase } from '../services/supabase';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  // Şifre sıfırlama linkinden dönüşte Supabase geçici ama kullanılabilir
  // bir oturum (PASSWORD_RECOVERY olayı) veriyor. Bunu normal "giriş
  // yapılmış" oturumdan ayırt etmezsek kullanıcı yeni şifre formunu hiç
  // görmeden doğrudan ana ekrana atılır. Bu bayrak true olduğu sürece kök
  // (App.tsx) hâlâ AuthStack'i gösterir; ForgotPasswordScreen şifreyi
  // güncelledikten sonra completePasswordRecovery() ile bunu kapatır.
  passwordRecoveryMode: boolean;
  completePasswordRecovery: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('[AuthContext] onAuthStateChange:', event, 'oturum var mı:', !!newSession);
      if (event === 'PASSWORD_RECOVERY') {
        console.log('[AuthContext] passwordRecoveryMode -> true (PASSWORD_RECOVERY event)');
        setPasswordRecoveryMode(true);
      }
      setSession(newSession);
      setLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const completePasswordRecovery = () => {
    console.log('[AuthContext] passwordRecoveryMode -> false (completePasswordRecovery)');
    setPasswordRecoveryMode(false);
  };

  return (
    <AuthContext.Provider
      value={{ session, loading, passwordRecoveryMode, completePasswordRecovery }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth, AuthProvider içinde kullanılmalı.');
  }
  return value;
}

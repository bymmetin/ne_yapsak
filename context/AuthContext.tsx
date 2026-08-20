import type { Session } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

import { supabase } from '../services/supabase';

type AuthContextValue = {
  session: Session | null;
  yukleniyor: boolean;
  // Şifre sıfırlama linkinden dönüşte Supabase geçici ama kullanılabilir
  // bir oturum (PASSWORD_RECOVERY olayı) veriyor. Bunu normal "giriş
  // yapılmış" oturumdan ayırt etmezsek kullanıcı yeni şifre formunu hiç
  // görmeden doğrudan ana ekrana atılır. Bu bayrak true olduğu sürece kök
  // (App.tsx) hâlâ AuthStack'i gösterir; SifremiUnuttumScreen şifreyi
  // güncelledikten sonra sifreKurtarmaTamamlandi() ile bunu kapatır.
  sifreKurtarmaModu: boolean;
  sifreKurtarmaTamamlandi: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [sifreKurtarmaModu, setSifreKurtarmaModu] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setYukleniyor(false);
    });

    const { data: abonelik } = supabase.auth.onAuthStateChange((event, yeniSession) => {
      console.log('[AuthContext] onAuthStateChange:', event, 'oturum var mı:', !!yeniSession);
      if (event === 'PASSWORD_RECOVERY') {
        setSifreKurtarmaModu(true);
      }
      setSession(yeniSession);
      setYukleniyor(false);
    });

    return () => abonelik.subscription.unsubscribe();
  }, []);

  const sifreKurtarmaTamamlandi = () => setSifreKurtarmaModu(false);

  return (
    <AuthContext.Provider
      value={{ session, yukleniyor, sifreKurtarmaModu, sifreKurtarmaTamamlandi }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const deger = useContext(AuthContext);
  if (!deger) {
    throw new Error('useAuth, AuthProvider içinde kullanılmalı.');
  }
  return deger;
}

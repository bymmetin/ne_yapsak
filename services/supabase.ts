import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase ortam değişkenleri eksik. .env.example dosyasını .env olarak kopyalayıp ' +
      'kendi Supabase proje URL ve anon key değerlerini gir.',
  );
}

// AsyncStorage ile oturum kalıcılığı: uygulama kapatılıp açıldığında kullanıcı
// tekrar giriş yapmak zorunda kalmasın diye (Gün 10'daki AuthContext bu
// oturumu okuyacak). detectSessionInUrl kapalı çünkü React Native'de tarayıcı
// URL'i yok, web'e özgü bu kontrol gereksiz uyarı üretiyor. flowType 'pkce':
// e-posta doğrulama linkinden dönüşte kodu manuel olarak
// exchangeCodeForSession'a vermemiz gerekiyor (bkz. EmailVerificationScreen).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

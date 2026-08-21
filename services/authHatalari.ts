import type { AuthError } from '@supabase/supabase-js';

// signUp bazen hata döndürmeden de "e-posta zaten kayıtlı" durumunu iletir
// (bkz. KayitScreen'deki identities kontrolü). Aynı mesajı iki yerde farklı
// yazmamak için burada dışa açık.
export const EMAIL_ZATEN_KAYITLI_MESAJI = 'Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı dene.';

// Supabase auth hatalarını kullanıcıya gösterilecek anlaşılır Türkçe
// metinlere çevirir. Mesaj metni yerine `code` alanına bakılıyor çünkü
// Supabase İngilizce mesaj metnini zamanla değiştirebilir ama code sabit
// kalır. Bilinmeyen bir code gelirse (ör. ağ hatası) ham mesaj gösterilir.
export function authHataMesaji(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'E-posta veya şifre hatalı.';
    case 'user_already_exists':
      return EMAIL_ZATEN_KAYITLI_MESAJI;
    case 'email_not_confirmed':
      return 'E-posta adresin henüz doğrulanmadı. Gelen kutunu kontrol et.';
    case 'user_not_found':
      return 'Bu e-posta adresine kayıtlı bir hesap bulunamadı.';
    case 'weak_password':
      return 'Şifre çok zayıf. Daha uzun ve karmaşık bir şifre seç.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar dene.';
    case 'signup_disabled':
      return 'Şu anda yeni kayıt kabul edilmiyor.';
    default:
      return error.message;
  }
}

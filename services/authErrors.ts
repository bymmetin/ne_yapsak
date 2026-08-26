import type { AuthError } from '@supabase/supabase-js';

// signUp bazen hata döndürmeden de "e-posta zaten kayıtlı" durumunu iletir
// (bkz. RegisterScreen'deki identities kontrolü). Aynı mesajı iki yerde farklı
// yazmamak için burada dışa açık.
export const EMAIL_ALREADY_REGISTERED_MESSAGE =
  'Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı dene.';

// Supabase auth hatalarını kullanıcıya gösterilecek anlaşılır Türkçe
// metinlere çevirir. Mesaj metni yerine `code` alanına bakılıyor çünkü
// Supabase İngilizce mesaj metnini zamanla değiştirebilir ama code sabit
// kalır. Bilinmeyen bir code gelirse (ör. ağ hatası) ham mesaj gösterilir.
export function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'E-posta veya şifre hatalı.';
    case 'user_already_exists':
      return EMAIL_ALREADY_REGISTERED_MESSAGE;
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
    // Gün 38: şifre sıfırlama - 8 haneli kod akışı (ForgotPasswordScreen >
    // verifyOtp). Supabase yanlış VE süresi dolmuş kod için aynı kodu
    // döndürüyor, ikisini ayırt eden ayrı bir sinyal yok.
    case 'otp_expired':
      return 'Kod geçersiz ya da süresi dolmuş. Yeni bir kod iste.';
    default:
      return error.message;
  }
}

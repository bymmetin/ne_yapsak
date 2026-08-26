import { validateLoginForm } from '../screens/LoginScreen';

// LoginScreen.tsx modülünü import edebilmek için (validateLoginForm export
// edilen tek şey ama modül seviyesinde supabase/expo-linking/expo-web-browser
// da import ediliyor) bu üçü mock'lanıyor - gerçek Supabase istemcisi .env
// olmadan createClient'ta throw ediyor (bkz. services/supabase.ts), bu bir
// birim testi, entegrasyon testi değil. babel-plugin-jest-hoist bu
// jest.mock() çağrılarını derleme zamanında yukarıdaki import'un ÜSTÜNE
// taşıyor - sıralama burada (kaynak dosyada) sadece eslint>import/first
// kuralını geçmek için, çalışma zamanı davranışını etkilemiyor.
jest.mock('../services/supabase', () => ({ supabase: {} }));
jest.mock('expo-linking', () => ({ createURL: jest.fn(() => 'test://auth-callback') }));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

describe('validateLoginForm', () => {
  it('geçersiz e-posta formatında hata döner', () => {
    expect(validateLoginForm('gecersiz-eposta', 'sifre123')).toBe(
      'Geçerli bir e-posta adresi gir.',
    );
  });

  it('boş e-postada hata döner', () => {
    expect(validateLoginForm('', 'sifre123')).toBe('Geçerli bir e-posta adresi gir.');
  });

  it('boş şifrede hata döner', () => {
    expect(validateLoginForm('test@example.com', '')).toBe('Şifreni gir.');
  });

  it('geçerli e-posta ve şifrede hata döndürmez', () => {
    expect(validateLoginForm('test@example.com', 'sifre123')).toBeNull();
  });

  it('e-postanın baştaki/sondaki boşlukları görmezden gelinir', () => {
    expect(validateLoginForm('  test@example.com  ', 'sifre123')).toBeNull();
  });
});

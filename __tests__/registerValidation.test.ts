import { validateForm } from '../screens/RegisterScreen';
import type { FormFields } from '../screens/RegisterScreen';

// LoginScreen testindeki aynı gerekçe - RegisterScreen.tsx da modül
// seviyesinde supabase/expo-linking import ediyor, gerçek çağrı yapılmasın
// diye mock'lanıyor (babel-plugin-jest-hoist bu çağrıları derlemede
// yukarıdaki import'un üstüne taşıyor).
jest.mock('../services/supabase', () => ({ supabase: {} }));
jest.mock('expo-linking', () => ({ createURL: jest.fn(() => 'test://auth-callback') }));

const validFields: FormFields = {
  firstName: 'Ahmet',
  lastName: 'Yılmaz',
  username: 'ahmet_y',
  email: 'ahmet@example.com',
  password: '123456',
  passwordConfirm: '123456',
};

describe('validateForm (kayıt formu)', () => {
  it('tüm alanlar geçerliyse hiç hata döndürmez', () => {
    expect(validateForm(validFields)).toEqual({});
  });

  it('2 karakterden kısa ad/soyadda hata döner', () => {
    const errors = validateForm({ ...validFields, firstName: 'A', lastName: '' });
    expect(errors.firstName).toBe('Ad en az 2 karakter olmalı.');
    expect(errors.lastName).toBe('Soyad en az 2 karakter olmalı.');
  });

  it('kullanıcı adı deseniyle eşleşmezse (büyük harf/kısa) hata döner', () => {
    const errors = validateForm({ ...validFields, username: 'AB' });
    expect(errors.username).toBe('3-20 karakter, sadece küçük harf, rakam ve alt çizgi.');
  });

  it('geçersiz e-posta formatında hata döner', () => {
    const errors = validateForm({ ...validFields, email: 'gecersiz-eposta' });
    expect(errors.email).toBe('Geçerli bir e-posta adresi gir.');
  });

  it('6 karakterden kısa şifrede hata döner', () => {
    const errors = validateForm({ ...validFields, password: '12345' });
    expect(errors.password).toBe('Şifre en az 6 karakter olmalı.');
  });

  it('şifre tekrarı eşleşmezse hata döner', () => {
    const errors = validateForm({ ...validFields, passwordConfirm: 'farkli123' });
    expect(errors.passwordConfirm).toBe('Şifreler eşleşmiyor.');
  });
});

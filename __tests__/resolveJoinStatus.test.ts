import { resolveJoinStatus } from '../services/participations';

// services/participations.ts, services/supabase.ts'i import ediyor - .env
// olmadan createClient throw ediyor, bu yüzden mock'lanıyor. resolveJoinStatus
// kendisi network'ten bağımsız saf bir fonksiyon (bkz. o dosyadaki yorum).
jest.mock('../services/supabase', () => ({ supabase: {} }));

describe('resolveJoinStatus', () => {
  it('katılımcı sayısı kapasiteden azsa onaylanır', () => {
    expect(resolveJoinStatus(5, 10)).toBe('onaylandi');
  });

  it('katılımcı sayısı kapasiteye eşitse (son yer az önce dolduysa) bekleme listesine düşer', () => {
    expect(resolveJoinStatus(10, 10)).toBe('beklemede');
  });

  it('katılımcı sayısı kapasiteyi aşmışsa bekleme listesine düşer', () => {
    expect(resolveJoinStatus(11, 10)).toBe('beklemede');
  });

  it('kapasite 0 iken (ve katılımcı 0) direkt bekleme listesine düşer', () => {
    expect(resolveJoinStatus(0, 0)).toBe('beklemede');
  });

  it('boş bir etkinlikte (0 katılımcı, pozitif kapasite) onaylanır', () => {
    expect(resolveJoinStatus(0, 1)).toBe('onaylandi');
  });
});

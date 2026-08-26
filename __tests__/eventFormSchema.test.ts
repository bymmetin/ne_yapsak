import { eventFormSchema } from '../components/EventForm';

// EventForm.tsx sadece eventFormSchema'yı almak için import edilse bile
// modül seviyesinde LocationPicker.tsx üzerinden react-native-maps/expo-
// location'a, kendisi de @react-native-community/datetimepicker,
// expo-image-picker ve services/supabase'e bağımlı - hiçbiri bu testte
// kullanılmıyor (sadece zod şeması test ediliyor) ama gerçek native
// modüller olmadan import bile patlıyor, bu yüzden hepsi mock'lanıyor
// (babel-plugin-jest-hoist bu çağrıları derlemede yukarıdaki import'un
// üstüne taşıyor).
jest.mock('../services/supabase', () => ({ supabase: {} }));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock('react-native-maps', () => ({
  __esModule: true,
  default: () => null,
  Marker: () => null,
  PROVIDER_DEFAULT: 'default',
}));
// @expo/vector-icons -> expo-font -> expo-asset zincirini tetikliyor;
// expo-asset projede kurulu değil (sadece Ionicons'un görsel render'ı için
// gerekli, bu testte hiç render yapılmıyor) - modülü baştan mock'lamak daha
// basit.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

const validData = {
  title: 'Sahilde Voleybol Turnuvası',
  description: 'Bu açıklama en az yirmi karakter uzunluğunda olacak şekilde özenle yazıldı.',
  category: 'spor' as const,
  dateTime: new Date('2026-09-01T18:00:00'),
  locationAddress: 'Caddebostan Sahili, Kadıköy',
  capacity: '50',
};

function expectMessage(result: ReturnType<typeof eventFormSchema.safeParse>, message: string) {
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues.some((issue) => issue.message === message)).toBe(true);
  }
}

describe('eventFormSchema', () => {
  it('geçerli veriyi kabul eder', () => {
    expect(eventFormSchema.safeParse(validData).success).toBe(true);
  });

  it('başlık 4 karakterse reddeder (min 5)', () => {
    expectMessage(
      eventFormSchema.safeParse({ ...validData, title: 'Abcd' }),
      'Başlık en az 5 karakter olmalı.',
    );
  });

  it('başlık tam 5 karakterse kabul eder', () => {
    expect(eventFormSchema.safeParse({ ...validData, title: 'Abcde' }).success).toBe(true);
  });

  it('başlık 80 karakterse kabul eder', () => {
    expect(eventFormSchema.safeParse({ ...validData, title: 'A'.repeat(80) }).success).toBe(true);
  });

  it('başlık 81 karakterse reddeder (max 80)', () => {
    expectMessage(
      eventFormSchema.safeParse({ ...validData, title: 'A'.repeat(81) }),
      'Başlık en fazla 80 karakter olabilir.',
    );
  });

  it('açıklama 19 karakterse reddeder (min 20)', () => {
    expectMessage(
      eventFormSchema.safeParse({ ...validData, description: 'A'.repeat(19) }),
      'Açıklama en az 20 karakter olmalı.',
    );
  });

  it('açıklama 1001 karakterse reddeder (max 1000)', () => {
    expectMessage(
      eventFormSchema.safeParse({ ...validData, description: 'A'.repeat(1001) }),
      'Açıklama en fazla 1000 karakter olabilir.',
    );
  });

  it('kapasite 0 ise reddeder', () => {
    expectMessage(
      eventFormSchema.safeParse({ ...validData, capacity: '0' }),
      'Kapasite en az 1 olmalı.',
    );
  });

  it('kapasite negatifse (eksi işareti) reddeder', () => {
    expectMessage(
      eventFormSchema.safeParse({ ...validData, capacity: '-5' }),
      'Kapasite sadece rakamlardan oluşmalı.',
    );
  });

  it('kapasite 1 ise kabul eder (alt sınır)', () => {
    expect(eventFormSchema.safeParse({ ...validData, capacity: '1' }).success).toBe(true);
  });

  it('kapasite 100000 ise kabul eder (üst sınır)', () => {
    expect(eventFormSchema.safeParse({ ...validData, capacity: '100000' }).success).toBe(true);
  });

  it('kapasite 100001 ise reddeder (üst sınırın üstü)', () => {
    expectMessage(
      eventFormSchema.safeParse({ ...validData, capacity: '100001' }),
      'Kapasite en fazla 100000 olabilir.',
    );
  });

  it('geçersiz kategori değerini reddeder', () => {
    expect(
      eventFormSchema.safeParse({ ...validData, category: 'olmayan-kategori' }).success,
    ).toBe(false);
  });
});

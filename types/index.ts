// Uygulama genelinde kullanılan temel veri modelleri.
// supabase/schema.sql'deki tablolara karşılık gelir (Gün 7). Gerçek sorgular
// bağlanınca (Gün 17+) snake_case DB satırlarından bu camelCase tiplere
// dönüşüm burada değil, ilgili servis fonksiyonunda yapılacak.

export type Category = 'muzik' | 'spor' | 'sanat' | 'yemek' | 'egitim' | 'teknoloji' | 'diger';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
}

export interface Event {
  id: string;
  organizerId: string;
  title: string;
  description: string;
  category: Category;
  date: string;
  time: string;
  location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  capacity: number;
  participantCount: number;
  coverPhotoUrl: string | null;
  createdAt: string;
}

export interface Participation {
  id: string;
  eventId: string;
  userId: string;
  participationDate: string;
  status: 'onaylandi' | 'beklemede' | 'iptal';
}

export interface Comment {
  id: string;
  eventId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface Favorite {
  id: string;
  eventId: string;
  userId: string;
  createdAt: string;
}

// puanlamalar tablosu (Gün 29) - Comment (yorumlar, Gün 31-32) ile KARIŞTIRMA,
// bkz. supabase/schema.sql > puanlamalar notu.
export interface Rating {
  id: string;
  eventId: string;
  userId: string;
  score: number;
  comment: string | null;
  createdAt: string;
}

// Gün 21: Tek seferlik demo/test verisi betiği.
//
// ⚠️ TEK SEFERLİK - TEKRAR ÇALIŞTIRMA. Bu betik idempotent değil; ikinci
// çalıştırmada "dolu" senaryosundaki katılım insert'leri unique (etkinlik_id,
// kullanici_id) kısıtına çarpıp hata verir. Yeniden veri üretmek istersen
// önce oluşturduğu üç etkinliği (başlıklarından) elle sil, sonra çalıştır.
//
// ⚠️ GÜVENLİK: SUPABASE_SERVICE_ROLE_KEY'i ASLA commit'leme veya istemci
// (uygulama) koduna gömme. Bu anahtar RLS'i tamamen atlar, tüm tablolara
// sınırsız okuma/yazma erişimi verir - anon key'in aksine sadece güvenilir
// bir sunucu/betik ortamında (burada olduğu gibi) kullanılmalı. .env zaten
// .gitignore'da; bu değişmeden kalmalı.
//
// Bu betik Expo'nun DIŞINDA, düz bir node süreci olarak elle çalıştırılır:
// bkz. dosya sonundaki çalıştırma komutu. Expo'nun EXPO_PUBLIC_ önekiyle
// derleme zamanında client koduna gömdüğü değişkenlerin aksine, burada
// process.env'e "dotenv" paketiyle (zaten node_modules'ta, Expo tooling'in
// bir bağımlılığı) elle yükleniyor.

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '.env dosyasında EXPO_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY bulunamadı.',
  );
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Demo hesapları için ortak, sabit bir şifre - gerçek bir e-postaya ihtiyaç
// yok (email_confirm: true ile doğrulama adımı zaten atlanıyor), bu yüzden
// güvenlik açısından kritik bir değer değil.
const DEMO_PASSWORD = 'Demo1234!';

// Yeni oluşturulacak 5 hesap. ad/soyad/kullanici_adi user_metadata'ya
// gidiyor - schema.sql'deki handle_new_user trigger'ı (Gün 12) bunu okuyup
// profiles satırını otomatik oluşturuyor, burada ayrıca bir profiles
// insert'üne gerek yok.
const NEW_USERS = [
  { email: 'can.ozturk@ornek.com', firstName: 'Can', lastName: 'Öztürk', username: 'canozturk' },
  { email: 'elif.sahin@ornek.com', firstName: 'Elif', lastName: 'Şahin', username: 'elifsahin' },
  { email: 'burak.aydin@ornek.com', firstName: 'Burak', lastName: 'Aydın', username: 'burakaydin' },
  {
    email: 'deniz.yildiz@ornek.com',
    firstName: 'Deniz',
    lastName: 'Yıldız',
    username: 'denizyildiz',
  },
  {
    email: 'selin.arslan@ornek.com',
    firstName: 'Selin',
    lastName: 'Arslan',
    username: 'selinarslan',
  },
];

// Bunlar zaten var olmalı (daha önce uygulama üzerinden kayıt olunmuş) -
// betik bunları yeniden oluşturmaya ÇALIŞMIYOR, sadece e-postayla bulup
// id'lerini kullanıyor.
const EXISTING_EMAILS = ['ayse.yilmaz@ornek.com', 'mert.demir@ornek.com', 'zeynep.kaya@ornek.com'];

// tarih kolonu (schema.sql) date tipinde - EventForm.tsx'teki
// dateToDbFormat ile aynı yerel-tarih biçimi (YYYY-MM-DD), UTC kaymasından
// kaçınmak için Date bileşenleri elle okunuyor.
function addDays(dayOffset) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// auth.users PostgREST üzerinden (.from(...)) sorgulanamıyor - admin
// API'sindeki listUsers tek yol. Bu projede toplam kullanıcı sayısı küçük
// olduğu için perPage'i yüksek tutup tek sayfada tüm kullanıcıları çekmek
// yeterli; ileride kullanıcı sayısı büyürse burası gerçek sayfalamaya
// ihtiyaç duyar.
async function getAllUsers() {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users;
}

async function main() {
  console.log('Kullanıcılar hazırlanıyor...');
  const existingUsers = await getAllUsers();
  const ids = {};

  for (const email of EXISTING_EMAILS) {
    const user = existingUsers.find((u) => u.email === email);
    if (!user) {
      throw new Error(
        `Var olması beklenen kullanıcı bulunamadı: ${email} - önce bu hesapla uygulamadan kayıt olunmuş olması gerekiyor.`,
      );
    }
    ids[email] = user.id;
    console.log(`  = zaten var: ${email}`);
  }

  for (const newUser of NEW_USERS) {
    const alreadyExists = existingUsers.find((u) => u.email === newUser.email);
    if (alreadyExists) {
      ids[newUser.email] = alreadyExists.id;
      console.log(`  = zaten var (yeniden oluşturulmadı): ${newUser.email}`);
      continue;
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: newUser.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        ad: newUser.firstName,
        soyad: newUser.lastName,
        kullanici_adi: newUser.username,
      },
    });

    if (error) throw error;
    ids[newUser.email] = data.user.id;
    console.log(`  + oluşturuldu: ${newUser.email}`);
  }

  const ayseId = ids['ayse.yilmaz@ornek.com'];
  const mertId = ids['mert.demir@ornek.com'];
  const zeynepId = ids['zeynep.kaya@ornek.com'];
  const canId = ids['can.ozturk@ornek.com'];
  const elifId = ids['elif.sahin@ornek.com'];
  const burakId = ids['burak.aydin@ornek.com'];
  const denizId = ids['deniz.yildiz@ornek.com'];
  const selinId = ids['selin.arslan@ornek.com'];

  console.log('Eski test etkinlikleri temizleniyor...');
  // on delete cascade (schema.sql) sayesinde bu etkinliklere bağlı eski
  // katilimlar satırları da kendiliğinden siliniyor.
  const { error: deleteError } = await supabaseAdmin
    .from('etkinlikler')
    .delete()
    .in('baslik', ['Gecmis Test Etkinligi', 'Normal Test Etkinligi', 'Dolu Test Etkinligi']);
  if (deleteError) throw deleteError;

  console.log('Yeni etkinlikler ekleniyor...');

  const { data: runEvent, error: runEventError } = await supabaseAdmin
    .from('etkinlikler')
    .insert({
      organizator_id: ayseId,
      baslik: 'Kadıköy Sahilinde Sabah Koşusu',
      aciklama:
        'Her Cumartesi sabahı Kadıköy sahilinde birlikte koşuyoruz. Her seviyeden koşucuya açık, tempo grup içinde ayarlanıyor. Koşu sonrası sahildeki kafede kısa bir kahve molası veriyoruz.',
      kategori: 'spor',
      tarih: addDays(-5),
      saat: '07:00:00',
      konum_adres: 'Kadıköy Sahili, İstanbul',
      konum_lat: 40.9909,
      konum_lng: 29.0304,
      kapasite: 25,
    })
    .select('id')
    .single();
  if (runEventError) throw runEventError;

  const { data: acousticEvent, error: acousticEventError } = await supabaseAdmin
    .from('etkinlikler')
    .insert({
      organizator_id: mertId,
      baslik: "Beşiktaş'ta Akustik Gece",
      aciklama:
        'Beşiktaş sahilindeki kafede akustik gitar ve vokal eşliğinde bir gece düzenliyoruz. Sahne herkese açık; katılımcılar isterlerse kendi enstrümanlarını getirip birkaç şarkı çalabilir.',
      kategori: 'muzik',
      tarih: addDays(7),
      saat: '20:00:00',
      konum_adres: 'Beşiktaş, İstanbul',
      konum_lat: 41.0422,
      konum_lng: 29.0083,
      kapasite: 50,
    })
    .select('id')
    .single();
  if (acousticEventError) throw acousticEventError;

  const { data: startupEvent, error: startupEventError } = await supabaseAdmin
    .from('etkinlikler')
    .insert({
      organizator_id: zeynepId,
      baslik: "Şişli'de Girişimcilik Buluşması",
      aciklama:
        'Erken aşama girişimcilerin bir araya gelip fikir paylaştığı, network kurduğu aylık buluşmamız. Bu ayki temamız ürün-pazar uyumu; katılımcılardan kısa birer proje sunumu bekliyoruz.',
      kategori: 'teknoloji',
      tarih: addDays(3),
      saat: '18:30:00',
      konum_adres: 'Şişli, İstanbul',
      konum_lat: 41.0602,
      konum_lng: 28.9877,
      kapasite: 8,
    })
    .select('id')
    .single();
  if (startupEventError) throw startupEventError;

  console.log('Katılımlar ekleniyor...');

  const acousticParticipants = [zeynepId, canId, elifId, burakId, denizId];
  const { error: acousticParticipationError } = await supabaseAdmin.from('katilimlar').insert(
    acousticParticipants.map((userId) => ({
      etkinlik_id: acousticEvent.id,
      kullanici_id: userId,
    })),
  );
  if (acousticParticipationError) throw acousticParticipationError;

  // Kapasite 8, 8 hesabın tamamı (organizatör Zeynep dahil) katılımcı -
  // Etkinlik Detay'da "Etkinlik dolu" ve Keşfet kartında "Dolu" rozetini
  // test etmek için.
  const startupParticipants = [ayseId, mertId, canId, elifId, burakId, denizId, selinId, zeynepId];
  const { error: startupParticipationError } = await supabaseAdmin.from('katilimlar').insert(
    startupParticipants.map((userId) => ({
      etkinlik_id: startupEvent.id,
      kullanici_id: userId,
    })),
  );
  if (startupParticipationError) throw startupParticipationError;

  console.log('Bitti.');
  console.log(`  - Kadıköy Sahilinde Sabah Koşusu: ${runEvent.id} (geçmiş, 0/25)`);
  console.log(`  - Beşiktaş'ta Akustik Gece: ${acousticEvent.id} (gelecek, 5/50)`);
  console.log(`  - Şişli'de Girişimcilik Buluşması: ${startupEvent.id} (gelecek, 8/8 dolu)`);
}

main().catch((err) => {
  console.error('HATA:', err.message ?? err);
  process.exit(1);
});

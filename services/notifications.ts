import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';
import { Event } from '../types';

// Gün 19: Etkinlik iptal/silme akışında katılımcılara bildirim gönderme
// mantığının TASLAĞI.
//
// Gün 28 karar notu: expo-notifications kuruldu ama SADECE yerel bildirim +
// izin akışı + push token TOPLAMA kapsamında (bkz. registerForPushNotifications-
// Async aşağıda). Gerçek uzak gönderim (bir sunucudan bu kullanıcılara push
// atmak) development build + FCM/APNs gerektiriyor - Google OAuth'la aynı
// kategoride, bu 40 günlük planın bilinçli olarak dışında tutuldu. Bu yüzden
// sendNotification/sendWaitlistNotification aşağıda KASITLI olarak taslak
// (konsola loglama) kalıyor; imzaları (EventCancellationNotification,
// WaitlistSpotOpenedNotification) ileride gerçek bir sunucu çağrısına
// bağlanabilecek şekilde tasarlandığı için hazır, ama bu iş bu planın dışında.
export type EventCancellationNotification = {
  recipientUserId: string;
  eventTitle: string;
};

// Taslak gönderim kanalı: şimdilik konsola loglanıyor, kasıtlı olarak öyle
// kalıyor (yukarıdaki Gün 28 notuna bkz.) - gerçek gönderim development
// build gerektirdiği için bu planın kapsamı dışında.
function sendNotification(notification: EventCancellationNotification): void {
  console.log(
    `[bildirim taslağı] ${notification.recipientUserId} kullanıcısına ` +
      `"${notification.eventTitle}" etkinliğinin iptal edildiği bildirilecek.`,
  );
}

// Best-effort: bir katılımcıya bildirim tetiklenememesi (bugün sadece
// loglama olsa da, Gün 28'den sonra gerçek bir ağ çağrısı olunca) etkinliğin
// zaten silinmiş olması gerçeğini değiştirmemeli - bu yüzden çağıran ekrana
// hata fırlatmak yerine burada yutuluyor.
export function notifyParticipantsOfCancellation(
  participantIds: string[],
  eventTitle: string,
): void {
  try {
    participantIds.forEach((userId) => sendNotification({ recipientUserId: userId, eventTitle }));
  } catch (err) {
    console.warn('Katılımcılara iptal bildirimi tetiklenemedi:', err);
  }
}

// Gün 21: Bekleme listesi - onaylı bir katılımcı etkinlikten ayrılınca
// sıradaki kişiye "yer açıldı" bildirimi tetikleme mantığının TASLAĞI.
// notifyParticipantsOfCancellation ile aynı desen ve aynı gerekçeyle
// (yukarıdaki Gün 28 notu) KASITLI olarak taslak kalıyor - tek fark burada
// tek bir alıcı olması (bkz. services/participations.ts >
// getNextWaitlistedUserId, FIFO sırayla sıradaki tek kişiyi döndürüyor).
export type WaitlistSpotOpenedNotification = {
  recipientUserId: string;
  eventTitle: string;
};

function sendWaitlistNotification(notification: WaitlistSpotOpenedNotification): void {
  console.log(
    `[bildirim taslağı] ${notification.recipientUserId} kullanıcısına ` +
      `"${notification.eventTitle}" etkinliğinde yer açıldığı bildirilecek.`,
  );
}

// recipientUserId null olabilir (bekleme listesi boşsa, bkz.
// getNextWaitlistedUserId) - bu durumda sessizce hiçbir şey yapmıyor, çağıran
// ekranın (EventDetailScreen) ayrıca kontrol etmesine gerek kalmıyor.
export function notifyNextWaitlistedParticipant(
  recipientUserId: string | null,
  eventTitle: string,
): void {
  if (!recipientUserId) return;

  try {
    sendWaitlistNotification({ recipientUserId, eventTitle });
  } catch (err) {
    console.warn('Bekleme listesindeki katılımcıya bildirim tetiklenemedi:', err);
  }
}

// Gün 28: Bildirim izni + push token toplama.
//
// LocationPicker.tsx > useCurrentLocation ve ProfileScreen.tsx > pickAvatar
// ile AYNI desen: izin reddedilirse sessizce hiçbir şey yapmıyoruz, çağırana
// (NotificationsScreen) NEDEN hiçbir şey olmadığını gösterecek net bir durum
// döndürüyoruz - "sessiz başarısızlık" değil, kullanıcıya görünür bir mesaj.
export type PushRegistrationResult =
  { granted: true; expoPushToken: string | null } | { granted: false };

// Android 13+ (API 33) bildirim izni runtime'da isteniyor - requestPermissions-
// Async bunu otomatik yönetiyor, ayrı bir Android sürüm kontrolüne gerek yok.
// Android bildirim KANALI ise izinden bağımsız bir kavram (iOS'ta yok) - önce
// kanalı oluşturuyoruz, izin durumuna bakılmaksızın (kanal, kullanıcı izin
// verdiğinde bildirimlerin hangi ayarlarla - ses, öncelik - görüneceğini
// tanımlıyor).
export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    return { granted: false };
  }

  // Expo push token'ı almak EAS projectId gerektiriyor (app.json'da eas.json
  // henüz yok - bu proje EAS'a bağlanmadı, o adım da development build gibi
  // kapsam dışı). projectId yoksa ya da Expo Go'nun bu SDK'da uzak push
  // token'ı desteklemediği bir ortamdaysak getExpoPushTokenAsync hata
  // fırlatabilir; bu BEKLENEN bir durum, izin akışını bozmamalı - bu yüzden
  // izin sonucu (granted: true) token'dan bağımsız döndürülüyor, token
  // alınamazsa null. Asıl gönderim zaten bu planın kapsamında değil, burada
  // sadece ileride kullanılabilecek altyapı kuruluyor.
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return { granted: true, expoPushToken: tokenResponse.data };
  } catch (err) {
    console.warn('Expo push token alınamadı (EAS projesi kurulu değil olabilir):', err);
    return { granted: true, expoPushToken: null };
  }
}

// Token'ı profiles.expo_push_token'a yazar (bkz. supabase/schema.sql > Gün
// 28). Best-effort: NotificationsScreen için bu adımın başarısız olması
// (ör. ağ hatası) izin akışının geri kalanını bozmamalı, bu yüzden burada da
// notifyParticipantsOfCancellation'daki gibi hata yutuluyor, sadece
// loglanıyor.
export async function saveExpoPushToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ expo_push_token: token })
    .eq('id', userId);

  if (error) {
    console.warn('Push token profiles tablosuna kaydedilemedi:', error.message);
  }
}

// Gün 29: Etkinlik hatırlatma + değerlendirme daveti bildirimleri.
//
// Mimari not: "etkinlik bitiş saati" schema.sql'de yok (sadece başlangıç
// tarih+saat var, bkz. etkinlikler tablosu) - staj sahibiyle netleştirildi:
// sabit bir süre varsayımı kullanılıyor (EVENT_ASSUMED_DURATION_HOURS),
// gerçek bir bitiş alanı eklemek bu günün kapsamı dışında tutuldu.
const EVENT_ASSUMED_DURATION_HOURS = 3;

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

// katilimlar tablosundan bağımsız, sadece bu cihaza özel bir eşleme - yerel
// bildirimler cihaza bağlı olduğu için (bkz. Gün 28 kapsam notu) başka bir
// cihazda planlanmış bir bildirimi buradan iptal etmek zaten mümkün değil.
const NOTIFICATION_STORAGE_KEY = '@ne_yapsak/etkinlik_bildirimleri';

type ScheduledEventNotifications = {
  gunOncesi?: string;
  saatOncesi?: string;
  degerlendirme?: string;
};

async function readScheduledMap(): Promise<Record<string, ScheduledEventNotifications>> {
  const raw = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function writeScheduledMap(map: Record<string, ScheduledEventNotifications>): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(map));
}

// EventEditScreen.tsx > buildDateTime ve EventCard.tsx > isEventPast ile aynı
// yerel-zaman yaklaşımı - new Date(`${tarih}T${saat}`) kullanmadık çünkü bu,
// motora göre UTC ya da yerel yorumlanabiliyor.
function parseEventStart(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

// Bildirime dokunulunca App.tsx'teki response listener'ın hangi ekrana
// gideceğine karar verebilmesi için content.data'ya konuyor (bkz. App.tsx >
// handleNotificationResponse).
type NotificationRoute = 'reminder' | 'rating';

function buildNotificationData(type: NotificationRoute, eventId: string) {
  return { type, eventId };
}

// Bir etkinliğe katılım başarılı olduğunda (EventDetailScreen > startJoin)
// çağrılıyor: etkinlikten 1 gün ve 1 saat önce iki hatırlatma + bitişinde
// (varsayılan süre sonunda) bir değerlendirme daveti planlıyor. Her biri
// BAĞIMSIZ olarak zamanı geçmişse atlanıyor (ör. etkinliğe son 1 saat içinde
// katılındıysa "1 saat önce" hatırlatması artık anlamsız) - hata fırlatmıyor,
// sadece o bildirimi hiç planlamıyor. Madde 8: registerForPushNotificationsAsync
// zaten idempotent olduğu için burada tekrar çağırmak güvenli - kullanıcı hiç
// Bildirimler sekmesine girmemiş olsa bile izin burada isteniyor ki
// hatırlatmalar çalışabilsin; izin verilmezse (granted: false) planlayacak
// bir şey olmadığından sessizce çıkılıyor (diğer izin akışlarıyla aynı
// "sessiz başarısızlık DEĞİL ama burada Alert de gösterilmiyor" dengesi -
// EventDetailScreen zaten başka bir hata göstermiyor, katılım kendisi
// başarılı oldu).
export async function scheduleEventNotifications(
  event: Pick<Event, 'id' | 'title' | 'date' | 'time'>,
): Promise<void> {
  const registration = await registerForPushNotificationsAsync();
  if (!registration.granted) return;

  const eventStart = parseEventStart(event.date, event.time).getTime();
  const now = Date.now();
  const scheduled: ScheduledEventNotifications = {};

  const dayBeforeTime = eventStart - ONE_DAY_MS;
  if (dayBeforeTime > now) {
    scheduled.gunOncesi = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Yarın: ' + event.title,
        body: `"${event.title}" etkinliği yarın gerçekleşecek.`,
        data: buildNotificationData('reminder', event.id),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(dayBeforeTime),
      },
    });
  }

  const hourBeforeTime = eventStart - ONE_HOUR_MS;
  if (hourBeforeTime > now) {
    scheduled.saatOncesi = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Yaklaşıyor: ' + event.title,
        body: `"${event.title}" etkinliği 1 saat sonra başlıyor.`,
        data: buildNotificationData('reminder', event.id),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(hourBeforeTime),
      },
    });
  }

  const ratingTime = eventStart + EVENT_ASSUMED_DURATION_HOURS * ONE_HOUR_MS;
  if (ratingTime > now) {
    scheduled.degerlendirme = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Etkinlik nasıldı?',
        body: `"${event.title}" etkinliğini değerlendirmek ister misin?`,
        data: buildNotificationData('rating', event.id),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(ratingTime),
      },
    });
  }

  if (Object.keys(scheduled).length === 0) return;

  const map = await readScheduledMap();
  map[event.id] = scheduled;
  await writeScheduledMap(map);
}

// Kullanıcı etkinlikten ayrılınca (leaveEvent) veya etkinlik silinince
// (deleteEvent - sadece siliciyi kendi cihazındaki planlanmış bildirimlere,
// bkz. yukarıdaki "bu cihaza özel eşleme" notu) çağrılıyor. Bu etkinlik için
// hiç bildirim planlanmamışsa (ör. izin reddedilmişti ya da tüm zamanlar
// zaten geçmişti) map'te kayıt yok - no-op.
//
// BİLİNÇLİ SINIRLAMA: Bir etkinlik iptal edilince (silinince) ya da tarihi/
// saati değiştirilince (EventEditScreen, bu fonksiyonu HİÇ çağırmıyor) bu
// fonksiyon SADECE işlemi yapan kişinin (organizatörün) kendi cihazındaki
// yerel bildirimleri iptal edebilir. Etkinliğe katılmış DİĞER kullanıcıların
// cihazlarında zaten planlanmış olan hatırlatma/değerlendirme bildirimleri
// bundan tamamen habersiz kalır ve olduğu gibi tetiklenmeye devam eder -
// çünkü "bu etkinlik artık geçersiz/tarihi değişti" bilgisini başka bir
// cihaza ulaştırmanın tek yolu uzak (remote) push, o da Gün 28'de development
// build gerektirdiği için kapsam dışı bırakıldı (bkz. dosyanın başındaki Gün
// 28 notu). Bu, yerel-bildirim-only mimarinin doğal bir sonucu; düzeltmek
// için gerçek push altyapısı (sunucu tarafı bildirim tetikleme) gerekir.
//
// Gün 34 notu: Bu sınırlama artık sadece bildirimleri değil, sessizce daha
// fazlasını da kapsıyor - etkinlikler silinince supabase/schema.sql'deki
// "on delete cascade" kısıtları yorumlar/favoriler/puanlamalar satırlarını da
// otomatik siliyor. Yani o bayat hatırlatma/değerlendirme bildirimine dokunan
// bir katılımcı sadece "Etkinlik bulunamadı" ekranıyla karşılaşmakla kalmıyor
// (bu zaten düzgün ele alınıyor, bkz. EventDetailScreen/RatingScreen'in null
// event kontrolü) - kendi yazdığı yorumun ya da favorisinin de ne zaman/neden
// kaybolduğunu hiç öğrenmeden sessizce kaybediyor. Davranış bilerek böyle
// bırakıldı (yukarıdaki gerekçeyle), sadece kapsamı burada netleştiriliyor.
export async function cancelEventNotifications(eventId: string): Promise<void> {
  const map = await readScheduledMap();
  const ids = map[eventId];
  if (!ids) return;

  const identifiers = [ids.gunOncesi, ids.saatOncesi, ids.degerlendirme].filter(
    (id): id is string => Boolean(id),
  );

  await Promise.all(
    identifiers.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch((err) => {
        console.warn('Planlanmış bildirim iptal edilemedi:', err);
      }),
    ),
  );

  delete map[eventId];
  await writeScheduledMap(map);
}

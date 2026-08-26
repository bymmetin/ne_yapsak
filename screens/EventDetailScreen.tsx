import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isEventPast, formatDateTime, MONTHS } from '../components/EventCard';
import ErrorState from '../components/ErrorState';
import CategoryTag from '../components/CategoryTag';
import LoadingState from '../components/LoadingState';
import { radius, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import { addComment, getComments, CommentWithAuthor } from '../services/comments';
import { getEvent } from '../services/events';
import { addFavorite, isEventFavorited, removeFavorite } from '../services/favorites';
import { requireLogin } from '../navigation/navigationRef';
import { blockUser, reportComment } from '../services/moderation';
import {
  notifyParticipantsOfCancellation,
  notifyNextWaitlistedParticipant,
  scheduleEventNotifications,
  cancelEventNotifications,
} from '../services/notifications';
import {
  joinEvent,
  getConfirmedParticipants,
  getEventParticipantIds,
  getNextWaitlistedUserId,
  leaveEvent,
  getParticipationStatus,
  resolveJoinStatus,
  Participant,
  ParticipationStatus,
} from '../services/participations';
import { supabase } from '../services/supabase';
import { Event } from '../types';
import type { DiscoverStackParamList } from '../types/navigation';

const VISIBLE_AVATAR_COUNT = 5;

// Yorum zaman damgası (created_at, ISO timestamptz) için - event.date/
// event.time'ın kullandığı formatDateTime'dan ayrı çünkü kaynak farklı bir
// şekilde geliyor (DB'de "YYYY-MM-DD"+"HH:MM" değil, tek bir ISO string).
// Aynı MONTHS dizisini (EventCard.tsx) kullanmak, cihazın Intl desteğine
// güvenmeme kararıyla tutarlı kalıyor.
function formatCommentDate(iso: string): string {
  const d = new Date(iso);
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hour}:${minute}`;
}

type Status = 'loading' | 'error' | 'ready';

type Props = NativeStackScreenProps<DiscoverStackParamList, 'EventDetail'>;

export default function EventDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Gün 35: eskiden modül seviyesinde sabit bir dizi - colors artık
  // useTheme()'den geldiği için (sadece component içinde erişilebilir)
  // buraya taşındı, aynı [colors] bağımlılığıyla useMemo'ya sarmalandı.
  const avatarColors = useMemo(
    () => [colors.primary, colors.secondary, colors.warning, colors.error, colors.primaryDark],
    [colors],
  );
  const [participationStatus, setParticipationStatus] = useState<ParticipationStatus | null>(null);
  const [joining, setJoining] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [deleting, setDeleting] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [reportTarget, setReportTarget] = useState<CommentWithAuthor | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [sendingReport, setSendingReport] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);

  const fetchEvent = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await getEvent(route.params.eventId);
      setEvent(result);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [route.params.eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // Kullanıcı bu etkinliğe daha önce (farklı bir oturumda ya da
  // scripts/demo-seed.js ile) katılmış ya da bekleme listesine girmiş
  // olabilir - butonun açılışta doğru durumda (Katıldın ✓ / Bekleme
  // Listesindesin / Katıl) gelmesi için etkinlik yüklenince bir kere
  // kontrol ediyoruz.
  useEffect(() => {
    if (!event || !userId) return;
    getParticipationStatus(event.id, userId)
      .then(setParticipationStatus)
      .catch(() => {
        // Sessizce yut: bu sadece buton durumunu belirliyor, kullanıcı yine
        // de "Katıl"a basabilir - zaten katılmışsa unique constraint
        // insert'i reddeder ve startJoin hatayı Alert ile gösterir.
      });
  }, [event, userId]);

  // Gün 33: header'daki kalp ikonunun açılıştaki dolu/boş durumu -
  // yukarıdaki getParticipationStatus effect'iyle aynı gerekçe (sadece
  // ikonun başlangıç durumunu belirliyor, hata sessizce yutuluyor).
  useEffect(() => {
    if (!event || !userId) return;
    isEventFavorited(event.id, userId)
      .then(setIsFavorite)
      .catch(() => {
        // Sessizce yut: yukarıdaki katılım effect'iyle aynı yaklaşım.
      });
  }, [event, userId]);

  // Gün 22: Katılımcı avatarları için gerçek liste. `event` bağımlılığı
  // kasıtlı olarak tüm nesne - startJoin/startLeave 'onaylandi' durumunda
  // yeni bir event nesnesi kurduğunda (participantCount iyimser güncellemesi)
  // bu effect de yeniden tetiklenip listeyi tazeler; ayrıca ayrı bir
  // "katıldıktan/ayrıldıktan sonra tazele" çağrısına gerek kalmıyor. Gün 34'te
  // userId de eklendi - getConfirmedParticipants artık kullanıcının
  // engellediklerini avatar listesinden filtrelemek için buna ihtiyaç
  // duyuyor (bkz. services/participations.ts).
  useEffect(() => {
    if (!event) return;
    getConfirmedParticipants(event.id, userId)
      .then(setParticipants)
      .catch(() => {
        // Sessizce yut: avatar listesi ikincil bir gösterim, ana ekranı
        // (event verisi) engellemeye değmez - getParticipationStatus'teki
        // aynı yaklaşım.
      });
  }, [event, userId]);

  // Gün 31: Yorum listesi. `event` bağımlılığı yukarıdaki participants
  // effect'iyle aynı gerekçeyle tüm nesne. Gün 32'de userId de eklendi -
  // getComments artık kullanıcının engellediklerini filtrelemek için buna
  // ihtiyaç duyuyor (bkz. services/comments.ts).
  const fetchComments = useCallback(async () => {
    if (!event) return;
    setCommentsLoading(true);
    try {
      const result = await getComments(event.id, userId);
      setComments(result);
    } catch {
      // Sessizce yut: yorum listesi ikincil bir gösterim, ana ekranı (event
      // verisi) engellemeye değmez - participants effect'iyle aynı yaklaşım.
    } finally {
      setCommentsLoading(false);
    }
  }, [event, userId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Boş/sadece boşluktan oluşan yorum gönderilemez - trim() sonucu boşsa
  // buton zaten disabled (aşağıdaki JSX), bu ek kontrol savunma amaçlı.
  const submitComment = async () => {
    if (!event) return;
    // Gün 38: Guest modu - yorum girişi/gönder butonu artık userId'den
    // bağımsız her zaman görünür (bkz. aşağıdaki commentInputRow JSX'i),
    // dokununca Giriş ekranına yönlendiriliyor; yazdığı metin kaybolur, bu
    // kabul edilebilir (form verisini köprüleyecek bir mekanizma bu günün
    // kapsamı dışı).
    if (!userId) {
      requireLogin();
      return;
    }
    const trimmed = commentText.trim();
    if (!trimmed) return;

    setSendingComment(true);
    try {
      await addComment(event.id, userId, trimmed);
      setCommentText('');
      await fetchComments();
    } catch (err) {
      Alert.alert('Yorum gönderilemedi', err instanceof Error ? err.message : String(err));
    } finally {
      setSendingComment(false);
    }
  };

  // Gün 32: yorum başına "..." menüsü - "Şikayet Et" opsiyonel sebep alan bir
  // modal açıyor (RN'in Alert.prompt'u sadece iOS'ta çalıştığı için, Android'de
  // de çalışsın diye aşağıdaki custom Modal'a yönlendiriyoruz), "Kullanıcıyı
  // Engelle" ise doğrudan bir onay diyaloğu (startLeave'deki "Emin misin?"
  // deseniyle aynı).
  const openCommentMenu = (comment: CommentWithAuthor) => {
    Alert.alert('Yorum işlemleri', undefined, [
      {
        text: 'Şikayet Et',
        onPress: () => {
          setReportReason('');
          setReportTarget(comment);
        },
      },
      {
        text: 'Kullanıcıyı Engelle',
        style: 'destructive',
        onPress: () => confirmBlock(comment),
      },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  };

  const confirmBlock = (comment: CommentWithAuthor) => {
    if (!userId) return;
    const authorName = `${comment.authorFirstName} ${comment.authorLastName}`.trim();

    Alert.alert(
      `${authorName || 'Bu kullanıcıyı'} engellemek istiyor musun?`,
      'Bu kullanıcının yorumları artık sana gösterilmeyecek.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Engelle',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(userId, comment.userId);
              // Yeniden fetch yerine client-side filtre - schema.sql notunda
              // da bahsedildiği gibi ikisi de kabul edilebilir, bu anlık
              // güncelleme için ekstra bir ağ isteğine gerek bırakmıyor.
              setComments((prev) => prev.filter((c) => c.userId !== comment.userId));
            } catch (err) {
              Alert.alert('Engellenemedi', err instanceof Error ? err.message : String(err));
            }
          },
        },
      ],
    );
  };

  const closeReportModal = () => {
    setReportTarget(null);
    setReportReason('');
  };

  const submitReport = async () => {
    if (!userId || !reportTarget) return;

    setSendingReport(true);
    try {
      await reportComment(userId, reportTarget.id, reportReason.trim() || null);
      closeReportModal();
      Alert.alert('Şikayetin alındı', 'Bildirimin için teşekkürler.');
    } catch (err) {
      Alert.alert('Şikayet gönderilemedi', err instanceof Error ? err.message : String(err));
    } finally {
      setSendingReport(false);
    }
  };

  // Gün 30: katilimlar tablosunda bu etkinliğe ait bir satır INSERT/UPDATE/
  // DELETE olunca (biri katılınca, ayrılınca ya da bekleme listesi durumu
  // değişince - kendi cihazımızdaki değişiklikler dahil, Supabase Realtime
  // kendi yazdığımızı da geri yayınlıyor) ekranı taze veriyle güncelliyoruz.
  // Yerel bir sayaçla +1/-1 YAPMIYORUZ (plan kararı) - fetchEvent zaten
  // katilimlar(count) aggregate'ini yeniden hesaplıyor (services/events.ts >
  // eventsQuery, durum='onaylandi' filtresi dahil) ve getConfirmedParticipants
  // avatar listesini tazeliyor; ikisini burada da tekrar çağırmak,
  // onaylandi/beklemede ayrımını burada yeniden yazmaktan daha güvenli.
  // useFocusEffect kullanılıyor (düz useEffect değil): ekran unmount
  // olmadan sadece BLUR olduğunda da (ör. "Etkinliği Değerlendir" ile Rating
  // ekranına push edilince EventDetail arkada mount kalır) kanaldan çıkmak
  // istiyoruz - düz bir useEffect cleanup'ı bunu yakalamazdı, sadece unmount'ta
  // çalışırdı. Bağımlılık kasıtlı olarak `event?.id`, tüm `event` nesnesi
  // DEĞİL - fetchEvent her tetiklendiğinde yeni bir event nesnesi kurduğu
  // için (bkz. fetchEvent > setEvent) tüm nesneye bağımlı olsaydı her
  // güncellemede kanal yeniden kurulur, bu da "güncelle -> yeniden abone ol
  // -> tekrar güncelle" döngüsüne yol açardı.
  useFocusEffect(
    useCallback(() => {
      if (!event) return;
      const eventId = event.id;

      const channel = supabase
        .channel(`katilimlar-${eventId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'katilimlar',
            filter: `etkinlik_id=eq.${eventId}`,
          },
          () => {
            fetchEvent();
            getConfirmedParticipants(eventId, userId)
              .then(setParticipants)
              .catch(() => {
                // Sessizce yut: yukarıdaki participants effect'iyle aynı
                // gerekçe, avatar listesi ikincil bir gösterim.
              });
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
      // Kasıtlı olarak sadece event?.id (yukarıdaki not) - fetchEvent
      // route.params.eventId'ye bağlı ve o zaten sabit, ayrıca eklemeye gerek yok.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event?.id]),
  );

  // Gün 32: yorumlar tablosunda bu etkinliğe ait bir satır INSERT olunca
  // (kendi gönderdiğimiz dahil - Supabase Realtime kendi yazdığımızı da geri
  // yayınlıyor) listeyi tazeliyoruz. Yukarıdaki katilimlar aboneliğiyle aynı
  // desen: useFocusEffect + event?.id bağımlılığı + blur/unmount'ta
  // removeChannel, sadece '*' yerine 'INSERT' dinliyoruz çünkü yorumlar için
  // update/delete politikası zaten yok (bkz. schema.sql), o olaylar hiç
  // oluşmayacak. Yerel state'i elle güncellemiyoruz (yeni yorumu comments
  // dizisine push etmiyoruz) - fetchComments zaten engellenen kullanıcı
  // filtresini ve yazar profilini (profiles embed) tek sorguda doğru
  // getiriyor, burada tekrarlamak riskli olurdu.
  useFocusEffect(
    useCallback(() => {
      if (!event) return;
      const eventId = event.id;

      const channel = supabase
        .channel(`yorumlar-${eventId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'yorumlar',
            filter: `etkinlik_id=eq.${eventId}`,
          },
          () => {
            fetchComments();
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
      // Kasıtlı olarak sadece event?.id, yukarıdaki katilimlar aboneliğindeki
      // aynı gerekçe.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event?.id]),
  );

  // Kapasite doluysa 'beklemede', değilse 'onaylandi' olarak katılınıyor -
  // isFull hesaplaması aşağıda, sadece durum='onaylandi' katılımcıları
  // sayan participantCount üzerinden yapılıyor (bkz. services/events.ts >
  // eventsQuery). Sadece 'onaylandi' katılım participantCount'u ve dolayısıyla
  // isFull'u etkiliyor; bekleme listesine eklenen kişi sayıyı değiştirmiyor.
  const startJoin = async () => {
    if (!event) return;
    // Gün 38: Guest modu - buton artık gizlenmiyor (bkz. aşağıdaki footer
    // JSX'i, hâlâ userId'den bağımsız render ediliyor), dokununca Giriş
    // ekranına yönlendiriliyor.
    if (!userId) {
      requireLogin();
      return;
    }
    const durum: ParticipationStatus = resolveJoinStatus(event.participantCount, event.capacity);

    setJoining(true);
    try {
      await joinEvent(event.id, userId, durum);
      setParticipationStatus(durum);
      if (durum === 'onaylandi') {
        // Sunucuya tekrar sormadan (0/60 -> 1/60) anında güncelle - bir
        // sonraki focus'ta fetchEvent zaten gerçek sayıyla senkronlayacak.
        setEvent((prev) =>
          prev ? { ...prev, participantCount: prev.participantCount + 1 } : prev,
        );
      }

      // Gün 29: katılım (onaylı ya da bekleme listesi, ikisi de "katılım
      // başarılı" sayılıyor) başarılı olunca hatırlatma + değerlendirme daveti
      // bildirimleri planlanıyor - bkz. services/notifications.ts >
      // scheduleEventNotifications. Bu adım başarısız olsa bile (ör. izin
      // reddedildi, ağ hatası) katılımın kendisi zaten tamamlandı - bu yüzden
      // hata burada yutuluyor, kullanıcıya ayrıca bir Alert gösterilmiyor.
      scheduleEventNotifications(event).catch((err) => {
        console.warn('Etkinlik bildirimleri planlanamadı:', err);
      });
    } catch (err) {
      Alert.alert('Katılamadın', err instanceof Error ? err.message : String(err));
    } finally {
      setJoining(false);
    }
  };

  // "Katıldın ✓" / "Bekleme Listesindesin" butonuna tekrar dokununca ayrılma
  // onayı - yanlışlıkla tek dokunuşla ayrılmayı önlemek için Alert ile teyit
  // isteniyor, tıpkı deleteEvent'teki "Emin misin?" onayı gibi. Ayrılan kişi
  // onaylı bir katılımcıysa (durum='onaylandi') bir kontenjan açılmış olur -
  // bu durumda bekleme listesindeki sıradaki kişiye "yer açıldı" bildiriminin
  // taslağı tetikleniyor (bkz. services/notifications.ts). Bekleme
  // listesinden ayrılmak kontenjan açmadığı için bildirim tetiklenmiyor.
  const startLeave = () => {
    if (!event || !userId || !participationStatus) return;
    const eventId = event.id;
    const eventTitle = event.title;
    const wasConfirmed = participationStatus === 'onaylandi';

    Alert.alert(
      wasConfirmed
        ? 'Bu etkinlikten ayrılmak istiyor musun?'
        : 'Bekleme listesinden ayrılmak istiyor musun?',
      undefined,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Ayrıl',
          style: 'destructive',
          onPress: async () => {
            setJoining(true);
            try {
              await leaveEvent(eventId, userId);
              setParticipationStatus(null);

              // Gün 29: bu etkinlik için planlanmış (varsa) 3 bildirimi de
              // iptal et - scheduleEventNotifications'daki hem onaylı hem
              // bekleme listesi katılımında planlama yapıldığı için burada da
              // wasConfirmed ayrımı yapmadan her ayrılışta çağrılıyor.
              cancelEventNotifications(eventId).catch((err) => {
                console.warn('Etkinlik bildirimleri iptal edilemedi:', err);
              });

              if (wasConfirmed) {
                setEvent((prev) =>
                  prev
                    ? { ...prev, participantCount: Math.max(0, prev.participantCount - 1) }
                    : prev,
                );

                const nextUserId = await getNextWaitlistedUserId(eventId).catch(() => null);
                notifyNextWaitlistedParticipant(nextUserId, eventTitle);
              }
            } catch (err) {
              Alert.alert('Ayrılamadın', err instanceof Error ? err.message : String(err));
            } finally {
              setJoining(false);
            }
          },
        },
      ],
    );
  };

  // Gün 22: "neyapsak://etkinlik/:id" - App.tsx'teki NavigationContainer
  // linking config'i bu path'i DiscoverStack > EventDetail'e eşliyor.
  // Linking.createURL kullanılıyor çünkü ortama göre (Expo Go'da
  // "exp://<ip>/--/etkinlik/:id", development/production build'de
  // "neyapsak://etkinlik/:id") doğru şemayı kendisi üretiyor - RegisterScreen
  // ve LoginScreen'deki auth-callback linkleriyle aynı yaklaşım. Android'de
  // Share.share'in `url` alanı yok sayıldığı için link mesaj metnine de
  // ekleniyor, sadece iOS'a güvenilmiyor.
  const shareEvent = useCallback(async () => {
    if (!event) return;
    const shareUrl = Linking.createURL(`etkinlik/${event.id}`);
    try {
      await Share.share({
        title: event.title,
        message: `${event.title}\n${shareUrl}`,
        url: shareUrl,
      });
    } catch {
      // Kullanıcı paylaşım sayfasını iptal etmiş olabilir - sessizce yut.
    }
  }, [event]);

  // Gün 33: DiscoverScreen.tsx'teki toggleFavorite ile aynı desen (await
  // sonrası local state güncelleme, "iyimser" tanımı aynı yorumda) - tek fark
  // burada tek bir etkinlik söz konusu olduğu için Set yerine düz bir
  // boolean. togglingFavorite, üst üste hızlı dokunuşlarda aynı isteğin iki
  // kez atılmasını engelliyor (unique kısıt zaten insert'i reddederdi ama
  // ekstra bir hata Alert'i göstermek gereksiz).
  const toggleFavorite = useCallback(async () => {
    if (!event || togglingFavorite) return;
    // Gün 38: Guest modu - kalp ikonu artık userId varsa/yoksa fark etmeksizin
    // her zaman header'da (bkz. aşağıdaki headerRight), dokununca Giriş
    // ekranına yönlendiriliyor.
    if (!userId) {
      requireLogin();
      return;
    }
    const nextIsFavorite = !isFavorite;

    setTogglingFavorite(true);
    try {
      if (nextIsFavorite) {
        await addFavorite(userId, event.id);
      } else {
        await removeFavorite(userId, event.id);
      }
      setIsFavorite(nextIsFavorite);
    } catch (err) {
      Alert.alert('İşlem başarısız', err instanceof Error ? err.message : String(err));
    } finally {
      setTogglingFavorite(false);
    }
  }, [event, userId, isFavorite, togglingFavorite]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        event ? (
          <View style={styles.headerActions}>
            {/* Gün 38: eskiden {userId && (...)} ile guest'ten tamamen
                gizleniyordu - artık her zaman görünür, dokununca
                toggleFavorite içindeki requireLogin() devreye giriyor. */}
            <Pressable onPress={toggleFavorite} hitSlop={12} style={styles.shareButton}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={22}
                color={colors.white}
              />
            </Pressable>
            <Pressable onPress={shareEvent} hitSlop={12} style={styles.shareButton}>
              <Ionicons name="share-social-outline" size={22} color={colors.white} />
            </Pressable>
          </View>
        ) : null,
    });
  }, [navigation, event, shareEvent, toggleFavorite, isFavorite, userId, colors, styles]);

  if (status === 'loading') {
    return <LoadingState message="Etkinlik yükleniyor..." />;
  }

  if (status === 'error') {
    return <ErrorState onRetry={fetchEvent} />;
  }

  // status 'ready' ama event null: sorgu başarılı çalıştı, satır bulunamadı
  // (örn. silinmiş bir etkinliğin linkiyle gelinmesi) - bu ağ hatasından
  // (status 'error') ayrı bir durum, "Tekrar Dene" burada anlamsız olurdu.
  if (!event) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.notFoundText}>Etkinlik bulunamadı.</Text>
      </View>
    );
  }

  // Gün 22: event.participantCount değil participants.length kullanılıyor -
  // ilki startJoin/startLeave'de iyimser (optimistic) olarak anında
  // güncelleniyor, participants listesi ise ayrı bir ağ isteğiyle geliyor ve
  // kısa bir an geriden gelebilir (yukarıdaki participants effect'i bkz.).
  // "X/kapasite katılımcı" metni hâlâ event.participantCount kullanıyor,
  // sadece avatar sayısı/taşma rozeti burada gerçek listeye bağlanıyor.
  const visibleAvatarCount = Math.min(VISIBLE_AVATAR_COUNT, participants.length);
  const remainingParticipants = participants.length - visibleAvatarCount;
  const isOrganizer = session?.user.id === event.organizerId;
  const isPast = isEventPast(event.date, event.time);
  // Sadece istemci tarafında bir kontrol - DB'de kapasiteyi zorlayan bir kısıt
  // yok (bkz. services/participations.ts > joinEvent), bu yüzden son 1 yere
  // aynı anda iki kullanıcı basarsa ikisi de 'onaylandi' olarak katılabilir.
  // Bunu DB seviyesinde (örn. trigger ile) tam çözmek bu günün kapsamı dışı;
  // dolulukta yeni katılımlar startJoin'de 'beklemede' olarak işaretleniyor
  // (bkz. aşağıdaki "Bekleme Listesine Katıl" butonu).
  const isFull = event.participantCount >= event.capacity;

  // RLS zaten sadece organizatörün delete'ine izin veriyor (Gün 14); bu
  // kontrol sadece butonu gizlemek için - ikinci bir savunma katmanı değil,
  // asıl güvenlik sunucu tarafında. Kapak fotoğrafının storage'dan silinmesi
  // bilinçli olarak kapsam dışı - EventCreateScreen.tsx'teki "Kaldır"
  // yorumunda bahsedilen orphan-dosya temizliğiyle aynı kategori, ileride
  // (Gün 35 gibi) toplu bir işle ele alınabilir.
  const deleteEvent = () => {
    Alert.alert('Emin misin?', 'Bu etkinlik kalıcı olarak silinecek.', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            // Bildirilecek katılımcı listesi silmeden ÖNCE çekiliyor - bkz.
            // getEventParticipantIds yorumu (cascade delete).
            // Bu adım başarısız olsa bile (ağ hatası vb.) silme işlemi
            // engellenmemeli, bu yüzden boş listeyle devam ediliyor.
            const participantIds = await getEventParticipantIds(event.id).catch(() => []);

            const { error } = await supabase.from('etkinlikler').delete().eq('id', event.id);

            if (error) {
              Alert.alert('Silinemedi', error.message);
              return;
            }

            // Gün 19: bildirim tetikleme mantığının taslağı - bkz.
            // services/notifications.ts (gerçek push gönderimi kapsam dışı,
            // bkz. Gün 28 notu).
            notifyParticipantsOfCancellation(participantIds, event.title);

            // Gün 29: SADECE bu cihazdaki (silen kullanıcının kendi) planlanmış
            // bildirimleri iptal eder - yerel bildirimler cihaza özel olduğu
            // için diğer katılımcıların cihazlarındaki bildirimlere buradan
            // erişilemiyor (bkz. services/notifications.ts >
            // cancelEventNotifications yorumu), bu bilinçli bir sınırlama.
            cancelEventNotifications(event.id).catch((err) => {
              console.warn('Etkinlik bildirimleri iptal edilemedi:', err);
            });

            // Keşfet listesine dönüyoruz; DiscoverScreen.tsx zaten her focus'ta
            // ilk sayfayı sessizce yeniden çekiyor (Gün 17), bu yüzden silinen
            // etkinlik listeden kendiliğinden düşer.
            navigation.goBack();
          } catch (err) {
            // try/catch olmadan (örn. ağ hatasında) delete() reject olursa
            // setDeleting(false) hiç çalışmaz, buton sonsuza dek "yükleniyor"
            // görünür ve kullanıcı hiçbir hata görmeden ekranda kalırdı - bkz.
            // ProfileScreen.tsx'teki pickAvatar'da Gün 12'de düzeltilen aynı hata.
            Alert.alert('Bir hata oluştu', err instanceof Error ? err.message : String(err));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {event.coverPhotoUrl ? (
          <Image source={{ uri: event.coverPhotoUrl }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons name="image-outline" size={48} color={colors.textSecondary} />
          </View>
        )}

        <View style={styles.content}>
          <CategoryTag category={event.category} />
          <Text style={styles.title}>{event.title}</Text>

          <View style={styles.row}>
            <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.rowText}>{formatDateTime(event.date, event.time)}</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.rowText}>{event.location.address}</Text>
          </View>

          <Text style={styles.sectionTitle}>Açıklama</Text>
          <Text style={styles.description}>{event.description}</Text>

          <Text style={styles.sectionTitle}>Katılımcılar</Text>
          <View style={styles.avatarRow}>
            {participants.slice(0, visibleAvatarCount).map((participant, index) => (
              <View
                key={participant.id}
                style={[styles.avatar, { marginLeft: index === 0 ? 0 : -spacing.sm }]}
              >
                {participant.avatarUrl ? (
                  <Image source={{ uri: participant.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View
                    style={[
                      styles.avatarPlaceholder,
                      { backgroundColor: avatarColors[index % avatarColors.length] },
                    ]}
                  >
                    <Ionicons name="person" size={16} color={colors.white} />
                  </View>
                )}
              </View>
            ))}
            {remainingParticipants > 0 && (
              <View style={[styles.avatar, styles.avatarExtra, { marginLeft: -spacing.sm }]}>
                <Text style={styles.avatarExtraText}>+{remainingParticipants}</Text>
              </View>
            )}
          </View>
          <Text style={styles.participantCount}>
            {event.participantCount}/{event.capacity} katılımcı
          </Text>

          <Text style={styles.sectionTitle}>Yorumlar</Text>
          {commentsLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.commentsLoading} />
          ) : comments.length === 0 ? (
            <Text style={styles.emptyCommentsText}>Henüz yorum yok. İlk yorumu sen yaz!</Text>
          ) : (
            comments.map((comment) => (
              <View key={comment.id} style={styles.commentRow}>
                <View style={styles.commentAvatar}>
                  {comment.authorAvatarUrl ? (
                    <Image
                      source={{ uri: comment.authorAvatarUrl }}
                      style={styles.commentAvatarImage}
                    />
                  ) : (
                    <Ionicons name="person" size={16} color={colors.white} />
                  )}
                </View>
                <View style={styles.commentContent}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>
                      {comment.authorFirstName} {comment.authorLastName}
                    </Text>
                    <Text style={styles.commentDate}>{formatCommentDate(comment.createdAt)}</Text>
                  </View>
                  <Text style={styles.commentText}>{comment.content}</Text>
                </View>
                {userId && comment.userId !== userId && (
                  <Pressable
                    onPress={() => openCommentMenu(comment)}
                    // Gün 35: eskiden hitSlop 8 - ikon (18) + commentMenuButton'ın
                    // dar padding'iyle dokunma alanı ~36x42 kalıyordu, 44x44
                    // hedefinin altında.
                    hitSlop={13}
                    style={styles.commentMenuButton}
                    accessibilityRole="button"
                    accessibilityLabel="Yorum seçenekleri"
                  >
                    <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
                  </Pressable>
                )}
              </View>
            ))
          )}

          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Bir yorum yaz..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />
            <Pressable
              style={[
                styles.commentSendButton,
                (!commentText.trim() || sendingComment) && styles.commentSendButtonDisabled,
              ]}
              onPress={submitComment}
              disabled={!commentText.trim() || sendingComment}
            >
              {sendingComment ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Ionicons name="send" size={18} color={colors.white} />
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        {isPast ? (
          <>
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>Bu etkinlik sona erdi</Text>
            </View>
            {/* Gün 29: normalde değerlendirme daveti bildirime dokununca
                açılır (bkz. App.tsx > handleNotificationResponse); bu buton
                bildirimi kaçıran/silen kullanıcı için aynı ekrana manuel bir
                giriş yolu. */}
            {participationStatus === 'onaylandi' && (
              <Pressable
                style={styles.rateButton}
                onPress={() => navigation.navigate('Rating', { eventId: event.id })}
              >
                <Text style={styles.rateButtonText}>Etkinliği Değerlendir</Text>
              </Pressable>
            )}
          </>
        ) : participationStatus === 'onaylandi' ? (
          <Pressable
            style={[
              styles.joinButton,
              styles.joinButtonActive,
              joining && styles.joinButtonDisabled,
            ]}
            onPress={startLeave}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[styles.joinButtonText, styles.joinButtonTextActive]}>Katıldın ✓</Text>
            )}
          </Pressable>
        ) : participationStatus === 'beklemede' ? (
          <Pressable
            style={[
              styles.joinButton,
              styles.joinButtonWaitlisted,
              joining && styles.joinButtonDisabled,
            ]}
            onPress={startLeave}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.joinButtonText}>Bekleme Listesindesin</Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            style={[styles.joinButton, joining && styles.joinButtonDisabled]}
            onPress={startJoin}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.joinButtonText}>
                {isFull ? 'Bekleme Listesine Katıl' : 'Katıl'}
              </Text>
            )}
          </Pressable>
        )}
        {isOrganizer && (
          <Pressable
            style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
            onPress={deleteEvent}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <Text style={styles.deleteButtonText}>Etkinliği Sil</Text>
            )}
          </Pressable>
        )}
      </View>

      {/* Gün 32: "Şikayet Et" için opsiyonel sebep alanı - Alert.prompt sadece
          iOS'ta çalıştığından (Android'de no-op), RN'in kendi Modal'ıyla
          cross-platform bir alternatif. */}
      <Modal
        visible={reportTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeReportModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Yorumu şikayet et</Text>
            <Text style={styles.modalSubtitle}>
              Sebep belirtmek istersen yazabilirsin, bu adım opsiyonel.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={reportReason}
              onChangeText={setReportReason}
              placeholder="Sebep (opsiyonel)"
              placeholderTextColor={colors.textSecondary}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={closeReportModal}
                disabled={sendingReport}
              >
                <Text style={styles.modalButtonSecondaryText}>Vazgeç</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={submitReport}
                disabled={sendingReport}
              >
                {sendingReport ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Gönder</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    shareButton: {
      paddingHorizontal: spacing.xs,
    },
    scrollContent: {
      paddingBottom: spacing.xl,
    },
    cover: {
      width: '100%',
      height: 220,
    },
    coverPlaceholder: {
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      padding: spacing.md,
    },
    title: {
      fontSize: typography.fontSize.xxl,
      fontWeight: typography.fontWeight.bold,
      color: colors.text,
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    rowText: {
      fontSize: typography.fontSize.md,
      color: colors.textSecondary,
    },
    sectionTitle: {
      fontSize: typography.fontSize.md,
      fontWeight: typography.fontWeight.bold,
      color: colors.text,
      marginTop: spacing.lg,
      marginBottom: spacing.xs,
    },
    description: {
      fontSize: typography.fontSize.md,
      lineHeight: typography.lineHeight.md,
      color: colors.text,
    },
    avatarRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      // Gün 35: eskiden colors.white - bu kenarlık üst üste binen avatarları
      // birbirinden ayıran bir "kesik" efekti yaratıyor, arkasındaki gerçek
      // renk ekran arkaplanı (bu satır düz content alanında, bir kartın
      // üzerinde değil) - bu yüzden colors.surface değil colors.background
      // (bkz. Gün 35 karar notu, EventCard.tsx > card notundan farklı olarak
      // burada bir kart yok).
      borderColor: colors.background,
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarPlaceholder: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarExtra: {
      backgroundColor: colors.surface,
    },
    avatarExtraText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.bold,
      color: colors.textSecondary,
    },
    participantCount: {
      marginTop: spacing.sm,
      fontSize: typography.fontSize.sm,
      color: colors.textSecondary,
    },
    commentsLoading: {
      marginTop: spacing.sm,
      alignSelf: 'flex-start',
    },
    emptyCommentsText: {
      fontSize: typography.fontSize.sm,
      color: colors.textSecondary,
    },
    commentRow: {
      flexDirection: 'row',
      marginTop: spacing.md,
    },
    commentAvatar: {
      width: 32,
      height: 32,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    commentAvatarImage: {
      width: '100%',
      height: '100%',
    },
    commentContent: {
      flex: 1,
      marginLeft: spacing.sm,
    },
    commentMenuButton: {
      paddingHorizontal: spacing.xs,
      paddingTop: 2,
    },
    commentHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    commentAuthor: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.bold,
      color: colors.text,
    },
    commentDate: {
      fontSize: typography.fontSize.xs,
      color: colors.textSecondary,
    },
    commentText: {
      marginTop: 2,
      fontSize: typography.fontSize.sm,
      color: colors.text,
    },
    commentInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    commentInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.fontSize.sm,
      color: colors.text,
      // Gün 35: eskiden colors.white - yüzey arkaplanı, temayla koyulaşmalı
      // (bkz. EventForm.tsx > input notu, aynı gerekçe).
      backgroundColor: colors.surface,
      maxHeight: 100,
    },
    commentSendButton: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentSendButtonDisabled: {
      opacity: 0.6,
    },
    footer: {
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    joinButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    joinButtonActive: {
      backgroundColor: colors.success,
    },
    joinButtonWaitlisted: {
      backgroundColor: colors.warning,
    },
    joinButtonText: {
      color: colors.white,
      fontWeight: typography.fontWeight.bold,
      fontSize: typography.fontSize.md,
    },
    joinButtonTextActive: {
      color: colors.white,
    },
    joinButtonDisabled: {
      opacity: 0.6,
    },
    inactiveBadge: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    inactiveBadgeText: {
      color: colors.textSecondary,
      fontWeight: typography.fontWeight.medium,
      fontSize: typography.fontSize.md,
    },
    rateButton: {
      marginTop: spacing.sm,
      backgroundColor: colors.primary,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    rateButtonText: {
      color: colors.white,
      fontWeight: typography.fontWeight.bold,
      fontSize: typography.fontSize.md,
    },
    deleteButton: {
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    deleteButtonDisabled: {
      opacity: 0.6,
    },
    deleteButtonText: {
      color: colors.error,
      fontWeight: typography.fontWeight.bold,
      fontSize: typography.fontSize.md,
    },
    notFound: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    notFoundText: {
      marginTop: spacing.md,
      fontSize: typography.fontSize.md,
      color: colors.textSecondary,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    modalCard: {
      width: '100%',
      backgroundColor: colors.background,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    modalTitle: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold,
      color: colors.text,
    },
    modalSubtitle: {
      marginTop: spacing.xs,
      fontSize: typography.fontSize.sm,
      color: colors.textSecondary,
    },
    modalInput: {
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.fontSize.sm,
      color: colors.text,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    modalButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 80,
    },
    modalButtonSecondary: {
      backgroundColor: colors.surface,
    },
    modalButtonSecondaryText: {
      color: colors.text,
      fontWeight: typography.fontWeight.medium,
      fontSize: typography.fontSize.sm,
    },
    modalButtonPrimary: {
      backgroundColor: colors.primary,
    },
    modalButtonPrimaryText: {
      color: colors.white,
      fontWeight: typography.fontWeight.bold,
      fontSize: typography.fontSize.sm,
    },
  });
}

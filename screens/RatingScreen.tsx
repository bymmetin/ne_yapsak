// Gün 29: Değerlendirme daveti bildirimine dokununca ya da EventDetail'daki
// "Etkinliği Değerlendir" butonundan gelinen ekran. 1-5 yıldız + opsiyonel
// yorum, puanlamalar tablosuna insert edilir (bkz. services/ratings.ts).

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { radius, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
import { getEvent } from '../services/events';
import { ALREADY_RATED_ERROR_CODE, getMyRating, submitRating } from '../services/ratings';
import { Event, Rating } from '../types';
import type { DiscoverStackParamList } from '../types/navigation';

type Status = 'loading' | 'error' | 'ready';

type Props = NativeStackScreenProps<DiscoverStackParamList, 'Rating'>;

export default function RatingScreen({ route, navigation }: Props) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const eventId = route.params.eventId;

  const [status, setStatus] = useState<Status>('loading');
  const [event, setEvent] = useState<Event | null>(null);
  const [existingRating, setExistingRating] = useState<Rating | null>(null);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // EventDetailScreen.tsx > fetchEvent ile aynı desen (Promise.all'a gerek
  // yok, iki bağımsız çağrı - biri başlık göstermek için, diğeri "zaten
  // değerlendirmiş mi" kontrolü için).
  const load = useCallback(async () => {
    if (!userId) return;
    setStatus('loading');
    try {
      const [eventResult, ratingResult] = await Promise.all([
        getEvent(eventId),
        getMyRating(eventId, userId),
      ]);
      setEvent(eventResult);
      setExistingRating(ratingResult);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [eventId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  // unique(etkinlik_id, kullanici_id) kısıtı ihlali (kullanıcı iki sekmeden
  // aynı anda gönderirse ya da yukarıdaki load'daki kontrolü es geçen bir
  // yarış durumu) bir hata Alert'i DEĞİL, "zaten değerlendirdin" durumuna
  // geçiş olarak ele alınıyor - services/ratings.ts > ALREADY_RATED_ERROR_CODE.
  const submit = async () => {
    if (!userId || score === 0) return;

    setSubmitting(true);
    try {
      await submitRating(eventId, userId, score, comment.trim() || null);
      setExistingRating({
        id: '',
        eventId,
        userId,
        score,
        comment: comment.trim() || null,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === ALREADY_RATED_ERROR_CODE) {
        load();
      } else {
        setStatus('error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return <LoadingState message="Yükleniyor..." />;
  }

  if (status === 'error') {
    return <ErrorState onRetry={load} />;
  }

  if (!event) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.notFoundText}>Etkinlik bulunamadı.</Text>
      </View>
    );
  }

  if (existingRating) {
    return (
      <View style={styles.container}>
        <Ionicons name="checkmark-circle" size={48} color={colors.success} />
        <Text style={styles.title}>Zaten değerlendirdin</Text>
        <Text style={styles.message}>
          &quot;{event.title}&quot; etkinliğine {existingRating.score} yıldız verdin. Teşekkürler!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.message}>Bu etkinliği nasıl değerlendirirsin?</Text>

      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable
            key={value}
            onPress={() => setScore(value)}
            hitSlop={8}
            style={styles.starButton}
            accessibilityRole="button"
            accessibilityLabel={`${value} yıldız`}
          >
            <Ionicons
              name={value <= score ? 'star' : 'star-outline'}
              size={36}
              color={colors.warning}
            />
          </Pressable>
        ))}
      </View>

      <TextInput
        style={styles.input}
        value={comment}
        onChangeText={setComment}
        placeholder="Yorumun (opsiyonel)"
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={4}
      />

      <Pressable
        style={[styles.submitButton, (score === 0 || submitting) && styles.submitButtonDisabled]}
        onPress={submit}
        disabled={score === 0 || submitting}
      >
        <Text style={styles.submitButtonText}>{submitting ? 'Gönderiliyor...' : 'Gönder'}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: spacing.lg,
      paddingTop: spacing.xl,
    },
    title: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    message: {
      marginTop: spacing.sm,
      fontSize: typography.fontSize.sm,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    starRow: {
      flexDirection: 'row',
      marginTop: spacing.lg,
    },
    starButton: {
      paddingHorizontal: spacing.xs,
    },
    input: {
      width: '100%',
      marginTop: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.fontSize.md,
      color: colors.text,
      // Gün 35: eskiden colors.white - yüzey arkaplanı, temayla koyulaşmalı
      // (bkz. EventForm.tsx > input notu, aynı gerekçe).
      backgroundColor: colors.surface,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    submitButton: {
      marginTop: spacing.lg,
      width: '100%',
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: colors.white,
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
  });
}

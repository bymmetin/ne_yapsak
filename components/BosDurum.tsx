import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../constants/theme';

type Props = {
  baslik?: string;
  mesaj?: string;
};

export default function BosDurum({
  baslik = 'Henüz etkinlik yok',
  mesaj = 'Yeni bir etkinlik oluşturarak ilk sen başlat.',
}: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="calendar-outline" size={48} color={colors.textSecondary} />
      <Text style={styles.baslik}>{baslik}</Text>
      <Text style={styles.mesaj}>{mesaj}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  baslik: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  mesaj: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

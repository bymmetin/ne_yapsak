import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../constants/theme';

export default function BildirimlerScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bildirimler</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
});

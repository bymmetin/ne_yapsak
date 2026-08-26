import { StyleSheet, View } from 'react-native';

import EventCardSkeleton from './EventCardSkeleton';
import { spacing } from '../constants/theme';

type Props = {
  count?: number;
};

// DiscoverScreen ve FavoritesScreen'in listContent padding'iyle aynı - yüklenme
// bitince FlatList'in yerine geçtiğinde aynı hizada görünsün diye.
export default function EventListSkeleton({ count = 4 }: Props) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <EventCardSkeleton key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
});

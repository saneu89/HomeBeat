import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, sizes, spacing } from '@/theme/theme';

export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.titleRow}>
        <View style={styles.bar} />
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bar: { ...sizes.sectionBar, backgroundColor: colors.accent, borderRadius: radius.pill },
  title: { color: colors.text, fontSize: fonts.size.lg, fontWeight: fonts.weight.bold },
});

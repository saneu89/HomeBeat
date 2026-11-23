import { StyleSheet, Text } from 'react-native';

import { colors, fonts, radius, spacing } from '@/theme/theme';

/** Kleines Quellen-Kürzel (YT, SC, JAM, ARC, OFFLINE …) – nur zur Information. */
export function SourceBadge({ label }: { label: string }) {
  return <Text style={styles.badge}>{label}</Text>;
}

const styles = StyleSheet.create({
  badge: {
    fontSize: fonts.size.badge,
    fontWeight: fonts.weight.bold,
    letterSpacing: 0.4,
    color: colors.textMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    marginRight: spacing.xs,
    overflow: 'hidden',
  },
});

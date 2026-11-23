import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius, sizes, spacing } from '@/theme/theme';
import { SOURCE_NAMES } from '@/types/UnifiedItem';

/**
 * Einstellungen (Zahnrad oben rechts). Phase 1: nur das Gerüst und die reine Anzeige
 * „Über HomeBeat“. Alle Optionen aus Abschnitt 6 folgen in Phase 6 – mit echter Wirkung.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '–';

  return (
    <View style={styles.container}>
      <View style={[styles.head, { paddingTop: insets.top + spacing.lg }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
          <Ionicons name="chevron-back" size={sizes.icon} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.headTitle} accessibilityRole="header">
          Einstellungen
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxxl }]}>
        <View>
          <Text style={styles.groupTitle}>Über HomeBeat</Text>
          <View style={styles.group}>
            <View style={styles.row}>
              <View style={styles.rowLine}>
                <Text style={styles.rowLabel}>Musikquellen</Text>
                <Text style={styles.rowValue}>alle aktiv</Text>
              </View>
              <Text style={styles.rowDesc}>Werden bei jeder Suche automatisch gemeinsam durchsucht.</Text>
              <View style={styles.sourceList}>
                {SOURCE_NAMES.map((s) => (
                  <Text key={s.id} style={styles.sourceChip}>
                    {s.name}
                  </Text>
                ))}
              </View>
            </View>
            <View style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowLine}>
                <Text style={styles.rowLabel}>Version</Text>
                <Text style={styles.rowValue}>{version}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.screen,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headTitle: { color: colors.text, fontSize: fonts.size.xl, fontWeight: fonts.weight.heavy },
  iconButton: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  body: { paddingHorizontal: spacing.screen, paddingTop: 14, gap: spacing.xxl },
  groupTitle: {
    fontSize: fonts.size.sm,
    fontWeight: fonts.weight.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.accentTextSoft,
    marginBottom: spacing.sm + 2,
  },
  group: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg + 1, overflow: 'hidden' },
  row: { paddingVertical: spacing.lg, paddingHorizontal: 14, gap: spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
  rowLabel: { color: colors.text, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold },
  rowValue: { color: colors.accentTextSoft, fontSize: fonts.size.caption, fontWeight: fonts.weight.bold },
  rowDesc: { color: colors.textMuted, fontSize: 11.5, lineHeight: 16 },
  sourceList: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  sourceChip: {
    fontSize: fonts.size.sm,
    color: colors.text,
    backgroundColor: colors.field,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
});

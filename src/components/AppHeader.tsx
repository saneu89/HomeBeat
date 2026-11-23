import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius, shadows, sizes, spacing } from '@/theme/theme';

/** Kopfzeile: Logo + „HomeBeat“ links, Zahnrad (Einstellungen) rechts. */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.brand}>
        <View style={styles.logoTile} accessibilityLabel="HomeBeat Logo">
          <Image source={require('@/assets/images/logo-header.png')} style={styles.logo} contentFit="contain" />
        </View>
        <Text style={styles.title}>
          Home<Text style={styles.titleAccent}>Beat</Text>
        </Text>
      </View>
      <Pressable
        onPress={() => router.push('/settings')}
        accessibilityRole="button"
        accessibilityLabel="Einstellungen öffnen"
        hitSlop={8}
        style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
        {({ pressed }) => (
          <Ionicons name="settings-outline" size={sizes.icon} color={pressed ? colors.accentTextSoft : colors.textMuted} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  logoTile: {
    width: sizes.logo,
    height: sizes.logo,
    borderRadius: radius.tile,
    backgroundColor: colors.logoTile,
    borderWidth: 1.5,
    borderColor: colors.accentBorder,
    padding: 3,
    ...shadows.logo,
  },
  logo: { width: '100%', height: '100%' },
  title: { color: colors.text, fontSize: fonts.size.xxl, fontWeight: fonts.weight.heavy, letterSpacing: -0.3 },
  titleAccent: { color: colors.accent },
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
});

import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, sizes, spacing } from '@/theme/theme';

import { MiniPlayer } from './player/MiniPlayer';

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: 'home', inactive: 'home-outline' },
  search: { active: 'search', inactive: 'search-outline' },
  radio: { active: 'radio', inactive: 'radio-outline' },
  library: { active: 'library', inactive: 'library-outline' },
};

/** Mini-Player und darunter die Navigation mit 4 Tabs (wie Vorschau v8). */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View style={styles.container}>
      <MiniPlayer />
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const focused = index === state.index;
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;
          const icons = ICONS[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };

          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={styles.item}>
              <Ionicons
                name={focused ? icons.active : icons.inactive}
                size={sizes.tabIcon}
                color={focused ? colors.accentText : colors.textMuted}
              />
              <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
              <View style={[styles.indicator, focused && styles.indicatorActive]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background },
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.navBar,
    paddingTop: spacing.md,
  },
  item: { flex: 1, alignItems: 'center', gap: spacing.xxs },
  label: { fontSize: fonts.size.sm, color: colors.textMuted },
  labelActive: { color: colors.accentText, fontWeight: fonts.weight.bold },
  indicator: { ...sizes.tabIndicator, borderRadius: radius.pill, marginTop: spacing.xxs, backgroundColor: colors.transparent },
  indicatorActive: { backgroundColor: colors.accent },
});

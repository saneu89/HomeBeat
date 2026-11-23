import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToastMessage } from '@/services/toastStore';
import { colors, fonts, radius, shadows, spacing } from '@/theme/theme';

/** Kurzer Hinweis oben auf dem Bildschirm (wie in Vorschau v8). */
export function Toast() {
  const message = useToastMessage();
  const insets = useSafeAreaInsets();
  if (!message) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 56 }]} accessibilityLiveRegion="polite">
      <Text key={message.id} style={styles.toast} numberOfLines={2}>
        {message.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.xl, right: spacing.xl, alignItems: 'center', zIndex: 100 },
  toast: {
    backgroundColor: colors.toast,
    borderWidth: 1,
    borderColor: colors.accent,
    color: colors.toastText,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    fontSize: fonts.size.caption,
    fontWeight: fonts.weight.semibold,
    overflow: 'hidden',
    textAlign: 'center',
    ...shadows.card,
  },
});

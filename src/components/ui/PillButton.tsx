import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius, shadows } from '@/theme/theme';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PillButton({ label, onPress, variant = 'default', disabled, style }: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.base,
        primary && styles.primary,
        pressed && (primary ? styles.primaryPressed : styles.pressed),
        disabled && styles.disabled,
        style,
      ]}>
      <Text style={[styles.label, primary && styles.labelPrimary, variant === 'danger' && styles.labelDanger]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  pressed: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent, ...shadows.accentGlow },
  primaryPressed: { backgroundColor: colors.accentPressed },
  disabled: { opacity: 0.45 },
  label: { color: colors.text, fontSize: fonts.size.caption, fontWeight: fonts.weight.semibold },
  labelPrimary: { color: colors.onAccent },
  labelDanger: { color: colors.danger },
});

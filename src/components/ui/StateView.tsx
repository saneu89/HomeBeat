import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/theme/theme';

import { PillButton } from './PillButton';

type Props =
  | { kind: 'loading'; message?: string }
  | { kind: 'empty'; icon?: string; title: string; message?: string }
  | { kind: 'error'; title?: string; message: string; onRetry?: () => void };

/** Einheitlicher Lade-, Leer- und Fehlerzustand für Listen. */
export function StateView(props: Props) {
  if (props.kind === 'loading') {
    return (
      <View style={styles.box} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.message}>{props.message ?? 'Wird geladen …'}</Text>
      </View>
    );
  }
  if (props.kind === 'empty') {
    return (
      <View style={styles.box}>
        {props.icon ? <Text style={styles.icon}>{props.icon}</Text> : null}
        <Text style={styles.title}>{props.title}</Text>
        {props.message ? <Text style={styles.message}>{props.message}</Text> : null}
      </View>
    );
  }
  return (
    <View style={[styles.box, styles.errorBox]} accessibilityLiveRegion="polite">
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>{props.title ?? 'Das hat nicht geklappt'}</Text>
      <Text style={styles.message}>{props.message}</Text>
      {props.onRetry ? <PillButton label="Erneut versuchen" onPress={props.onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  errorBox: { borderColor: colors.accentBorder },
  icon: { fontSize: 26 },
  title: { color: colors.text, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold, textAlign: 'center' },
  message: { color: colors.textMuted, fontSize: fonts.size.caption, textAlign: 'center', lineHeight: 17 },
});

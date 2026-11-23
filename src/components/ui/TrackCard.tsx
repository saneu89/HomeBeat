import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, sizes } from '@/theme/theme';

import { SourceBadge } from './SourceBadge';

interface Props {
  title: string;
  subtitle?: string;
  badge?: string;
  artworkUrl?: string;
  /** Emoji als Symbol, wenn kein Cover vorhanden ist. */
  fallbackIcon?: string;
  meta?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
}

export function TrackCard({
  title,
  subtitle,
  badge,
  artworkUrl,
  fallbackIcon = '🎵',
  meta,
  onPress,
  onLongPress,
  accessibilityLabel,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.info}>
        <View style={styles.icon}>
          {artworkUrl ? (
            <Image source={{ uri: artworkUrl }} style={styles.artwork} contentFit="cover" recyclingKey={artworkUrl} />
          ) : (
            <Text style={styles.emoji}>{fallbackIcon}</Text>
          )}
        </View>
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {badge || subtitle ? (
            <View style={styles.subRow}>
              {badge ? <SourceBadge label={badge} /> : null}
              <Text style={styles.sub} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {typeof meta === 'string' ? <Text style={styles.meta}>{meta}</Text> : meta}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 11,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardPressed: { backgroundColor: colors.cardPressed, borderColor: colors.accentBorder },
  info: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 },
  icon: {
    width: sizes.trackIcon,
    height: sizes.trackIcon,
    borderRadius: radius.md,
    backgroundColor: colors.iconTile,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  artwork: { width: '100%', height: '100%' },
  emoji: { fontSize: 17 },
  texts: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold },
  subRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  sub: { color: colors.textMuted, fontSize: fonts.size.caption, flexShrink: 1 },
  meta: { color: colors.textMuted, fontSize: fonts.size.caption },
});

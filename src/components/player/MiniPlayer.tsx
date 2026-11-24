import { useProgress } from '@rntp/player';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { SourceBadge } from '@/components/ui/SourceBadge';
import { currentEntry, usePlayerState } from '@/services/playerStore';
import { colors, fonts, radius, shadows, sizes, spacing } from '@/theme/theme';
import { SOURCE_BADGE } from '@/types/UnifiedItem';

import { HeartButton, PlayPauseButton } from './PlayerButtons';

const openPlayer = () => router.push('/player');

/** Mini-Player über der Tab-Leiste: Cover, Titel, Herz, Play/Pause, Fortschrittslinie. Antippen oder nach oben ziehen öffnet den Vollbild-Player. */
export function MiniPlayer() {
  const entry = usePlayerState((s) => currentEntry(s));
  const nowPlaying = usePlayerState((s) => s.nowPlaying);
  const error = usePlayerState((s) => s.error);
  const { position, duration } = useProgress(1);

  const swipeUp = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy < -12 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_, g) => {
          if (g.dy < -30) openPlayer();
        },
      }),
    [],
  );

  if (!entry) return null;
  const { item } = entry;
  const total = duration > 0 ? duration : (item.durationSec ?? 0);
  const ratio = item.isLive ? 1 : total > 0 ? Math.min(1, position / total) : 0;
  const badge = nowPlaying?.uid === entry.uid ? SOURCE_BADGE[nowPlaying.playedSource] : undefined;

  return (
    <View style={styles.wrap} {...swipeUp.panHandlers}>
      <Pressable
        onPress={openPlayer}
        accessibilityRole="button"
        accessibilityLabel={`Läuft: ${item.title} von ${item.artist}. Vollbild-Player öffnen`}
        style={styles.info}>
        <View style={styles.cover}>
          {item.artworkUrl ? (
            <Image source={{ uri: item.artworkUrl }} style={styles.coverImg} contentFit="cover" />
          ) : (
            <Text style={styles.emoji}>🎵</Text>
          )}
        </View>
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.subRow}>
            {badge ? <SourceBadge label={badge} /> : null}
            <Text style={[styles.sub, error && styles.subError]} numberOfLines={1}>
              {error ? 'Nicht abspielbar – antippen für Details' : item.artist}
            </Text>
          </View>
        </View>
      </Pressable>
      <View style={styles.controls}>
        <HeartButton item={item} size={19} />
        <PlayPauseButton size={sizes.playButton} />
      </View>
      <View style={styles.progressTrack} pointerEvents="none">
        <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 14,
    marginBottom: 10,
    backgroundColor: colors.miniPlayer,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.xl,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    overflow: 'hidden',
    ...shadows.card,
  },
  info: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 },
  cover: {
    width: sizes.trackIcon,
    height: sizes.trackIcon,
    borderRadius: radius.md,
    backgroundColor: colors.iconTile,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverImg: { width: '100%', height: '100%' },
  emoji: { fontSize: 17 },
  texts: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold },
  subRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  sub: { color: colors.textMuted, fontSize: fonts.size.caption, flexShrink: 1 },
  subError: { color: colors.danger },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: colors.transparent },
  progressFill: { height: 2, backgroundColor: colors.accent },
});

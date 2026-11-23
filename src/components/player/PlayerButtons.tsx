import Ionicons from '@expo/vector-icons/Ionicons';
import { useIsPlaying, usePlaybackState, PlaybackState } from '@rntp/player';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { AudioPlayerService } from '@/services/AudioPlayerService';
import { toggleFavoriteItem, useIsFavorite } from '@/services/favoritesStore';
import { usePlayerState } from '@/services/playerStore';
import { colors, radius, shadows } from '@/theme/theme';
import type { UnifiedItem } from '@/types/UnifiedItem';

/** Play/Pause mit leichtem haptischem Feedback; zeigt beim Laden/Puffern einen Kreisel. */
export function PlayPauseButton({ size = 34 }: { size?: number }) {
  const playing = useIsPlaying();
  const state = usePlaybackState();
  const loading = usePlayerState((s) => s.loading);
  const busy = loading || (state === PlaybackState.Buffering && !playing);

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        AudioPlayerService.togglePlayPause();
      }}
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pause' : 'Abspielen'}
      hitSlop={6}
      style={({ pressed }) => [
        styles.play,
        { width: size, height: size },
        pressed && styles.playPressed,
      ]}>
      {busy ? (
        <ActivityIndicator color={colors.onAccent} size="small" />
      ) : (
        <Ionicons
          name={playing ? 'pause' : 'play'}
          size={Math.round(size * 0.45)}
          color={colors.onAccent}
          style={playing ? undefined : { marginLeft: Math.round(size * 0.06) }}
        />
      )}
    </Pressable>
  );
}

export function HeartButton({ item, size = 20 }: { item: UnifiedItem; size?: number }) {
  const fav = useIsFavorite(item.id);
  return (
    <Pressable
      onPress={() => toggleFavoriteItem(item)}
      accessibilityRole="button"
      accessibilityLabel={fav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
      accessibilityState={{ selected: !!fav }}
      hitSlop={8}
      style={styles.heart}>
      <Ionicons name={fav ? 'heart' : 'heart-outline'} size={size} color={colors.accentText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  play: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.accentGlow,
  },
  playPressed: { backgroundColor: colors.accentPressed },
  heart: { padding: 4 },
});

import { useProgress } from '@rntp/player';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

import { AudioPlayerService } from '@/services/AudioPlayerService';
import { colors, fonts, radius, spacing } from '@/theme/theme';
import { formatDuration } from '@/utils/format';

/** Fortschrittsleiste mit Ziehen/Tippen zum Springen. */
export function SeekBar({ fallbackDuration, isLive }: { fallbackDuration?: number; isLive?: boolean }) {
  const { position, duration: nativeDuration, buffered } = useProgress(0.5);
  const duration = nativeDuration > 0 ? nativeDuration : (fallbackDuration ?? 0);
  const [width, setWidth] = useState(0);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const widthRef = useRef(0);
  const durationRef = useRef(0);
  widthRef.current = width;
  durationRef.current = duration;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isLive && durationRef.current > 0,
        onMoveShouldSetPanResponder: () => !isLive && durationRef.current > 0,
        onPanResponderGrant: (e) => setDragRatio(clamp(e.nativeEvent.locationX / widthRef.current)),
        onPanResponderMove: (e) => setDragRatio(clamp(e.nativeEvent.locationX / widthRef.current)),
        onPanResponderRelease: (e) => {
          const ratio = clamp(e.nativeEvent.locationX / widthRef.current);
          AudioPlayerService.seekTo(ratio * durationRef.current);
          setDragRatio(null);
        },
        onPanResponderTerminate: () => setDragRatio(null),
      }),
    [isLive],
  );

  const ratio = dragRatio ?? (duration > 0 ? Math.min(1, position / duration) : 0);
  const bufferedRatio = duration > 0 ? Math.min(1, buffered / duration) : 0;

  return (
    <View>
      <View
        style={styles.touch}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        {...responder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="Wiedergabeposition"
        accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(position) }}>
        <View style={styles.track} pointerEvents="none">
          <View style={[styles.buffered, { width: `${bufferedRatio * 100}%` }]} />
          <View style={[styles.fill, { width: `${(isLive ? 1 : ratio) * 100}%` }]} />
        </View>
        {!isLive && <View pointerEvents="none" style={[styles.thumb, { left: Math.max(0, ratio * width - 7) }]} />}
      </View>
      <View style={styles.times}>
        <Text style={styles.time}>{isLive ? 'LIVE' : formatDuration(dragRatio !== null ? dragRatio * duration : position) || '0:00'}</Text>
        <Text style={styles.time}>{isLive ? '' : formatDuration(duration)}</Text>
      </View>
    </View>
  );
}

function clamp(v: number) {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

const styles = StyleSheet.create({
  touch: { height: 24, justifyContent: 'center' },
  track: { height: 4, borderRadius: radius.pill, backgroundColor: colors.track, overflow: 'hidden' },
  buffered: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.border },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.accent },
  thumb: { position: 'absolute', width: 14, height: 14, borderRadius: radius.pill, backgroundColor: colors.text, top: 5 },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xxs },
  time: { color: colors.textMuted, fontSize: fonts.size.sm, fontVariant: ['tabular-nums'] },
});

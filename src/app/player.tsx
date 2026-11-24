import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeartButton, PlayPauseButton } from '@/components/player/PlayerButtons';
import { SeekBar } from '@/components/player/SeekBar';
import { Chip } from '@/components/ui/Chip';
import { PillButton } from '@/components/ui/PillButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SourceBadge } from '@/components/ui/SourceBadge';
import { StateView } from '@/components/ui/StateView';
import { AudioPlayerService } from '@/services/AudioPlayerService';
import { currentEntry, usePlayerState, type QueueEntry, type SleepTimerChoice } from '@/services/playerStore';
import { colors, fonts, radius, sizes, spacing } from '@/theme/theme';
import { SOURCE_BADGE } from '@/types/UnifiedItem';
import { formatDuration } from '@/utils/format';

const SLEEP_OPTIONS: { value: SleepTimerChoice; label: string }[] = [
  { value: 'off', label: 'Aus' },
  { value: 15, label: '15 Min' },
  { value: 30, label: '30 Min' },
  { value: 60, label: '60 Min' },
  { value: 'endOfTrack', label: 'Titelende' },
];

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const entry = usePlayerState((s) => currentEntry(s));
  const queue = usePlayerState((s) => s.queue);
  const index = usePlayerState((s) => s.index);
  const nowPlaying = usePlayerState((s) => s.nowPlaying);
  const error = usePlayerState((s) => s.error);
  const errorDetails = usePlayerState((s) => s.errorDetails);
  const sleepTimer = usePlayerState((s) => s.sleepTimer);
  const speed = usePlayerState((s) => s.playbackSpeed);

  const swipeDown = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 14 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
        onPanResponderRelease: (_, g) => {
          if (g.dy > 80) router.back();
        },
      }),
    [],
  );

  if (!entry) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <StateView kind="empty" icon="🎧" title="Gerade läuft nichts" message="Such nach einem Song und tippe ihn an." />
      </View>
    );
  }

  const { item } = entry;
  const info = nowPlaying?.uid === entry.uid ? nowPlaying : null;
  const qualityText = info
    ? [info.via === 'Datei' ? 'Offline' : info.via, info.bitrateKbps ? `${info.bitrateKbps} kbps` : null, info.codec?.toUpperCase()]
        .filter(Boolean)
        .join(' · ')
    : 'Stream wird gesucht …';
  const upcoming = queue.slice(index + 1);

  const header = (
    <View>
      <View {...swipeDown.panHandlers}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Player schließen"
            hitSlop={8}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
            <Ionicons name="chevron-down" size={sizes.icon} color={colors.textMuted} />
          </Pressable>
          <Text style={styles.topTitle}>Läuft gerade</Text>
          <View style={styles.iconButtonSpacer} />
        </View>

        <View style={styles.coverWrap}>
          {item.artworkUrl ? (
            <Image source={{ uri: item.artworkUrl }} style={styles.cover} contentFit="cover" transition={150} />
          ) : (
            <View style={[styles.cover, styles.coverFallback]}>
              <Text style={styles.coverEmoji}>🎵</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.titleRow}>
        <View style={styles.titleTexts}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {[item.artist, item.album].filter(Boolean).join(' • ')}
          </Text>
        </View>
        <HeartButton item={item} size={26} />
      </View>

      <View style={styles.sourceRow}>
        {info ? <SourceBadge label={SOURCE_BADGE[info.playedSource]} /> : null}
        <Text style={styles.sourceText} numberOfLines={1}>
          {qualityText}
        </Text>
      </View>
      {info?.matched ? (
        <Text style={styles.sourceText} numberOfLines={2}>
          Gefunden: „{info.matched.title}“ – {info.matched.artist}
        </Text>
      ) : null}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          {errorDetails.length > 0 ? (
            <Text style={styles.errorDetails} selectable>
              {errorDetails.join('\n')}
            </Text>
          ) : null}
          <View style={styles.errorButtons}>
            <PillButton label="Erneut versuchen" variant="primary" onPress={() => void AudioPlayerService.retry()} />
            <PillButton
              label="Nächster Song"
              disabled={upcoming.length === 0}
              onPress={() => void AudioPlayerService.next()}
            />
          </View>
        </View>
      ) : null}

      <SeekBar fallbackDuration={item.durationSec} isLive={item.isLive} />

      <View style={styles.controls}>
        <Pressable
          onPress={() => AudioPlayerService.previous()}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          hitSlop={10}
          style={styles.skip}>
          <Ionicons name="play-skip-back" size={30} color={colors.text} />
        </Pressable>
        <PlayPauseButton size={68} />
        <Pressable
          onPress={() => AudioPlayerService.next()}
          accessibilityRole="button"
          accessibilityLabel="Weiter"
          hitSlop={10}
          disabled={upcoming.length === 0}
          style={[styles.skip, upcoming.length === 0 && styles.disabled]}>
          <Ionicons name="play-skip-forward" size={30} color={colors.text} />
        </Pressable>
      </View>

      <Text style={styles.label}>Sleep-Timer</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {SLEEP_OPTIONS.map((o) => (
          <Chip key={String(o.value)} label={o.label} active={sleepTimer === o.value} onPress={() => AudioPlayerService.setSleepTimer(o.value)} />
        ))}
      </ScrollView>

      {AudioPlayerService.isSpeechContent(item) ? (
        <>
          <Text style={styles.label}>Abspielgeschwindigkeit</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {SPEEDS.map((s) => (
              <Chip
                key={s}
                label={`${s.toLocaleString('de-DE')}×`}
                active={speed === s}
                onPress={() => AudioPlayerService.setPlaybackSpeed(s)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      <View style={styles.queueHead}>
        <SectionHeader title="Warteschlange" right={<Text style={styles.muted}>{upcoming.length} als Nächstes</Text>} />
      </View>
      {upcoming.length === 0 ? <Text style={styles.muted}>Danach ist die Warteschlange leer.</Text> : null}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={upcoming}
        keyExtractor={(e) => e.uid}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: q, index: i }) => <QueueRow entry={q} queueIndex={index + 1 + i} />}
        initialNumToRender={10}
        windowSize={7}
      />
    </View>
  );
}

function QueueRow({ entry, queueIndex }: { entry: QueueEntry; queueIndex: number }) {
  const { item } = entry;
  return (
    <Pressable
      onPress={() => AudioPlayerService.skipTo(queueIndex)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title} von ${item.artist} abspielen`}
      style={({ pressed }) => [styles.queueRow, pressed && styles.queueRowPressed]}>
      <View style={styles.queueCover}>
        {item.artworkUrl ? <Image source={{ uri: item.artworkUrl }} style={styles.queueCoverImg} contentFit="cover" /> : null}
      </View>
      <View style={styles.queueTexts}>
        <Text style={styles.queueTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {item.artist}
        </Text>
      </View>
      <Text style={styles.muted}>{formatDuration(item.durationSec)}</Text>
      <Pressable
        onPress={() => AudioPlayerService.removeFromQueue(queueIndex)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title} aus der Warteschlange entfernen`}
        hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', padding: spacing.screen },
  content: { paddingHorizontal: spacing.screen },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.lg },
  topTitle: { color: colors.textMuted, fontSize: fonts.size.body, fontWeight: fonts.weight.semibold },
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
  iconButtonSpacer: { width: sizes.iconButton },
  coverWrap: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
    shadowColor: colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  cover: { width: '100%', aspectRatio: 1, borderRadius: radius.xl + 5, backgroundColor: colors.iconTile },
  coverFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  coverEmoji: { fontSize: 72 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  titleTexts: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: fonts.size.xxl + 2, fontWeight: fonts.weight.heavy, letterSpacing: -0.3 },
  artist: { color: colors.textMuted, fontSize: fonts.size.md, marginTop: 3 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.sm },
  sourceText: { color: colors.textMuted, fontSize: fonts.size.sm, flexShrink: 1 },
  errorBox: { marginBottom: spacing.md, gap: spacing.sm },
  error: { color: colors.danger, fontSize: fonts.size.caption },
  errorDetails: { color: colors.textMuted, fontSize: fonts.size.caption },
  errorButtons: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40, marginVertical: spacing.xl },
  skip: { padding: spacing.sm },
  disabled: { opacity: 0.35 },
  label: {
    fontSize: fonts.size.sm,
    fontWeight: fonts.weight.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.accentTextSoft,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  chipRow: { gap: spacing.sm },
  queueHead: { marginTop: spacing.xxl },
  muted: { color: colors.textMuted, fontSize: fonts.size.caption },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
  },
  queueRowPressed: { backgroundColor: colors.cardPressed },
  queueCover: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.iconTile, overflow: 'hidden' },
  queueCoverImg: { width: '100%', height: '100%' },
  queueTexts: { flex: 1, minWidth: 0 },
  queueTitle: { color: colors.text, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold },
});

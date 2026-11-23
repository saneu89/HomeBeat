import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { StateView } from '@/components/ui/StateView';
import { TrackCard } from '@/components/ui/TrackCard';
import { youtubeMusicProvider } from '@/providers/youtubeMusic';
import { checkYouTubeStream } from '@/services/youtube/streamCheck';
import { colors, fonts, radius, spacing } from '@/theme/theme';
import { parseItemId, SOURCE_BADGE, type UnifiedItem } from '@/types/UnifiedItem';
import { formatDuration } from '@/utils/format';

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; items: UnifiedItem[] }
  | { kind: 'error'; message: string };

const TYPE_LABEL: Record<UnifiedItem['type'], string> = {
  track: 'Song',
  album: 'Album',
  artist: 'Künstler',
  playlist: 'Playlist',
  station: 'Sender',
  audiobook: 'Hörbuch',
  podcast_episode: 'Podcast',
  mix: 'DJ-Set',
};

const TYPE_ICON: Record<UnifiedItem['type'], string> = {
  track: '🎵',
  album: '💿',
  artist: '🎤',
  playlist: '🎶',
  station: '📻',
  audiobook: '📖',
  podcast_episode: '🎙',
  mix: '🎧',
};

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>({ kind: 'idle' });
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: 'loading' });
    try {
      const items = await youtubeMusicProvider.search(trimmed, { signal: controller.signal });
      if (!controller.signal.aborted) setState({ kind: 'ready', items });
    } catch (e) {
      if (controller.signal.aborted) return;
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  // Phase 1: Antippen eines Songs prüft, ob sich der Stream auf diesem Gerät ermitteln lässt.
  const testStream = useCallback(async (item: UnifiedItem) => {
    if (item.type !== 'track') return;
    setCheckingId(item.id);
    const result = await checkYouTubeStream(parseItemId(item.id).nativeId);
    setCheckingId(null);
    Alert.alert(result.ok ? 'Stream-Test erfolgreich' : 'Stream-Test fehlgeschlagen', `${item.title}\n\n${result.message}`);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => runSearch(query)}
          placeholder="Songs, Künstler, Alben, Hörbücher …"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Suche"
          selectionColor={colors.accent}
        />
        <Text style={styles.hint}>
          Testversion: Die Suche läuft vorerst nur über YouTube Music. Tippe auf einen Song, um zu prüfen, ob der
          Stream auf diesem Handy abrufbar ist.
        </Text>
      </View>

      {state.kind === 'idle' ? (
        <View style={styles.pad}>
          <StateView kind="empty" icon="🔍" title="Wonach suchst du?" message="Gib einen Song, Künstler oder ein Album ein." />
        </View>
      ) : state.kind === 'loading' ? (
        <View style={styles.pad}>
          <StateView kind="loading" message="Suche läuft …" />
        </View>
      ) : state.kind === 'error' ? (
        <View style={styles.pad}>
          <StateView
            kind="error"
            title="Suche fehlgeschlagen"
            message={`Keine Verbindung zu YouTube Music.\n${state.message}`}
            onRetry={() => runSearch(query)}
          />
        </View>
      ) : state.items.length === 0 ? (
        <View style={styles.pad}>
          <StateView kind="empty" icon="🤷" title="Keine Treffer" message="Versuch es mit einem anderen Suchbegriff." />
        </View>
      ) : (
        <FlatList
          data={state.items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={7}
          renderItem={({ item }) => (
            <TrackCard
              title={item.title}
              subtitle={[TYPE_LABEL[item.type], item.artist, item.album].filter(Boolean).join(' • ')}
              badge={SOURCE_BADGE[item.source]}
              artworkUrl={item.artworkUrl}
              fallbackIcon={TYPE_ICON[item.type]}
              onPress={item.type === 'track' ? () => testStream(item) : undefined}
              meta={
                checkingId === item.id ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  [item.isExplicit ? 'E' : '', formatDuration(item.durationSec)].filter(Boolean).join(' · ')
                )
              }
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: spacing.screen, paddingTop: spacing.xl, gap: spacing.md },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg - 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: fonts.size.md,
  },
  hint: { color: colors.textMuted, fontSize: fonts.size.sm, lineHeight: 16 },
  pad: { paddingHorizontal: spacing.screen, paddingTop: spacing.xl },
  list: { paddingHorizontal: spacing.screen, paddingTop: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
});

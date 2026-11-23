import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StateView } from '@/components/ui/StateView';
import { TrackCard } from '@/components/ui/TrackCard';
import { getLibraryCounts, type LibraryCounts } from '@/database/libraryRepo';
import { colors, fonts, spacing } from '@/theme/theme';
import { formatBytes, pluralize } from '@/utils/format';

type LoadState = { kind: 'loading' } | { kind: 'ready'; counts: LibraryCounts } | { kind: 'error'; message: string };

export default function LibraryScreen() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(() => {
    getLibraryCounts()
      .then((counts) => setState({ kind: 'ready', counts }))
      .catch((e: unknown) => setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) }));
  }, []);

  useFocusEffect(load);

  if (state.kind === 'loading') {
    return (
      <Screen>
        <StateView kind="loading" />
      </Screen>
    );
  }
  if (state.kind === 'error') {
    return (
      <Screen>
        <StateView kind="error" message={state.message} onRetry={load} />
      </Screen>
    );
  }

  const { counts } = state;
  return (
    <Screen>
      <View>
        <SectionHeader title="Bibliothek" />
        <View style={styles.list}>
          <TrackCard
            fallbackIcon="❤"
            title={`Favoriten (${counts.favorites})`}
            subtitle="Deine gemerkten Songs"
          />
          <TrackCard
            fallbackIcon="✈"
            title={`Offline-Downloads (${counts.downloads})`}
            subtitle={
              counts.downloads > 0
                ? `${formatBytes(counts.downloadBytes)} auf diesem Gerät • ohne Internet hörbar`
                : 'Noch nichts heruntergeladen'
            }
          />
        </View>
      </View>
      <View>
        <SectionHeader
          title="Eigene Playlists"
          right={<Text style={styles.sub}>{pluralize(counts.playlists, 'Playlist', 'Playlists')}</Text>}
        />
        <StateView
          kind="empty"
          icon="🎶"
          title="Noch keine Playlists"
          message="Playlists anlegen und aus Spotify oder CSV importieren folgt im nächsten Ausbauschritt."
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  sub: { color: colors.textMuted, fontSize: fonts.size.caption },
});

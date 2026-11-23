import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { PillButton } from '@/components/ui/PillButton';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StateView } from '@/components/ui/StateView';
import { TrackCard } from '@/components/ui/TrackCard';
import { getRecentlyPlayed } from '@/database/libraryRepo';
import { AudioPlayerService } from '@/services/AudioPlayerService';
import { spacing } from '@/theme/theme';
import { SOURCE_BADGE, type UnifiedItem } from '@/types/UnifiedItem';
import { formatDuration } from '@/utils/format';

type LoadState = { kind: 'loading' } | { kind: 'ready'; items: UnifiedItem[] } | { kind: 'error'; message: string };

export default function StartScreen() {
  const [recent, setRecent] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(() => {
    getRecentlyPlayed(10)
      .then((items) => setRecent({ kind: 'ready', items }))
      .catch((e: unknown) => setRecent({ kind: 'error', message: e instanceof Error ? e.message : String(e) }));
  }, []);

  useFocusEffect(load);

  return (
    <Screen>
      <View>
        <SectionHeader title="Zuletzt gehört" />
        {recent.kind === 'loading' ? (
          <StateView kind="loading" />
        ) : recent.kind === 'error' ? (
          <StateView kind="error" message={recent.message} onRetry={load} />
        ) : recent.items.length === 0 ? (
          <View style={{ gap: spacing.md }}>
            <StateView
              kind="empty"
              icon="🎧"
              title="Noch nichts gehört"
              message="Such nach einem Song, Künstler oder Album – hier erscheint dann, was du zuletzt gehört hast."
            />
            <PillButton label="Zur Suche" variant="primary" onPress={() => router.navigate('/search')} />
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {recent.items.map((item, i, all) => (
              <TrackCard
                key={item.id}
                title={item.title}
                subtitle={item.artist}
                badge={SOURCE_BADGE[item.source]}
                artworkUrl={item.artworkUrl}
                meta={formatDuration(item.durationSec)}
                onPress={() => AudioPlayerService.playItems(all, i)}
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

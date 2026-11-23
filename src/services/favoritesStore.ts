import * as Haptics from 'expo-haptics';
import { useEffect, useSyncExternalStore } from 'react';

import { isFavorite, toggleFavorite } from '@/database/trackRepo';
import type { UnifiedItem } from '@/types/UnifiedItem';

/** Favoriten-Status mit Zwischenspeicher, damit alle Herz-Symbole synchron bleiben. */
const known = new Map<string, boolean>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

async function load(id: string) {
  if (known.has(id)) return;
  const fav = await isFavorite(id);
  known.set(id, fav);
  emit();
}

export async function toggleFavoriteItem(item: UnifiedItem): Promise<boolean> {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  const now = await toggleFavorite(item);
  known.set(item.id, now);
  emit();
  return now;
}

/** Liefert, ob der Eintrag ein Favorit ist (undefined = wird noch geladen). */
export function useIsFavorite(itemId: string | undefined): boolean | undefined {
  useEffect(() => {
    if (itemId) load(itemId).catch(() => undefined);
  }, [itemId]);
  return useSyncExternalStore(subscribe, () => (itemId ? known.get(itemId) : undefined));
}

/** Nach Massenänderungen (z. B. Import) den Zwischenspeicher verwerfen. */
export function resetFavoritesCache() {
  known.clear();
  emit();
}

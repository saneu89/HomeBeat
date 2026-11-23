import type { StreamAttempt, StreamQuality } from '@/services/streams/types';
import type { ItemType, SourceId, UnifiedItem } from '@/types/UnifiedItem';

export interface SearchOptions {
  /** Abbruch, z. B. wenn der Nutzer weitertippt oder das Zeitlimit der Quelle erreicht ist. */
  signal?: AbortSignal;
  /** Gewünschte Inhaltsarten; leer/undefiniert = alle, die die Quelle liefern kann. */
  types?: ItemType[];
  limit?: number;
}

/** Gemeinsames Interface aller Musikquellen unter src/providers/. */
export interface MusicProvider {
  readonly id: SourceId;
  readonly name: string;
  /** Inhaltsarten, die diese Quelle liefern kann (für die Such-Filter nach Inhaltsart). */
  readonly supportedTypes: readonly ItemType[];
  /** false, wenn z. B. ein benötigter Schlüssel fehlt → Quelle wird still übersprungen. */
  isAvailable(): boolean;
  search(query: string, options?: SearchOptions): Promise<UnifiedItem[]>;
  /**
   * Wege, den Stream eines eigenen Eintrags (gleiche Quelle) zu holen – in Reihenfolge.
   * Fehlt die Methode, liefert die Quelle nur Metadaten (z. B. Deezer).
   */
  streamAttempts?(item: UnifiedItem, quality: Exclude<StreamQuality, 'auto'>): StreamAttempt[];
  /** true = Quelle eignet sich, um Songs ohne eigenen Stream per „Künstler – Titel“ aufzulösen. */
  readonly canResolveMatches?: boolean;
}

import type { SourceId } from '@/types/UnifiedItem';

/** Eingestellte Streaming-Qualität (Abschnitt 6). */
export type StreamQuality = 'auto' | 'low' | 'normal' | 'high' | 'best';

/** Ergebnis der Stream-Auflösung – nur kurz gültig. */
export interface ResolvedStream {
  url: string;
  headers?: Record<string, string>;
  mimeType?: string;
  codec?: string;
  bitrateKbps?: number;
  /** Quelle des Inhalts (für das Kürzel). */
  source: SourceId;
  /** Technischer Weg, z. B. "YouTube (YTMUSIC)", "Invidious", "Piped", "Datei". */
  via: string;
  /** Lautheit laut Quelle in dB (YouTube liefert das), für „Lautstärke angleichen“. */
  loudnessDb?: number;
  isLocal: boolean;
  /** Zeitpunkt (ms), ab dem die URL nicht mehr verwendet werden soll. */
  expiresAt: number;
}

/** Ein einzelner Weg, einen Stream zu holen (z. B. YouTube direkt, Invidious, Piped). */
export interface StreamAttempt {
  /** Eindeutiger Schlüssel, damit fehlgeschlagene Wege übersprungen werden können. */
  key: string;
  resolve: (signal?: AbortSignal) => Promise<ResolvedStream>;
}

/** Eine mögliche Audio-Variante einer Quelle. */
export interface FormatCandidate {
  bitrateKbps: number;
  mimeType: string;
  codec?: string;
}

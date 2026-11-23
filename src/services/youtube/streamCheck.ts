import { getInnertube } from './innertube';

export interface StreamCheckResult {
  ok: boolean;
  httpStatus?: number;
  mimeType?: string;
  bitrateKbps?: number;
  message: string;
}

/**
 * Prüft für eine YouTube-Video-ID, ob sich eine Audio-Stream-URL ermitteln, entschlüsseln
 * und tatsächlich abrufen lässt (Range-Anfrage auf die ersten 64 KB).
 * Dient in Phase 1 als Gerätetest für youtubei.js (Player-Skript + Hermes-Auswerter).
 */
export async function checkYouTubeStream(videoId: string): Promise<StreamCheckResult> {
  try {
    const yt = await getInnertube();
    const info = await yt.music.getInfo(videoId);
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });
    const url = await format.decipher(yt.session.player);
    if (!url) {
      return { ok: false, message: 'Keine Stream-URL erhalten.' };
    }
    const res = await fetch(url, { headers: { Range: 'bytes=0-65535' } });
    const bitrateKbps = Math.round((format.average_bitrate ?? format.bitrate) / 1000);
    const ok = res.status === 200 || res.status === 206;
    return {
      ok,
      httpStatus: res.status,
      mimeType: format.mime_type,
      bitrateKbps,
      message: ok
        ? `Stream erreichbar (HTTP ${res.status}, ${format.mime_type.split(';')[0]}, ${bitrateKbps} kbps)`
        : `Stream-Abruf fehlgeschlagen (HTTP ${res.status})`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

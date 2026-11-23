/** 245 → "4:05", 3725 → "1:02:05" */
export function formatDuration(totalSec?: number): string {
  if (totalSec === undefined || !Number.isFinite(totalSec) || totalSec <= 0) return '';
  const s = Math.round(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Bytes → "412 MB" / "1,2 GB" (deutsches Zahlenformat). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toLocaleString('de-DE', { maximumFractionDigits: 1 })} GB`;
}

export function pluralize(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

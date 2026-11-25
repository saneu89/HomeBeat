/** fetch mit Zeitlimit; ein äußeres AbortSignal bricht ebenfalls ab. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<Response> {
  const { timeoutMs = 8000, signal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit & { timeoutMs?: number; signal?: AbortSignal }): Promise<T> {
  const res = await fetchWithTimeout(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} bei ${new URL(url).host}`);
  return (await res.json()) as T;
}

/**
 * Prüft vor dem Abspielen, ob die Datei auch nach 2 MB noch geliefert wird.
 * Gesperrte YouTube-URLs liefern den Anfang (HTTP 206), ab etwa 1 MB (schwankt je Video) aber HTTP 403 –
 * ohne diese Prüfung bricht die Wiedergabe erst nach knapp einer Minute ab. Bei genau 1 MB kam teils noch 206.
 * 416 = Datei kürzer als 2 MB → in Ordnung.
 */
export async function assertStreamReadable(
  url: string,
  headers: Record<string, string> | undefined,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetchWithTimeout(url, { headers: { ...headers, Range: 'bytes=2097152-2097407' }, timeoutMs: 6000, signal });
  res.body?.cancel().catch(() => undefined);
  if (!res.ok && res.status !== 416) throw new Error(`Prüfabruf ab 2 MB: HTTP ${res.status}`);
}

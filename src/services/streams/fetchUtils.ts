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
 * Prüft vor dem Abspielen, ob die Datei auch nach ca. 1 MB noch geliefert wird.
 * YouTube-URLs ohne PO-Token liefern den Anfang (HTTP 206), ab ca. 1 MB aber HTTP 403 –
 * ohne diese Prüfung bricht die Wiedergabe erst nach knapp einer Minute ab.
 * 416 = Datei kürzer als 1 MB → in Ordnung.
 */
export async function assertStreamReadable(
  url: string,
  headers: Record<string, string> | undefined,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetchWithTimeout(url, { headers: { ...headers, Range: 'bytes=1048576-1048831' }, timeoutMs: 6000, signal });
  res.body?.cancel().catch(() => undefined);
  if (!res.ok && res.status !== 416) throw new Error(`Prüfabruf ab ~1 MB: HTTP ${res.status}`);
}

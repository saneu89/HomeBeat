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

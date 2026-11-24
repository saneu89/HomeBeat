import { getInnertube } from './innertube';

/**
 * PO-Token (Proof of Origin) für YouTube-Streams (GVS), erzeugt auf dem Gerät.
 *
 * BotGuard (Googles Prüf-VM) braucht eine echte Browser-Umgebung → unsichtbare WebView
 * (src/components/PoTokenWebView.tsx), Seite mit Ursprung https://www.youtube.com.
 * Ablauf wie in BgUtils v4 (github.com/LuanRT/BgUtils, core/BotGuardClient.js + WebPoMinter.js):
 *   1. Challenge per InnerTube `att/get` (youtubei.js getAttestationChallenge)
 *   2. WebView: Interpreter laden, `vm.a(program, …)`, Snapshot mit webPoSignalOutput
 *   3. WebView: Integritäts-Token per `api/jnn/v1/GenerateIT`
 *   4. WebView: Minter aus webPoSignalOutput[0] → Token je Video-ID (an die Video-ID gebunden)
 * Diese Datei ist UI-frei; die WebView meldet sich über registerPoTokenWebView an.
 */

/** Öffentliche Werte aus BgUtils (utils/constants.js, examples/index-innertube.ts). */
const GOOG_API_KEY = 'AIzaSyDyT5W0Jh49F30Pqqtyfdf7pDLFKLJoAnw';
const REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';

/** Läuft in der WebView (normales Browser-JS). Antworten per ReactNativeWebView.postMessage. */
export const PO_TOKEN_HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
(function () {
  var minter = null;
  function reply(id, ok, value) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, ok: ok, value: value }));
  }
  function fail(id, e) { reply(id, false, String((e && e.message) || e)); }
  function b64ToU8(b) {
    var s = atob(b.replace(/-/g, '+').replace(/_/g, '/'));
    var u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }
  function u8ToB64Url(u) {
    var s = '';
    for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s).replace(/\\+/g, '-').replace(/\\//g, '_');
  }
  function withTimeout(p, ms, what) {
    return Promise.race([p, new Promise(function (_, rej) {
      setTimeout(function () { rej(new Error(what + ': Zeitüberschreitung')); }, ms);
    })]);
  }
  function loadScript(url) {
    return new Promise(function (res, rej) {
      var el = document.createElement('script');
      el.src = url.indexOf('//') === 0 ? 'https:' + url : url;
      el.onload = res;
      el.onerror = function () { rej(new Error('BotGuard-Interpreter nicht ladbar')); };
      document.head.appendChild(el);
    });
  }
  window.hbInit = async function (id, c) {
    try {
      minter = null;
      if (c.script) new Function(c.script)(); else await loadScript(c.url);
      var vm = window[c.globalName];
      if (!vm || !vm.a) throw new Error('BotGuard nicht verfügbar');
      var noop = function () {};
      var vmFns = await withTimeout(new Promise(function (res) {
        vm.a(c.program, function (snap) { res({ snap: snap }); }, true, undefined, noop, [[], []], undefined, false, [noop, noop, noop, noop, noop]);
      }), 10000, 'BotGuard-Start');
      var signals = [];
      var bgResponse = await withTimeout(new Promise(function (res) {
        vmFns.snap(res, [undefined, undefined, signals, undefined]);
      }), 10000, 'BotGuard-Snapshot');
      var r = await fetch('https://www.youtube.com/api/jnn/v1/GenerateIT', {
        method: 'POST',
        headers: { 'content-type': 'application/json+protobuf', 'x-goog-api-key': '${GOOG_API_KEY}', 'x-user-agent': 'grpc-web-javascript/0.1' },
        body: JSON.stringify(['${REQUEST_KEY}', bgResponse])
      });
      if (!r.ok) throw new Error('GenerateIT: HTTP ' + r.status);
      var it = await r.json();
      if (typeof it[0] !== 'string') throw new Error('GenerateIT: kein Integritäts-Token');
      if (!signals[0]) throw new Error('BotGuard: kein Minter (PMD)');
      var m = await signals[0](b64ToU8(it[0]));
      if (typeof m !== 'function') throw new Error('BotGuard: Minter ungültig (APF)');
      minter = m;
      reply(id, true, { ttl: it[1] || 3600 });
    } catch (e) { fail(id, e); }
  };
  window.hbMint = async function (id, videoId) {
    try {
      if (!minter) throw new Error('Minter nicht bereit');
      var t = await minter(new TextEncoder().encode(videoId));
      if (!(t instanceof Uint8Array)) throw new Error('Token ungültig (ODM)');
      reply(id, true, u8ToB64Url(t));
    } catch (e) { fail(id, e); }
  };
})();
</script></body></html>`;

type Runner = (js: string) => void;

let runner: Runner | null = null;
let readyWaiters: (() => void)[] = [];
let nextId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let minterUntil = 0;
let initPromise: Promise<void> | null = null;

/** Von der WebView nach dem Laden aufgerufen; null beim Entfernen. */
export function registerPoTokenWebView(run: Runner | null): void {
  runner = run;
  minterUntil = 0; // neue Seite = neuer Minter nötig
  if (run) {
    readyWaiters.forEach((w) => w());
    readyWaiters = [];
  }
}

/** Antwort aus der WebView (onMessage). */
export function handlePoTokenMessage(data: string): void {
  let msg: { id?: number; ok?: boolean; value?: unknown };
  try {
    msg = JSON.parse(data);
  } catch {
    return;
  }
  const p = msg.id !== undefined ? pending.get(msg.id) : undefined;
  if (!p) return;
  pending.delete(msg.id!);
  clearTimeout(p.timer);
  if (msg.ok) p.resolve(msg.value);
  else p.reject(new Error(String(msg.value)));
}

function waitForWebView(timeoutMs: number): Promise<Runner> {
  if (runner) return Promise.resolve(runner);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('PO-Token: WebView nicht bereit (App im Hintergrund?)')), timeoutMs);
    readyWaiters.push(() => {
      clearTimeout(timer);
      resolve(runner!);
    });
  });
}

async function call<T>(fn: 'hbInit' | 'hbMint', arg: unknown, timeoutMs: number): Promise<T> {
  const run = await waitForWebView(5000);
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`PO-Token: ${fn} Zeitüberschreitung`));
    }, timeoutMs);
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
    run(`window.${fn}(${id}, ${JSON.stringify(arg)}); true;`);
  });
}

async function ensureMinter(): Promise<void> {
  if (Date.now() < minterUntil) return;
  initPromise ??= (async () => {
    const yt = await getInnertube();
    const { bg_challenge: bg } = await yt.getAttestationChallenge('ENGAGEMENT_TYPE_UNBOUND');
    if (!bg) throw new Error('PO-Token: keine BotGuard-Challenge von YouTube');
    const { ttl } = await call<{ ttl: number }>(
      'hbInit',
      {
        url: bg.interpreter_url.private_do_not_access_or_else_trusted_resource_url_wrapped_value,
        script: bg.interpreter_url.private_do_not_access_or_else_safe_script_wrapped_value,
        program: bg.program,
        globalName: bg.global_name,
      },
      30_000,
    );
    // Etwas vor Ablauf erneuern; mindestens 5 Minuten verwenden.
    minterUntil = Date.now() + Math.max(300, ttl - 300) * 1000;
  })().finally(() => {
    initPromise = null;
  });
  await initPromise;
}

/** PO-Token für ein Video (Content-Binding = Video-ID), z. B. für `&pot=` an der YTMUSIC-Stream-URL. */
export async function getPoToken(videoId: string): Promise<string> {
  await ensureMinter();
  try {
    return await call<string>('hbMint', videoId, 5000);
  } catch (e) {
    minterUntil = 0; // beim nächsten Mal neu initialisieren (z. B. WebView neu geladen)
    throw e;
  }
}

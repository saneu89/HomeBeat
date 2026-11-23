/**
 * Laufzeit-Ergänzungen für youtubei.js unter React Native.
 *
 * Grundlage (geprüft für youtubei.js 18.3 + Expo SDK 58):
 * - youtubei.js bringt einen eigenen React-Native-Einstieg mit
 *   (node_modules/youtubei.js/dist/src/platform/react-native.js). Er erwartet als Globals:
 *   fetch, Request, Response, Headers, FormData, File, ReadableStream, CustomEvent,
 *   crypto.randomUUID / crypto.getRandomValues, crypto.subtle.digest (nur für Cookie-Login),
 *   TextEncoder/TextDecoder.
 * - Expo SDK 58 installiert bereits selbst (expo/src/winter/runtime.native.ts):
 *   URL, URLSearchParams (spec-konform), TextDecoderStream, ReadableStream, structuredClone,
 *   DOMException und ein streaming-fähiges fetch (expo/fetch).
 *   → react-native-url-polyfill und web-streams-polyfill würden diese Versionen nur
 *     überschreiben und werden deshalb bewusst NICHT eingebunden.
 * - Hermes bringt TextEncoder/TextDecoder nativ mit.
 * - youtubei.js nutzt intern einen eigenen EventEmitter → das Paket "events" ist nicht nötig.
 * - Buffer wird von youtubei.js 18 nicht mehr verwendet → kein "buffer"-Polyfill.
 *
 * Was hier fehlt und ergänzt wird:
 * 1. crypto.getRandomValues / crypto.randomUUID (youtubei.js ruft `crypto?.randomUUID()` auf
 *    und stürzt ab, wenn `crypto` existiert, `randomUUID` aber nicht).
 * 2. crypto.subtle.digest (SHA-1/256/384/512) über expo-crypto.
 * 3. CustomEvent.
 *
 * Der Auswerter für die Stream-Entschlüsselung (Platform.shim.eval) wird in
 * src/services/youtube/innertube.ts gesetzt, nicht hier.
 */
import * as ExpoCrypto from 'expo-crypto';

type MutableCrypto = {
  getRandomValues?: (array: ArrayBufferView) => ArrayBufferView;
  randomUUID?: () => string;
  subtle?: { digest?: (algorithm: AlgorithmIdentifier, data: BufferSource) => Promise<ArrayBuffer> };
};

const g = globalThis as unknown as { crypto?: MutableCrypto; CustomEvent?: unknown };

if (!g.crypto) {
  g.crypto = {};
}
const c = g.crypto;

if (typeof c.getRandomValues !== 'function') {
  c.getRandomValues = (array: ArrayBufferView) =>
    ExpoCrypto.getRandomValues(array as Parameters<typeof ExpoCrypto.getRandomValues>[0]);
}

if (typeof c.randomUUID !== 'function') {
  c.randomUUID = () => ExpoCrypto.randomUUID();
}

const DIGESTS: Record<string, ExpoCrypto.CryptoDigestAlgorithm> = {
  'SHA-1': ExpoCrypto.CryptoDigestAlgorithm.SHA1,
  'SHA-256': ExpoCrypto.CryptoDigestAlgorithm.SHA256,
  'SHA-384': ExpoCrypto.CryptoDigestAlgorithm.SHA384,
  'SHA-512': ExpoCrypto.CryptoDigestAlgorithm.SHA512,
};

if (!c.subtle) {
  c.subtle = {};
}
if (typeof c.subtle.digest !== 'function') {
  c.subtle.digest = (algorithm: AlgorithmIdentifier, data: BufferSource) => {
    const name = (typeof algorithm === 'string' ? algorithm : algorithm.name).toUpperCase();
    const algo = DIGESTS[name];
    if (!algo) {
      return Promise.reject(new Error(`Nicht unterstützter Hash-Algorithmus: ${name}`));
    }
    return ExpoCrypto.digest(algo, data);
  };
}

if (typeof g.CustomEvent !== 'function') {
  class CustomEventPolyfill<T = unknown> {
    readonly type: string;
    readonly detail: T | null;
    readonly bubbles: boolean;
    readonly cancelable: boolean;
    readonly timeStamp = Date.now();
    defaultPrevented = false;

    constructor(type: string, init?: { detail?: T; bubbles?: boolean; cancelable?: boolean }) {
      this.type = type;
      this.detail = init?.detail ?? null;
      this.bubbles = init?.bubbles ?? false;
      this.cancelable = init?.cancelable ?? false;
    }

    preventDefault() {
      if (this.cancelable) this.defaultPrevented = true;
    }
  }
  g.CustomEvent = CustomEventPolyfill;
}

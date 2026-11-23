import { Innertube, Log, Platform, type Types } from 'youtubei.js';

/**
 * youtubei.js enthält keinen JS-Interpreter. Für die Entschlüsselung der Stream-URLs
 * (Signatur + n-Parameter) muss ein Auswerter gesetzt werden – siehe
 * https://ytjs.dev/guide/getting-started.html („Providing a custom JavaScript interpreter“).
 * Hermes (React Native) unterstützt `new Function(...)`. Die Umgebungswerte (`env`) sind von
 * youtubei.js bereits in `data.output` eingebettet.
 */
Platform.shim.eval = (data: Types.BuildScriptResult) => {
  // eslint-disable-next-line no-new-func
  return new Function(data.output)() as Types.EvalResult;
};

if (!__DEV__) {
  Log.setLevel(Log.Level.NONE);
}

let instance: Promise<Innertube> | null = null;

/** Gemeinsame, verzögert erzeugte Innertube-Sitzung. Bei Fehlschlag wird beim nächsten Aufruf neu versucht. */
export function getInnertube(): Promise<Innertube> {
  if (!instance) {
    instance = Innertube.create({
      lang: 'de',
      location: 'DE',
      retrieve_player: true,
      generate_session_locally: true,
    }).catch((err: unknown) => {
      instance = null;
      throw err;
    });
  }
  return instance;
}

/** Erzwingt eine neue Sitzung (z. B. nach abgelaufenem Player-Skript). */
export function resetInnertube(): void {
  instance = null;
}

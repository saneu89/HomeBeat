/**
 * Vorlage für src/config/secrets.ts
 *
 * secrets.ts wird bei `npm install` automatisch aus dieser Datei angelegt und ist in .gitignore.
 * Trage dort deine eigenen (kostenlosen) Schlüssel ein. Ein leerer Wert bedeutet:
 * Die betroffene Quelle wird still übersprungen – die App funktioniert trotzdem.
 */
export const SECRETS = {
  /** Podcast Index – kostenlos unter https://api.podcastindex.org/signup (Key + Secret per E-Mail). */
  PODCAST_INDEX_KEY: '',
  PODCAST_INDEX_SECRET: '',

  /** Jamendo – kostenlose Client-ID unter https://devportal.jamendo.com (App anlegen → „Client ID“). */
  JAMENDO_CLIENT_ID: '',

  /**
   * SoundCloud – offizielle API. App-Registrierung unter https://soundcloud.com/you/apps
   * (laut Doku nur mit „Artist Pro“-Abo). Ohne Werte wird SoundCloud still übersprungen.
   */
  SOUNDCLOUD_CLIENT_ID: '',
  SOUNDCLOUD_CLIENT_SECRET: '',

  /** Last.fm – kostenloser API-Key unter https://www.last.fm/api/account/create */
  LASTFM_API_KEY: '',
};

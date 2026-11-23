import TrackPlayer from '@rntp/player';

import { AudioPlayerService } from './AudioPlayerService';

/**
 * Wiedergabe-Sitzung von @rntp/player: läuft einmal beim Start, vor dem Router.
 * Listener, die hier registriert werden, überleben das Schließen der Oberfläche
 * (Musik läuft weiter, wenn die App aus den „Zuletzt verwendet“-Apps entfernt wird).
 * Wichtig: Diese Datei und alles, was sie importiert, darf keine UI-Komponenten laden.
 */
TrackPlayer.registerPlaybackSession(() => {
  AudioPlayerService.setup();
});

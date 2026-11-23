// Einstiegspunkt: Polyfills MÜSSEN vor allem anderen geladen werden (youtubei.js),
// danach die Wiedergabe-Sitzung (UI-frei) und zuletzt der Router mit der Oberfläche.
import './src/polyfills';
import './src/services/playbackSession';
import 'expo-router/entry';

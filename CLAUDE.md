# HomeBeat – Projektregeln

Private Musik-Streaming-App für Familie und Freunde. Wird **nicht veröffentlicht**, sondern als `.apk` direkt weitergegeben.
Kein eigener Server, keine Werbung, kein Login, keine Konten. Jedes Handy arbeitet für sich allein, alle Daten liegen lokal (SQLite).

## Arbeitsweise (strikt)

- Arbeit in Phasen (siehe unten). Am Ende jeder Phase: `npx tsc --noEmit` fehlerfrei, kurze Zusammenfassung (was fertig ist, wie testen), Git-Commit, dann **anhalten und auf „weiter“ warten**.
- Vor dem Einbau jeder Bibliothek die **aktuelle offizielle Doku** prüfen (Version, Import-Pfade, Expo-Kompatibilität). Code-Beispiele aus dem Auftrag nicht blind übernehmen. Expo-Pakete immer mit `npx expo install <paket>` installieren.
- Funktionen, die technisch nicht sauber gehen, **nicht vortäuschen**: melden, Alternative vorschlagen, Einstellung im Zweifel ausblenden.
- Kein Platzhalter-Code, keine stillen TODOs. Offene Punkte stehen unten in „Offene Punkte“.
- Alle Benutzertexte auf **Deutsch**. Immer „Favoriten“, nie „Lieblingssongs“.

## Technik

- Expo SDK 58 (React Native 0.88, React 19.3), TypeScript strict, Expo Router (Routen in `src/app/`).
- **Development Build** statt Expo Go (native Module: Track-Player, Android Auto, Cast).
- Ziel: Android. Code bleibt plattformneutral (iOS später möglich); CarPlay/iOS-Signierung entfallen vorerst.
- Package `app.homebeat.music`, Name „HomeBeat“, Slug `homebeat`.
- Icons/Splash werden mit `npm run icons` aus `assets/HomeBeat_icon.jpeg` erzeugt (weißen Rand wegschneiden, unverzerrt zentrieren, Adaptive Icon komplett im sicheren 66-%-Kreis).
- `android/` und `ios/` werden generiert (CNG) – nie von Hand ändern, nur über `app.json` und Config-Plugins.
- Einstiegsdatei `index.ts` lädt `src/polyfills.ts` **vor** `expo-router/entry`.
- Geheimnisse: `src/config/secrets.ts` (in `.gitignore`, wird bei `npm install` aus `secrets.example.ts` angelegt). Fehlt ein Schlüssel, wird die betroffene Quelle **still übersprungen** – die App muss ohne jeden einzelnen Schlüssel funktionieren.

## Architektur

- `src/theme/theme.ts`: **alle** Farben, Schriften, Abstände, Rundungen, Schatten. Nirgendwo sonst Farbwerte.
- `src/providers/`: ein `MusicProvider`-Interface, eine Datei pro Quelle. Alle Quellen sind immer aktiv – **keine** Einstellung zum Abschalten, **keine** Reihenfolge-Auswahl, kein Filter nach Quelle.
- `src/types/UnifiedItem.ts`: einheitliches Datenmodell; `id` immer mit Quellen-Präfix (z. B. `yt:…`).
- `src/services/`: AggregatorService, StreamResolver, AudioPlayerService, DownloadService, RecommendationService, AutoService.
- `src/database/`: expo-sqlite, Migrationen über `PRAGMA user_version` in `migrations.ts` (nur anhängen, nie bestehende Migrationen ändern).
- Stream-URLs erst beim Abspielen holen (laufen ab), nur kurz zwischenspeichern.
- Spotify Web API wird **nicht** verwendet; Spotify-Daten nur über den offiziellen Datenexport (ZIP/JSON).
- Kein Teilen von Playlists, keine Familien-Mitglieder, keine Einladungslinks.

## Oberfläche

- Vorbild: `homebeat-ui-v8.html` (Aufbau, Texte, Farben).
- 4 Tabs: Start, Suche, Radio, Bibliothek; darüber Mini-Player; Zahnrad oben rechts öffnet Einstellungen.
- Jede Liste hat Lade-, Leer- und Fehlerzustand.
- Leichtes Haptik-Feedback (expo-haptics) bei Play/Pause und Favorit.

## Befehle

```bash
npm install                  # legt auch src/config/secrets.ts an, falls fehlend
npm run icons                # Icons/Splash neu erzeugen
npx tsc --noEmit             # Typprüfung (Pflicht am Ende jeder Phase)
npx expo start --dev-client  # Dev-Server für den Development Build
npx expo run:android         # lokaler Build + Installation (Android SDK + JDK 17 nötig)
npx eas-cli@latest build -p android --profile preview          # .apk in der Expo-Cloud
npx eas-cli@latest build -p android --profile preview --local  # .apk lokal (Linux/macOS/WSL)
```

## Phasen

1. Grundgerüst: Projekt, Branding/Icon, Polyfills, Theme, Navigation (4 Tabs, leere Einstellungen), Datenbank mit Migrationen, Test-Suche über youtubei.js, erster .apk-Build. **← erledigt**
2. Abspielen: Player, StreamResolver, YouTube Music + Ausweichwege, Mini-/Vollbild-Player, Hintergrundwiedergabe.
3. Alle Quellen: übrige Provider, AggregatorService (Zusammenfassen, Rangfolge), Such-Filter nach Inhaltsart, Radio-Tab.
4. Bibliothek: Playlists, Favoriten, Import (Spotify-Export, CSV), Sichern/Wiederherstellen.
5. Offline: DownloadService (Warteschlange, Tempolimit, WLAN-Regel, Speicherverwaltung).
6. Einstellungen: alle Optionen mit echter Wirkung.
7. Empfehlungen & Liedtexte: RecommendationService, Start-Tab, Autoplay, LRCLIB.
8. Auto & Cast: Android Auto, Google Cast, Bluetooth-Fortsetzen.
9. Feinschliff & Übergabe: Fehlerzustände, lange Listen, ANLEITUNG.md.

## Offene Punkte

- youtubei.js auf echtem Gerät prüfen: Test-Suche und Stream-Test im Tab „Suche“ (Phase 1, braucht ersten Build).
- **YouTube-Streams (Risiko für Phase 2):** Test am 23.11.2026 vom Entwicklungsrechner (Node): Suche ok, aber
  `getInfo` liefert bei allen Clients (YTMUSIC, IOS, ANDROID_VR, TV, …) `LOGIN_REQUIRED` „Bitte melde dich an“
  (Bot-Schutz) → keine Stream-URLs. Ob das vom Handy (andere IP) auch passiert, zeigt der Stream-Test.
  Mögliche Wege für Phase 2: PO-Token (BotGuard) per unsichtbarer WebView erzeugen, Piped/Invidious-Ausweichweg,
  Song-Auflösung über JioSaavn/SoundCloud/Audius bevorzugen. Kein Login (Projektregel).
- Erster .apk-Build: Auf dem Entwicklungsrechner fehlen JDK und Android SDK; Cloud-Build braucht ein (kostenloses) Expo-Konto → muss der Nutzer einmal anstoßen (siehe Zusammenfassung Phase 1).

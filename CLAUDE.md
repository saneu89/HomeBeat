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
- Einstiegsdatei `index.ts` lädt `src/polyfills.ts`, dann `src/services/playbackSession.ts` (UI-frei!), dann `expo-router/entry`.
- Player: **@rntp/player** (= react-native-track-player v5). v4.1.2 baut unter RN 0.88/New Architecture nicht mehr (Kotlin-/Bridgeless-Fehler, Issues ohne Fix geschlossen). v5 ist frei für private, nicht-kommerzielle Nutzung (license.txt). Typen über `paths` in tsconfig auf `lib/typescript` gemappt (Deep-Import im TS-Quellcode).
- Warteschlange gehört der App (`playerStore`); der native Player bekommt nur aktuellen + nächsten Titel mit frisch aufgelöster URL.
- Geheimnisse: `src/config/secrets.ts` (in `.gitignore`, wird bei `npm install` aus `secrets.example.ts` angelegt). Fehlt ein Schlüssel, wird die betroffene Quelle **still übersprungen** – die App muss ohne jeden einzelnen Schlüssel funktionieren.

## Architektur

- `src/theme/theme.ts`: **alle** Farben, Schriften, Abstände, Rundungen, Schatten. Nirgendwo sonst Farbwerte.
- `src/providers/`: ein `MusicProvider`-Interface, eine Datei pro Quelle. Alle Quellen sind immer aktiv – **keine** Einstellung zum Abschalten, **keine** Reihenfolge-Auswahl, kein Filter nach Quelle.
- `src/types/UnifiedItem.ts`: einheitliches Datenmodell; `id` immer mit Quellen-Präfix (z. B. `yt:…`).
- `src/services/`: AggregatorService, StreamResolver, AudioPlayerService, DownloadService, RecommendationService, AutoService.
- `src/database/`: expo-sqlite, Migrationen über `PRAGMA user_version` in `migrations.ts` (nur anhängen, nie bestehende Migrationen ändern).
- Stream-URLs erst beim Abspielen holen (laufen ab), nur kurz zwischenspeichern.
- **Fehlerverhalten beim Abspielen:** Kann ein Song über keine Quelle geladen werden, stoppt die Wiedergabe bei diesem Song. Nie automatisch zum nächsten Song springen, die Warteschlange im Fehlerfall nicht durcharbeiten. Stattdessen Fehlermeldung mit Details (Quelle/Client, Fehler bzw. HTTP-Status, versuchte Ausweichquellen) und die Knöpfe „Erneut versuchen“ und „Nächster Song“. Gilt auch im Hintergrund/auf dem Sperrbildschirm: dort pausieren und den Fehler in der Benachrichtigung zeigen. Autoplay greift nur nach einem regulär zu Ende gespielten Song, nie nach einem Fehler.
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

1. Grundgerüst: Projekt, Branding/Icon, Polyfills, Theme, Navigation (4 Tabs, leere Einstellungen), Datenbank mit Migrationen, Test-Suche über youtubei.js, erster .apk-Build. **← erledigt (auf Handy getestet)**
2. Abspielen: Player, StreamResolver, YouTube Music + Ausweichwege, Mini-/Vollbild-Player, Hintergrundwiedergabe. **← erledigt**
3. Alle Quellen: übrige Provider, AggregatorService (Zusammenfassen, Rangfolge), Such-Filter nach Inhaltsart, Radio-Tab.
4. Bibliothek: Playlists, Favoriten, Import (Spotify-Export, CSV), Sichern/Wiederherstellen.
5. Offline: DownloadService (Warteschlange, Tempolimit, WLAN-Regel, Speicherverwaltung).
6. Einstellungen: alle Optionen mit echter Wirkung.
7. Empfehlungen & Liedtexte: RecommendationService, Start-Tab, Autoplay, LRCLIB.
8. Auto & Cast: Android Auto, Google Cast, Bluetooth-Fortsetzen.
9. Feinschliff & Übergabe: Fehlerzustände, lange Listen, ANLEITUNG.md.

## Offene Punkte

- Lizenz @rntp/player: frei nur für „Personal Use“ (private Person, nicht-kommerziell). HomeBeat (privat, kostenlos, Familie/Freunde) sollte darunter fallen – Entscheidung liegt beim Nutzer. Alternative wäre expo-audio (MIT, aber ohne Android Auto).
- YouTube-Direktabruf: Auf dem Handy funktioniert YTMUSIC (Test 23.11.2026). Vom Entwicklungsrechner liefert YouTube LOGIN_REQUIRED (Bot-Schutz, IP-abhängig). Ohne PO-Token kann YouTube Streams jederzeit sperren → Ausweichwege wichtig.
- Piped/Invidious (23.11.2026 geprüft): Die meisten Piped-Instanzen der offiziellen Liste sind offline oder selbst von YouTube gesperrt („LOGIN_REQUIRED“); api.invidious.io war vom Entwicklungsrechner nicht erreichbar. Der Ausweichweg ist eingebaut (dynamische Listen, kurze Zeitlimits), bringt derzeit aber wenig. Echte Ausweichquellen kommen in Phase 3 (JioSaavn, SoundCloud, Audius über Künstler-Titel-Abgleich).
- Phase-2-Handytest (24.11.2026): YTMUSIC liefert ohne PO-Token nur ~1 MB (danach HTTP 403), ANDROID_VR/TV: LOGIN_REQUIRED, Piped/Invidious offline/403. Deshalb vorgezogen aus Phase 3: JioSaavn, SoundCloud, Audius als Wiedergabe-/Ausweichquellen (noch nicht in der Suche – das bleibt Phase 3). Jede URL wird vor dem Abspielen ab 2 MB probegelesen; Invidious/Piped kommen erst nach den Ausweichquellen. Nächster Schritt: PO-Token auf dem Gerät (BgUtils/WebView).
- JioSaavn außerhalb Indiens: signierte URLs (web.saavncdn.com) → 403; der unsignierte Pfad auf aac.saavncdn.com geht (Stand 24.11.2026, kann jederzeit wegfallen). Katalog aus DE stark eingeschränkt: Lizenzsperre nach Land – selbst die Künstlerseite von Ed Sheeran liefert aus DE nur 3 Titel (Bollywood/Remixe). Hilft praktisch nur bei indischer Musik.
- PO-Token (eingebaut 24.11.2026): unsichtbare WebView `src/components/PoTokenWebView.tsx` (Ursprung youtube.com) + `src/services/youtube/poToken.ts` (BgUtils-v4-Ablauf nachgebaut: att/get-Challenge → BotGuard-Snapshot → GenerateIT → Minter je Video-ID). Der Token (an die Video-ID gebunden) muss in die YTMUSIC-Player-Anfrage (`serviceIntegrityDimensions.poToken`) UND als `&pot=` an die URL – nur `&pot=` ergibt weiter 403 (am Rechner mit BgUtils 4.0.3 geprüft 25.11.2026; an visitorData gebunden: 403). Client ohne androidSdkVersion (YoutubeExplode PR #371): ebenfalls 403 ab ~1 MB. Die Sperre setzt je Video zwischen ~1 und ~1,1 MB ein, deshalb Probelesen ab 2 MB. Ohne Token wird YTMUSIC gar nicht erst versucht. Die WebView lebt im RootLayout: Läuft nur noch der Wiedergabe-Dienst (App aus den letzten Apps entfernt), gibt es keinen Token → Ausweichquellen bzw. Fehler. Handytest 25.11.2026: Token aus der WebView mit Standard-UA wird abgelehnt (am Rechner gegengeprüft: Handy-Token 403, Rechner-Token 206 für dasselbe Video) → WebView-UA wie NewPipe auf Desktop-Chrome gesetzt (Wirkung noch ungetestet). react-native-webview 14.0.1: Typen fehlerhaft (`WebView<P = undefined>` → props never), daher `WebView<object>`.
- SoundCloud: nur mit offiziellen Schlüsseln (SOUNDCLOUD_CLIENT_ID/-SECRET, App-Registrierung laut Doku nur mit Artist Pro). Ohne Schlüssel ungetestet; ob die Stream-URLs den OAuth-Header brauchen (bei HLS-Segmenten nicht möglich), ist laut Doku offen. Token nur im Speicher (Limit 50/12 h je App).
- Vollbild-Player: Download-Schalter (Phase 5), Liedtexte (Phase 7) und Autoplay-Schalter (Phase 7) fehlen noch bewusst.
- @rntp/player-Cache ist aus: Der Media3-Cache verwendet die URL als Schlüssel, YouTube-URLs ändern sich aber bei jedem Abruf. Klären in Phase 6 („Cache-Größe“).
- Benachrichtigungs-Symbol: Standard-Symbol von @rntp/player; eigenes Symbol (Config-Plugin mit Drawable) in Phase 9.

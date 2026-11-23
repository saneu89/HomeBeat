# HomeBeat

Private Musik-App für Familie und Freunde (Android, als `.apk` weitergegeben). Kein Server, kein Login, alle Daten lokal.
Projektregeln und Phasenplan: siehe [CLAUDE.md](CLAUDE.md). Anleitung für die Familie folgt in `ANLEITUNG.md` (Phase 9).

## Einrichtung

```bash
npm install          # legt src/config/secrets.ts aus der Vorlage an
```

Schlüssel (alle kostenlos, alle optional) in `src/config/secrets.ts` eintragen – siehe Kommentare in
`src/config/secrets.example.ts`. Fehlt ein Schlüssel, wird nur die betroffene Quelle übersprungen.

Icons/Splash neu erzeugen (nach Änderung von `assets/HomeBeat_icon.jpeg`):

```bash
npm run icons
```

## .apk bauen

### Weg A – Expo-Cloud (empfohlen, nichts lokal installieren)

Einmalig: kostenloses Konto auf https://expo.dev anlegen, dann

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

Beim ersten Build fragt EAS, ob ein Android-Keystore erzeugt werden soll → **Ja**. EAS verwahrt ihn,
so lassen sich spätere Versionen über die alte App installieren. Am Ende gibt es einen Download-Link
und QR-Code für die `.apk`.

Hinweis: `src/config/secrets.ts` ist in `.gitignore`. EAS lädt beim Build nur Dateien hoch, die Git nicht
ignoriert. Damit die Schlüssel in der Cloud-`.apk` landen, vor dem Build eine Datei `.easignore` anlegen
(dann gilt sie statt `.gitignore`) – Inhalt: wie `.gitignore`, aber ohne die Zeile `src/config/secrets.ts`.

### Weg B – lokal auf diesem Rechner (Windows)

Voraussetzungen: JDK 17 und Android SDK (am einfachsten über Android Studio), Umgebungsvariable
`ANDROID_HOME` gesetzt.

```bash
npx expo prebuild -p android --clean
cd android
./gradlew assembleRelease          # Windows-CMD: gradlew.bat assembleRelease
```

Ergebnis: `android/app/build/outputs/apk/release/app-release.apk`.
Achtung: Ohne eigene Signatur wird mit dem Debug-Schlüssel dieses Rechners signiert. Updates lassen sich
nur über eine App mit **gleichem** Schlüssel installieren – also immer auf demselben Rechner bauen
(oder dauerhaft Weg A nutzen).

Alternativ: `npx eas-cli@latest build -p android --profile preview --local` baut mit EAS-Signatur lokal,
läuft aber nur unter macOS/Linux (unter Windows: WSL2).

### Development Build (zum Entwickeln)

```bash
npx eas-cli@latest build -p android --profile development   # einmalig, .apk aufs Handy
npx expo start --dev-client                                  # danach: Code-Änderungen live
```

Oder lokal mit angeschlossenem Handy: `npx expo run:android`.

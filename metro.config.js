// Metro-Konfiguration für HomeBeat.
// youtubei.js liefert über das "exports"-Feld einen eigenen React-Native-Einstieg
// (Bedingung "react-native" → dist/src/platform/react-native.js). Damit Metro ihn wählt,
// muss die Auflösung über "exports" aktiv sein (Standard seit SDK 53, hier ausdrücklich gesetzt).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = true;

module.exports = config;

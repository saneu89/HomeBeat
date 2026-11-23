/**
 * Erzeugt App-Icon, Adaptive Icon (Vordergrund + Monochrom), Splash-Logo und
 * Kopfzeilen-Logo aus assets/HomeBeat_icon.jpeg.
 *
 * Ablauf:
 *  1. Weißen Rand wegschneiden (das Original ist hochkant 896×1200 mit leerem Rand unten).
 *  2. Logo unverzerrt auf ein Quadrat zentrieren.
 *  3. Adaptive Icon: Das Logo wird so skaliert, dass JEDES nicht-weiße Pixel
 *     (inkl. Kopfhörer-Wellen) innerhalb des sicheren Kreises (66 % des Durchmessers)
 *     liegt. Damit bleibt es bei runden, eckigen und Squircle-Masken vollständig sichtbar.
 *
 * Aufruf: npm run icons
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'assets', 'HomeBeat_icon.jpeg');
const OUT = join(root, 'assets', 'images');
mkdirSync(OUT, { recursive: true });

/** Pixel gilt als „weiß“, wenn alle Kanäle über diesem Wert liegen (JPEG-Artefakte). */
const WHITE_THRESHOLD = 235;

/** Wandelt Weiß in Transparenz um („Color to Alpha“), Farben an Kanten bleiben sauber. */
function whiteToAlpha(data, width, height) {
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    const a = Math.max(255 - r, 255 - g, 255 - b) / 255;
    if (a < (255 - WHITE_THRESHOLD) / 255) {
      out[i * 4 + 3] = 0;
      continue;
    }
    const alpha = Math.min(1, a * 1.15); // Kanten etwas kräftiger, damit nichts ausfranst
    const un = (c) => Math.max(0, Math.min(255, Math.round((c - (1 - alpha) * 255) / alpha)));
    out[i * 4] = un(r);
    out[i * 4 + 1] = un(g);
    out[i * 4 + 2] = un(b);
    out[i * 4 + 3] = Math.round(alpha * 255);
  }
  return out;
}

async function main() {
  // 1. Weißen Rand entfernen
  const trimmed = await sharp(SRC)
    .flatten({ background: '#ffffff' })
    .trim({ background: '#ffffff', threshold: 255 - WHITE_THRESHOLD })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: tw, height: th } = trimmed.info;
  console.log(`Logo nach Zuschnitt: ${tw}×${th}`);

  // Transparente Variante des Logos (für Adaptive Icon, Splash, Kopfzeile)
  const rgba = whiteToAlpha(trimmed.data, tw, th);
  const logoTransparent = sharp(rgba, { raw: { width: tw, height: th, channels: 4 } }).png();
  const logoPng = await logoTransparent.toBuffer();

  // Größter Abstand eines sichtbaren Pixels vom Logo-Mittelpunkt (für den Sicherheitskreis)
  const cx = tw / 2;
  const cy = th / 2;
  let maxR = 0;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      if (rgba[(y * tw + x) * 4 + 3] > 10) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > maxR) maxR = d;
      }
    }
  }

  // 2. App-Icon: Logo zentriert auf weißem Quadrat, unverzerrt, 8 % Rand
  const ICON = 1024;
  const iconInner = Math.round(ICON * 0.84);
  const iconLogo = await sharp(logoPng)
    .resize(iconInner, iconInner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({ create: { width: ICON, height: ICON, channels: 3, background: '#ffffff' } })
    .composite([{ input: iconLogo, gravity: 'center' }])
    .png()
    .toFile(join(OUT, 'icon.png'));

  // 3. Adaptive Icon (108 dp Ebene, sichtbarer Bereich 72 dp, sicherer Kreis 66 dp)
  const ADAPT = 1024;
  const safeRadius = (ADAPT * 0.66) / 2;
  const scale = (safeRadius * 0.97) / maxR; // 3 % Reserve
  const aw = Math.round(tw * scale);
  const ah = Math.round(th * scale);
  const adaptLogo = await sharp(logoPng).resize(aw, ah, { fit: 'fill' }).toBuffer(); // fill = exakt proportional (aw/ah aus gleicher Skala)
  await sharp({ create: { width: ADAPT, height: ADAPT, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: adaptLogo, gravity: 'center' }])
    .png()
    .toFile(join(OUT, 'android-icon-foreground.png'));
  await sharp({ create: { width: ADAPT, height: ADAPT, channels: 3, background: '#ffffff' } })
    .png()
    .toFile(join(OUT, 'android-icon-background.png'));

  // Monochrom (Android 13+ „Designfarben“-Icons): nur die Form als Alphamaske
  const monoRaw = await sharp(adaptLogo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const mono = Buffer.alloc(monoRaw.data.length);
  for (let i = 0; i < monoRaw.info.width * monoRaw.info.height; i++) {
    mono[i * 4] = 255;
    mono[i * 4 + 1] = 255;
    mono[i * 4 + 2] = 255;
    mono[i * 4 + 3] = monoRaw.data[i * 4 + 3];
  }
  const monoLogo = await sharp(mono, { raw: { width: monoRaw.info.width, height: monoRaw.info.height, channels: 4 } })
    .png()
    .toBuffer();
  await sharp({ create: { width: ADAPT, height: ADAPT, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: monoLogo, gravity: 'center' }])
    .png()
    .toFile(join(OUT, 'android-icon-monochrome.png'));

  // Splash: transparentes Logo, quadratisch (Hintergrund kommt aus app.json: weiß)
  const SPLASH = 1024;
  const splashLogo = await sharp(logoPng)
    .resize(SPLASH, SPLASH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp(splashLogo).toFile(join(OUT, 'splash-icon.png'));

  // Kopfzeilen-Logo (liegt in der App auf einer weißen, abgerundeten Fläche)
  await sharp(logoPng)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(OUT, 'logo-header.png'));

  // Favicon (nur Web, der Vollständigkeit halber)
  await sharp(join(OUT, 'icon.png')).resize(48, 48).png().toFile(join(OUT, 'favicon.png'));

  console.log(`Adaptive Icon: Logo ${aw}×${ah} px, max. Radius ${(maxR * scale).toFixed(0)} px von ${safeRadius.toFixed(0)} px (sicherer Kreis)`);
  console.log('Fertig: assets/images/*');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Legt src/config/secrets.ts aus der Vorlage an, falls die Datei fehlt (läuft bei `npm install`).
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'src', 'config', 'secrets.ts');
const example = join(root, 'src', 'config', 'secrets.example.ts');

if (!existsSync(target)) {
  copyFileSync(example, target);
  console.log('src/config/secrets.ts aus Vorlage angelegt – Schlüssel bei Bedarf dort eintragen.');
}

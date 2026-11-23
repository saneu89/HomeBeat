import { SECRETS } from './secrets';

export type SecretName = keyof typeof SECRETS;

/** Liefert den Schlüssel oder `null`, wenn er fehlt. Quellen ohne Schlüssel werden still übersprungen. */
export function getSecret(name: SecretName): string | null {
  const value = SECRETS[name]?.trim();
  return value ? value : null;
}

export function hasSecrets(...names: SecretName[]): boolean {
  return names.every((n) => getSecret(n) !== null);
}

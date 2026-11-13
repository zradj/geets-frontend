/**
 * Everything the client keeps locally. Nothing here is ever sent to the server
 * except the session token (Authorization header / first WebSocket frame).
 *
 *   geets.token              session JWT
 *   geets.<uid>.keys         { groupId: groupKey }      -- lose it and the group is unreadable
 *   geets.<uid>.secrets      { ownerHash: ownerSecret } -- proof of authorship of own messages
 *   geets.pendingInvite      (sessionStorage) invite fragment kept across the login redirect
 */

const TOKEN = 'geets.token';
const PENDING = 'geets.pendingInvite';

type Dict = Record<string, string>;

function read(key: string): Dict {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function write(key: string, value: Dict): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN);
}

/** The opaque account id from the token; only used to namespace local storage. */
function uid(): string {
  try {
    const body = getToken()!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return String(JSON.parse(atob(body)).sub);
  } catch {
    return 'anon';
  }
}

const keysName = () => `geets.${uid()}.keys`;
const secretsName = () => `geets.${uid()}.secrets`;

export function getGroupKey(groupId: string): string | null {
  return read(keysName())[groupId] ?? null;
}

export function saveGroupKey(groupId: string, key: string): void {
  write(keysName(), { ...read(keysName()), [groupId]: key });
}

export function forgetGroup(groupId: string): void {
  const keys = read(keysName());
  delete keys[groupId];
  write(keysName(), keys);
}

export function getOwnerSecret(ownerHash: string): string | null {
  return read(secretsName())[ownerHash] ?? null;
}

export function saveOwnerSecret(ownerHash: string, secret: string): void {
  write(secretsName(), { ...read(secretsName()), [ownerHash]: secret });
}

export function forgetOwnerSecret(ownerHash: string): void {
  const secrets = read(secretsName());
  if (ownerHash in secrets) {
    delete secrets[ownerHash];
    write(secretsName(), secrets);
  }
}

/** Remove every trace of this app from the browser (token, keys, secrets). */
export function wipeEverything(): void {
  for (const k of Object.keys(localStorage)) if (k.startsWith('geets.')) localStorage.removeItem(k);
  sessionStorage.removeItem(PENDING);
}

export function setPendingInvite(fragment: string): void {
  sessionStorage.setItem(PENDING, fragment);
}

export function takePendingInvite(): string | null {
  const v = sessionStorage.getItem(PENDING);
  sessionStorage.removeItem(PENDING);
  return v;
}

export function hasPendingInvite(): boolean {
  return sessionStorage.getItem(PENDING) !== null;
}

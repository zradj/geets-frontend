import { isValidGroupKey } from './crypto';

export interface InviteParts {
  groupId: string;
  token: string;
  key: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Everything secret sits after the '#': browsers never send the fragment to
 * the server, so neither the invite token nor the group key reaches logs.
 */
export function buildInviteLink(origin: string, p: InviteParts): string {
  return `${origin}/join/#g=${p.groupId}&t=${p.token}&k=${p.key}`;
}

/** Accepts a full link or just the fragment. Returns null if anything is off. */
export function parseInvite(input: string): InviteParts | null {
  const hash = input.includes('#') ? input.slice(input.indexOf('#') + 1) : input;
  const params = new URLSearchParams(hash.trim());
  const groupId = params.get('g') ?? '';
  const token = params.get('t') ?? '';
  const key = params.get('k') ?? '';
  if (!UUID.test(groupId) || !/^[A-Za-z0-9_-]{32,128}$/.test(token) || !isValidGroupKey(key)) return null;
  return { groupId: groupId.toLowerCase(), token, key };
}

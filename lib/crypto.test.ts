import { describe, expect, it } from 'vitest';
import {
  decryptText, encryptText, fromB64Url, generateGroupKey, isValidGroupKey,
  messageAad, newOwnerSecret, sha256Hex, toB64Url,
} from './crypto';
import { buildInviteLink, parseInvite } from './invite';

const GID = '3f2b1c9e-8a4d-4f6b-9c1d-2e7a5b8c0d11';
const MID = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';

describe('crypto', () => {
  it('round-trips text, including unicode and the empty string', async () => {
    const key = generateGroupKey();
    for (const text of ['hello', 'привет, мир', '', 'x'.repeat(5000)]) {
      const ct = await encryptText(key, text, messageAad(GID, MID));
      expect(await decryptText(key, ct, messageAad(GID, MID))).toBe(text);
    }
  });

  it('produces server-acceptable base64url and fresh IVs', async () => {
    const key = generateGroupKey();
    const a = await encryptText(key, 'same', 'aad');
    const b = await encryptText(key, 'same', 'aad');
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a).not.toBe(b);
  });

  it('hides message length inside 256-byte buckets', async () => {
    const key = generateGroupKey();
    const len = async (s: string) => fromB64Url(await encryptText(key, s, 'a')).length;
    expect(await len('a')).toBe(await len('a'.repeat(200)));
    expect(await len('a'.repeat(255))).toBe(12 + 256 + 16);
    expect(await len('a'.repeat(256))).toBe(12 + 512 + 16);
  });

  it('rejects the wrong key, tampering, and a ciphertext moved to another message', async () => {
    const key = generateGroupKey();
    const ct = await encryptText(key, 'secret', messageAad(GID, MID));
    await expect(decryptText(generateGroupKey(), ct, messageAad(GID, MID))).rejects.toThrow();
    await expect(decryptText(key, ct, messageAad(GID, crypto.randomUUID()))).rejects.toThrow();
    const bytes = fromB64Url(ct);
    bytes[20] ^= 1;
    await expect(decryptText(key, toB64Url(bytes), messageAad(GID, MID))).rejects.toThrow();
    await expect(decryptText(key, 'AAAA', messageAad(GID, MID))).rejects.toThrow();
  });

  it('makes owner secrets whose hash matches what the server computes', async () => {
    const { secret, hash } = await newOwnerSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex(secret)).toBe(hash);
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect((await newOwnerSecret()).hash).not.toBe(hash);
  });

  it('validates group keys', () => {
    expect(isValidGroupKey(generateGroupKey())).toBe(true);
    expect(isValidGroupKey('short')).toBe(false);
    expect(isValidGroupKey('not base64 !!')).toBe(false);
  });
});

describe('invite links', () => {
  const parts = { groupId: GID, token: 'T'.repeat(43), key: generateGroupKey() };

  it('round-trips and keeps secrets in the fragment only', () => {
    const link = buildInviteLink('https://chat.example', parts);
    expect(parseInvite(link)).toEqual(parts);
    const url = new URL(link);
    expect(url.search).toBe('');
    expect(url.pathname).toBe('/join/');
    expect(url.pathname + url.search).not.toContain(parts.key);
    expect(parseInvite(url.hash)).toEqual(parts);
  });

  it('rejects malformed links', () => {
    expect(parseInvite('')).toBeNull();
    expect(parseInvite('https://chat.example/join/')).toBeNull();
    expect(parseInvite(`#g=nope&t=${parts.token}&k=${parts.key}`)).toBeNull();
    expect(parseInvite(`#g=${GID}&t=${parts.token}&k=short`)).toBeNull();
    expect(parseInvite(`#g=${GID}&t=x&k=${parts.key}`)).toBeNull();
  });
});

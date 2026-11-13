/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * End-to-end check against a running backend, using the real client crypto.
 *
 *   E2E_URL=http://127.0.0.1:8000 npm test
 *
 * Skipped when E2E_URL is not set.
 */
import { describe, expect, it } from 'vitest';
import { decryptText, encryptText, generateGroupKey, messageAad, newOwnerSecret, TITLE_AAD } from '../lib/crypto';
import { buildInviteLink, parseInvite } from '../lib/invite';
import { normalizeMessage } from '../lib/normalize';

const BASE = process.env.E2E_URL ?? '';

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

class Client {
  events: any[] = [];
  private waiters: (() => void)[] = [];
  private constructor(public token: string, private ws: WebSocket) {}

  static async create(name: string): Promise<Client> {
    const { token } = await call('POST', '/auth/register', undefined, { username: name, password: 'a long password 123' });
    const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/ws');
    const client = new Client(token, ws);
    ws.onmessage = (m) => {
      client.events.push(JSON.parse(String(m.data)));
      client.waiters.splice(0).forEach((w) => w());
    };
    await new Promise<void>((ok, fail) => {
      ws.onopen = () => ok();
      ws.onerror = () => fail(new Error('ws failed'));
    });
    ws.send(JSON.stringify({ type: 'auth', payload: { token } }));
    expect(await client.next()).toEqual({ type: 'auth.ok' });
    return client;
  }

  async next(): Promise<any> {
    while (!this.events.length) await new Promise<void>((r) => this.waiters.push(r));
    return this.events.shift();
  }

  send(type: string, payload: unknown) {
    this.ws.send(JSON.stringify({ type, payload }));
  }

  close() {
    this.ws.close();
  }
}

describe.skipIf(!BASE)('end to end', () => {
  it('three members chat without the server learning text or authorship', async () => {
    const run = Math.random().toString(36).slice(2, 8);
    const [a, b, c] = await Promise.all(['a', 'b', 'c'].map((n) => Client.create(`e2e_${n}_${run}`)));

    // A creates a group; the title is encrypted before it leaves the client.
    const key = generateGroupKey();
    const group = await call('POST', '/groups', a.token, { title_ct: await encryptText(key, 'night shift', TITLE_AAD) });
    const { token: inviteToken } = await call('POST', `/groups/${group.id}/invites`, a.token, {});
    const link = buildInviteLink('https://chat.example', { groupId: group.id, token: inviteToken, key });

    // B and C join with the link alone.
    const invite = parseInvite(link)!;
    for (const who of [b, c]) await call('POST', `/groups/${invite.groupId}/join`, who.token, { invite_token: invite.token });
    expect((await a.next()).payload.member_count).toBe(2);
    expect((await a.next()).payload.member_count).toBe(3);
    await b.next(); // b's own join
    await b.next(); // b sees c join
    await c.next(); // c's own join

    const listed = (await call('GET', '/groups', c.token))[0];
    expect(await decryptText(invite.key, listed.title_ct, TITLE_AAD)).toBe('night shift');
    expect(JSON.stringify(listed)).not.toContain('night');

    // B sends. Text is normalised, encrypted, and carries a one-off ownership hash.
    const text = normalizeMessage('Hello!!   WORLD 😀\nHow ARE you');
    expect(text).toBe('hello world how are you');
    const id = crypto.randomUUID();
    const { secret, hash } = await newOwnerSecret();
    b.send('message.create', {
      id, group_id: group.id, owner_hash: hash,
      ciphertext: await encryptText(invite.key, text, messageAad(group.id, id)),
    });

    const [ea, eb, ec] = await Promise.all([a.next(), b.next(), c.next()]);
    expect(ea).toEqual(eb);
    expect(eb).toEqual(ec);
    expect(Object.keys(ea.payload).sort()).toEqual(['ciphertext', 'created_at', 'edited', 'group_id', 'id', 'owner_hash']);
    expect(await decryptText(invite.key, ea.payload.ciphertext, messageAad(group.id, id))).toBe(text);

    // Only the holder of the secret can edit; the admin can delete but not edit.
    const edited = await encryptText(invite.key, 'changed my mind', messageAad(group.id, id));
    c.send('message.edit', { id, owner_secret: 'x'.repeat(43), ciphertext: edited });
    expect((await c.next()).payload.code).toBe('forbidden');
    b.send('message.edit', { id, owner_secret: secret, ciphertext: edited });
    const after = await a.next();
    expect(after.type).toBe('message.edited');
    expect(await decryptText(invite.key, after.payload.ciphertext, messageAad(group.id, id))).toBe('changed my mind');
    await Promise.all([b.next(), c.next()]);

    const history = await call('GET', `/groups/${group.id}/messages`, c.token);
    expect(history).toHaveLength(1);
    expect(JSON.stringify(history)).not.toMatch(/user|sender|e2e_/);

    a.send('message.delete', { id });
    expect((await c.next()).type).toBe('message.deleted');
    expect(await call('GET', `/groups/${group.id}/messages`, b.token)).toEqual([]);

    await call('DELETE', `/groups/${group.id}`, a.token);
    [a, b, c].forEach((x) => x.close());
  }, 20_000);
});

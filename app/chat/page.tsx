'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, Group, WireMessage } from '@/lib/api';
import { decryptText, encryptText, generateGroupKey, messageAad, newOwnerSecret, TITLE_AAD } from '@/lib/crypto';
import { buildInviteLink, parseInvite } from '@/lib/invite';
import { MAX_MESSAGE_CHARS, normalizeMessage } from '@/lib/normalize';
import {
  clearToken, forgetGroup, forgetOwnerSecret, getGroupKey, getOwnerSecret, getToken,
  saveGroupKey, saveOwnerSecret, wipeEverything,
} from '@/lib/store';
import { ServerEvent, useSocket } from '@/lib/useSocket';

interface Msg {
  id: string;
  group_id: string;
  text: string | null; // null = could not decrypt
  created_at: string;
  edited: boolean;
  owner_hash: string;
}

type Modal = null | 'new' | 'invite' | 'settings';

async function decryptMessage(m: WireMessage): Promise<Msg> {
  const key = getGroupKey(m.group_id);
  let text: string | null = null;
  if (key) {
    try {
      // Normalise again on the way in: never trust the sender's client to have done it.
      text = normalizeMessage(await decryptText(key, m.ciphertext, messageAad(m.group_id, m.id)));
    } catch {}
  }
  return { id: m.id, group_id: m.group_id, text, created_at: m.created_at, edited: m.edited, owner_hash: m.owner_hash };
}

async function decryptTitle(g: Group): Promise<string | null> {
  const key = getGroupKey(g.id);
  if (!key) return null;
  try {
    return normalizeMessage(await decryptText(key, g.title_ct, TITLE_AAD)).slice(0, 60) || null;
  } catch {
    return null;
  }
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function ChatPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [titles, setTitles] = useState<Record<string, string | null>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [unread, setUnread] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<Msg | null>(null);
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [modalInput, setModalInput] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [keyVersion, setKeyVersion] = useState(0); // bumps when a key is imported

  const selectedRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const selected = groups.find((g) => g.id === selectedId) ?? null;
  const hasKey = useMemo(
    () => (selectedId ? getGroupKey(selectedId) !== null : false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, keyVersion],
  );
  const preview = normalizeMessage(draft);

  const flash = useCallback((text: string) => {
    setNotice(text);
    setTimeout(() => setNotice((n) => (n === text ? '' : n)), 5000);
  }, []);

  const loadGroups = useCallback(async () => {
    const list = await api.groups();
    setGroups(list);
    const entries = await Promise.all(list.map(async (g) => [g.id, await decryptTitle(g)] as const));
    setTitles(Object.fromEntries(entries));
    return list;
  }, []);

  const loadMessages = useCallback(async (groupId: string) => {
    const page = await api.messages(groupId);
    const decrypted = await Promise.all(page.map(decryptMessage));
    if (selectedRef.current !== groupId) return;
    stickToBottom.current = true;
    setMessages(decrypted);
    setHasMore(page.length === 50);
  }, []);

  const select = useCallback((groupId: string | null) => {
    selectedRef.current = groupId;
    setSelectedId(groupId);
    setMessages([]);
    setHasMore(false);
    setEditing(null);
    setDraft('');
    if (groupId) {
      setUnread((u) => ({ ...u, [groupId]: false }));
      loadMessages(groupId).catch((e) => flash(e.message));
    }
  }, [loadMessages, flash]);

  // ---- startup ----
  useEffect(() => {
    if (!getToken()) {
      router.replace('/login/');
      return;
    }
    (async () => {
      try {
        const list = await loadGroups();
        const wanted = new URLSearchParams(window.location.search).get('g');
        window.history.replaceState(null, '', window.location.pathname);
        const first = list.find((g) => g.id === wanted) ?? list[0];
        if (first) select(first.id);
      } catch {}
      setReady(true);
    })();
  }, [router, loadGroups, select]);

  // ---- live events ----
  const onEvent = useCallback(async (e: ServerEvent) => {
    const p = (e.payload ?? {}) as Record<string, string>;
    switch (e.type) {
      case 'message.created': {
        const wire = e.payload as unknown as WireMessage;
        if (wire.group_id !== selectedRef.current) {
          setUnread((u) => ({ ...u, [wire.group_id]: true }));
          return;
        }
        const msg = await decryptMessage(wire);
        setMessages((list) => (list.some((m) => m.id === msg.id) ? list : [...list, msg]));
        return;
      }
      case 'message.edited': {
        const msg = await decryptMessage(e.payload as unknown as WireMessage);
        setMessages((list) => list.map((m) => (m.id === msg.id ? msg : m)));
        return;
      }
      case 'message.deleted':
        setMessages((list) => {
          const gone = list.find((m) => m.id === p.id);
          if (gone) forgetOwnerSecret(gone.owner_hash);
          return list.filter((m) => m.id !== p.id);
        });
        return;
      case 'group.members':
        setGroups((list) => list.map((g) => (g.id === p.group_id ? { ...g, member_count: Number(p.member_count) } : g)));
        return;
      case 'group.deleted':
        forgetGroup(p.group_id);
        setGroups((list) => list.filter((g) => g.id !== p.group_id));
        if (selectedRef.current === p.group_id) select(null);
        return;
      case 'error':
        flash(String((e.payload as { message?: string })?.message ?? 'error').toLowerCase());
        return;
    }
  }, [flash, select]);

  const onReconnect = useCallback(() => {
    loadGroups().catch(() => {});
    if (selectedRef.current) loadMessages(selectedRef.current).catch(() => {});
  }, [loadGroups, loadMessages]);

  const { connected, send } = useSocket(onEvent, onReconnect);

  useEffect(() => {
    if (stickToBottom.current) bottomRef.current?.scrollIntoView();
  }, [messages]);

  // ---- actions ----
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const key = selectedId && getGroupKey(selectedId);
    if (!selectedId || !key || !preview) return;
    stickToBottom.current = true;

    if (editing) {
      const secret = getOwnerSecret(editing.owner_hash);
      if (!secret) return flash('this device cannot prove the message is yours');
      const ciphertext = await encryptText(key, preview, messageAad(selectedId, editing.id));
      if (!send('message.edit', { id: editing.id, owner_secret: secret, ciphertext }, editing.id)) return flash('offline');
      setEditing(null);
    } else {
      const id = crypto.randomUUID();
      const { secret, hash } = await newOwnerSecret();
      const ciphertext = await encryptText(key, preview, messageAad(selectedId, id));
      saveOwnerSecret(hash, secret);
      if (!send('message.create', { id, group_id: selectedId, ciphertext, owner_hash: hash }, id)) {
        forgetOwnerSecret(hash);
        return flash('offline');
      }
    }
    setDraft('');
  };

  const removeMessage = (m: Msg) => {
    const secret = getOwnerSecret(m.owner_hash);
    if (!send('message.delete', { id: m.id, ...(secret ? { owner_secret: secret } : {}) }, m.id)) flash('offline');
  };

  const loadOlder = async () => {
    if (!selectedId || !messages.length) return;
    try {
      const page = await api.messages(selectedId, messages[0].created_at);
      const older = await Promise.all(page.map(decryptMessage));
      stickToBottom.current = false;
      setMessages((list) => [...older.filter((o) => !list.some((m) => m.id === o.id)), ...list]);
      setHasMore(page.length === 50);
    } catch (e) {
      flash((e as Error).message);
    }
  };

  const createGroup = async (e: FormEvent) => {
    e.preventDefault();
    const title = normalizeMessage(modalInput).slice(0, 60);
    if (!title) return;
    try {
      const key = generateGroupKey();
      const group = await api.createGroup(await encryptText(key, title, TITLE_AAD));
      saveGroupKey(group.id, key);
      setGroups((list) => [...list, group]);
      setTitles((t) => ({ ...t, [group.id]: title }));
      closeModal();
      select(group.id);
    } catch (err) {
      flash((err as Error).message.toLowerCase());
    }
  };

  const openInvite = async () => {
    const key = selectedId && getGroupKey(selectedId);
    if (!selectedId || !key) return;
    try {
      const { token } = await api.createInvite(selectedId);
      setInviteLink(buildInviteLink(window.location.origin, { groupId: selectedId, token, key }));
      setModal('invite');
    } catch (err) {
      flash((err as Error).message.toLowerCase());
    }
  };

  const importKey = async (e: FormEvent) => {
    e.preventDefault();
    const invite = parseInvite(modalInput);
    if (!invite || invite.groupId !== selectedId) return flash('that link is not for this group');
    saveGroupKey(invite.groupId, invite.key);
    setModalInput('');
    setKeyVersion((v) => v + 1);
    await loadGroups();
    await loadMessages(invite.groupId);
  };

  const leave = async () => {
    if (!selected || !confirm('leave this group? you will need a new invite link to come back.')) return;
    await api.leaveGroup(selected.id).catch((e) => flash(e.message));
    forgetGroup(selected.id);
    setGroups((list) => list.filter((g) => g.id !== selected.id));
    select(null);
  };

  const destroy = async () => {
    if (!selected || !confirm('delete this group and all of its messages for everyone?')) return;
    await api.deleteGroup(selected.id).catch((e) => flash(e.message));
  };

  const logout = (wipe: boolean) => {
    if (wipe && !confirm('this removes all group keys from this browser. without an invite link you will not be able to read those groups again. continue?')) return;
    if (wipe) wipeEverything();
    else clearToken();
    window.location.assign('/login/');
  };

  const deleteAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirm('delete the account for good?')) return;
    try {
      await api.deleteAccount(modalInput);
      wipeEverything();
      window.location.assign('/register/');
    } catch (err) {
      flash((err as Error).message.toLowerCase());
    }
  };

  const closeModal = () => {
    setModal(null);
    setModalInput('');
    setInviteLink('');
  };

  if (!ready) return <main className="flex min-h-dvh items-center justify-center text-dim">loading...</main>;

  const tooSmall = selected ? selected.member_count < selected.min_members : false;
  const btn = 'rounded border border-line px-2 py-1 text-sm hover:border-accent';
  const field = 'w-full rounded border border-line bg-bg px-3 py-2 outline-none focus:border-accent';

  return (
    <div className="flex h-dvh">
      {/* ---- sidebar ---- */}
      <aside className={`${selected ? 'hidden md:flex' : 'flex'} w-full flex-col border-r border-line bg-panel md:w-72`}>
        <header className="flex items-center justify-between border-b border-line p-3">
          <span className="font-semibold">geets</span>
          <span className="flex gap-2">
            <button className={btn} onClick={() => setModal('new')}>+ group</button>
            <button className={btn} onClick={() => setModal('settings')} aria-label="settings">⋯</button>
          </span>
        </header>
        <nav className="flex-1 overflow-y-auto">
          {groups.length === 0 && (
            <p className="p-4 text-sm text-dim">no groups yet. create one, or open an invite link someone sent you.</p>
          )}
          {groups.map((g) => (
            <button key={g.id} onClick={() => select(g.id)}
              className={`flex w-full items-center justify-between border-b border-line px-3 py-3 text-left hover:bg-bg ${g.id === selectedId ? 'bg-bg' : ''}`}>
              <span className="truncate">{titles[g.id] ?? 'locked group'}</span>
              <span className="ml-2 shrink-0 text-xs text-dim">
                {unread[g.id] && <span className="mr-2 text-accent">new</span>}
                {g.member_count}
              </span>
            </button>
          ))}
        </nav>
        <footer className="border-t border-line p-3 text-xs text-dim">
          {connected ? 'connected' : 'reconnecting...'}
        </footer>
      </aside>

      {/* ---- conversation ---- */}
      <main className={`${selected ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
        {!selected ? (
          <p className="m-auto p-6 text-center text-dim">pick a group. nobody here has a name.</p>
        ) : (
          <>
            <header className="flex items-center justify-between gap-2 border-b border-line p-3">
              <div className="min-w-0">
                <button className="mr-2 text-dim md:hidden" onClick={() => select(null)} aria-label="back">←</button>
                <span className="font-semibold">{titles[selected.id] ?? 'locked group'}</span>
                <span className="ml-2 text-xs text-dim">{selected.member_count} members</span>
              </div>
              <div className="flex shrink-0 gap-2">
                {hasKey && <button className={btn} onClick={openInvite}>invite</button>}
                <button className={btn} onClick={leave}>leave</button>
                {selected.is_admin && <button className={`${btn} text-danger`} onClick={destroy}>delete</button>}
              </div>
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto p-3"
              onScroll={(e) => {
                const el = e.currentTarget;
                stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              }}>
              {hasMore && <button className={`${btn} mx-auto block`} onClick={loadOlder}>load older</button>}
              {/* Every message looks the same, your own included: a screenshot or a
                  glance over your shoulder must not reveal which ones you wrote. */}
              {messages.map((m) => {
                const mine = getOwnerSecret(m.owner_hash) !== null;
                return (
                  <div key={m.id} className="group max-w-2xl rounded border border-line bg-panel px-3 py-2">
                    <p className="whitespace-pre-wrap break-words">
                      {m.text ?? <span className="text-dim">[cannot decrypt]</span>}
                    </p>
                    <p className="mt-1 flex gap-3 text-xs text-dim">
                      <span>{time(m.created_at)}{m.edited && ' · edited'}</span>
                      <span className="hidden gap-3 group-hover:flex group-focus-within:flex">
                        {mine && m.text !== null && (
                          <button className="hover:text-accent" onClick={() => { setEditing(m); setDraft(m.text ?? ''); }}>edit</button>
                        )}
                        {(mine || selected.is_admin) && (
                          <button className="hover:text-danger" onClick={() => removeMessage(m)}>delete</button>
                        )}
                      </span>
                    </p>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <footer className="border-t border-line p-3">
              {!hasKey ? (
                <form onSubmit={importKey} className="space-y-2">
                  <p className="text-sm text-dim">
                    this browser has no key for this group. paste any invite link for it to unlock the messages.
                  </p>
                  <div className="flex gap-2">
                    <input className={field} placeholder="invite link" value={modalInput}
                      onChange={(e) => setModalInput(e.target.value)} />
                    <button className={btn}>unlock</button>
                  </div>
                </form>
              ) : tooSmall ? (
                <p className="text-sm text-dim">
                  messaging opens at {selected.min_members} members ({selected.member_count} now): in a smaller group
                  it is obvious who wrote what. invite more people.
                </p>
              ) : (
                <form onSubmit={submit} className="space-y-1">
                  {editing && (
                    <p className="text-xs text-dim">
                      editing a message ·{' '}
                      <button type="button" className="underline" onClick={() => { setEditing(null); setDraft(''); }}>cancel</button>
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input className={field} placeholder="write a message" value={draft} autoComplete="off"
                      maxLength={MAX_MESSAGE_CHARS * 2} onChange={(e) => setDraft(e.target.value)} />
                    <button disabled={!preview || !connected}
                      className="rounded bg-accent px-4 py-2 font-medium text-black disabled:opacity-40">
                      {editing ? 'save' : 'send'}
                    </button>
                  </div>
                  {draft && preview !== draft && (
                    <p className="truncate text-xs text-dim">will be sent as: {preview || '(nothing)'}</p>
                  )}
                </form>
              )}
            </footer>
          </>
        )}
      </main>

      {notice && (
        <p role="status" className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded border border-danger/60 bg-panel px-4 py-2 text-sm">
          {notice}
        </p>
      )}

      {/* ---- modals ---- */}
      {modal && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70 p-4" onClick={closeModal}>
          <div className="w-full max-w-md space-y-3 rounded border border-line bg-panel p-4" onClick={(e) => e.stopPropagation()}>
            {modal === 'new' && (
              <form onSubmit={createGroup} className="space-y-3">
                <h2 className="font-semibold">new group</h2>
                <input autoFocus className={field} placeholder="group title" maxLength={120} value={modalInput}
                  onChange={(e) => setModalInput(e.target.value)} />
                <p className="text-xs text-dim">
                  the title is encrypted on this device; the server never sees it. people join through an invite link.
                </p>
                <button className="rounded bg-accent px-4 py-2 font-medium text-black">create</button>
              </form>
            )}
            {modal === 'invite' && (
              <>
                <h2 className="font-semibold">invite link</h2>
                <textarea readOnly className={`${field} h-28 break-all text-xs`} value={inviteLink}
                  onFocus={(e) => e.currentTarget.select()} />
                <p className="text-xs text-dim">
                  valid for 3 days. this link contains the group key: anyone who has it can join and read everything.
                  send it over a channel you trust, and keep a copy if you want to read this group on another device.
                </p>
                <button className={btn} onClick={() => navigator.clipboard.writeText(inviteLink).then(() => flash('copied'))}>copy</button>
              </>
            )}
            {modal === 'settings' && (
              <>
                <h2 className="font-semibold">session</h2>
                <div className="flex flex-wrap gap-2">
                  <button className={btn} onClick={() => logout(false)}>log out</button>
                  <button className={`${btn} text-danger`} onClick={() => logout(true)}>log out and wipe this browser</button>
                </div>
                <p className="text-xs text-dim">
                  group keys live only in this browser. a plain log out keeps them; wiping removes them.
                </p>
                <form onSubmit={deleteAccount} className="space-y-2 border-t border-line pt-3">
                  <h2 className="font-semibold">delete account</h2>
                  <input type="password" className={field} placeholder="password" autoComplete="current-password"
                    value={modalInput} onChange={(e) => setModalInput(e.target.value)} />
                  <button className={`${btn} text-danger`}>delete account</button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

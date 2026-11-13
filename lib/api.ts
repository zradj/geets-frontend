import { clearToken, getToken } from './store';

/** Empty in production: the API is served from the same origin as the page. */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export function wsUrl(): string {
  const base = API_BASE || window.location.origin;
  return base.replace(/^http/, 'ws') + '/ws';
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
  if (res.status === 401 && token && !path.startsWith('/auth/')) {
    clearToken();
    window.location.assign('/login/');
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data.detail === 'string') detail = data.detail;
      else if (res.status === 422) detail = 'Invalid input';
    } catch {}
    throw new ApiError(res.status, detail);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export interface Group {
  id: string;
  title_ct: string;
  member_count: number;
  min_members: number;
  is_admin: boolean;
}

export interface WireMessage {
  id: string;
  group_id: string;
  ciphertext: string;
  owner_hash: string;
  created_at: string;
  edited: boolean;
}

export const api = {
  register: (username: string, password: string) =>
    request<{ token: string }>('POST', '/auth/register', { username, password }),
  login: (username: string, password: string) =>
    request<{ token: string }>('POST', '/auth/login', { username, password }),
  deleteAccount: (password: string) => request<void>('POST', '/auth/delete-account', { password }),

  groups: () => request<Group[]>('GET', '/groups'),
  createGroup: (title_ct: string) => request<Group>('POST', '/groups', { title_ct }),
  deleteGroup: (id: string) => request<void>('DELETE', `/groups/${id}`),
  leaveGroup: (id: string) => request<void>('POST', `/groups/${id}/leave`),
  createInvite: (id: string) => request<{ token: string; expires_at: string }>('POST', `/groups/${id}/invites`, {}),
  joinGroup: (id: string, invite_token: string) => request<Group>('POST', `/groups/${id}/join`, { invite_token }),
  messages: (id: string, before?: string) =>
    request<WireMessage[]>('GET', `/groups/${id}/messages?limit=50${before ? `&before=${encodeURIComponent(before)}` : ''}`),
};

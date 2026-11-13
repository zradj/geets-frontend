# geets-frontend

Web client of **geets** — a group messenger in which nobody has a name. All cryptography happens
here; the server (sibling repository `geets-backend`) only ever sees ciphertext. Start with that
repository's `README.md`, `SECURITY.md` and `docs/PROTOCOL.md`.

Next.js (App Router) built as a **static export**: production is plain files served by Caddy,
there is no Node.js server.

```
app/            pages: /login /register /join /chat
components/     AuthForm
lib/
  crypto.ts     AES-256-GCM, padding, owner secrets
  normalize.ts  the uniform message format (lower case, single spaces, no "!", no emoji, …)
  invite.ts     invite links (group id + invite token + key, all inside the #fragment)
  store.ts      what is kept in localStorage: session token, group keys, owner secrets
  api.ts        HTTP client
  useSocket.ts  authenticated WebSocket with reconnect
e2e/            end-to-end test against a live backend
Caddyfile       production web server config (TLS, security headers, proxy to the API)
Dockerfile      build -> static files -> Caddy image
```

## Develop

```bash
npm install
cp .env.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                     # http://localhost:3000
```

The backend must run on :8000 with `CORS_ORIGINS=http://localhost:3000` in its `.env`.
WebCrypto needs a secure context: `localhost` and HTTPS work, a plain‑HTTP LAN address does not.

## Test

```bash
npm test                                   # unit tests: crypto, normalisation, invite links
E2E_URL=http://127.0.0.1:8000 npm test     # + full flow against a running backend
npm run lint
npm run build                              # static site in ./out
```

## Things to keep true when changing the client

* Every displayed message goes through `normalizeMessage` **after decryption**, not only before
  sending. The server cannot enforce the format.
* Own messages are rendered exactly like everyone else's. Only the hover actions differ.
* No login name, user id or member list is ever rendered. The API does not provide them.
* Messages are text. Do not add attachments, images, link previews or anything that fetches
  from a third party — each of those is a fingerprint or a tracking request.
* Invite secrets stay in the URL fragment and are removed from the address bar on arrival.
* No third‑party scripts, fonts or analytics. The CSP in `Caddyfile` forbids them anyway.
* Group keys exist only in this browser's `localStorage`. Clearing site data without a saved
  invite link means losing access to the group's history.

# User reconnection and authentication

## What happens if a player refreshes during a game?

Refreshing closes that player's WebSocket connection.

Each browser stores a persistent auth token in localStorage. During login and
websocket connect, the client sends:

- `name`
- `lobby`
- `token`

If the token matches the name already bound in that lobby, the server force-replaces
the old socket(s) for that name with the new socket.

So in practice:

- refresh => old socket closes
- reconnect with same `name` + `lobby` + `token`
- server closes stale connection(s) for that identity
- new socket is accepted immediately

## How users are authenticated

This app uses **lobby-local token binding**, not account/password auth.

1. Client gets/creates `sho_auth_token_v1` in `localStorage`.
2. Client calls `GET /check-login?name=...&lobby=...&token=...`.
3. Client opens WebSocket with `?name=...&lobby=...&token=...`.
4. Server binds `(lobby, name)` to the first successful token it sees.
5. Future joins for that same `(lobby, name)` must present the same token.

If a different token tries to use a protected name, login is rejected.

## Cookies, local storage, or session storage?

### localStorage: yes

- `sho_auth_token_v1` — persistent auth token used for name ownership and force-rejoin.

### Cookies: yes

The frontend also uses cookies for convenience/UI state:

- `name` — remember last entered username
- `lobby` — remember last lobby code
- `_unlock_icons` — cosmetic icon unlock state

### sessionStorage: no

No `sessionStorage` is used for login/auth state.

### Are cookies used for backend auth?

No. Backend auth/identity checks are token-based (`token` query param) plus
WebSocket context validation.

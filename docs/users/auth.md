# User reconnection and authentication

## What happens if a player refreshes during a game?

Refreshing closes that player's WebSocket connection.

On the backend, the disconnected socket is removed immediately, but the username is only removed from active users after a short delay (`PLAYER_TIMEOUT_IN_SEC = 3`). This delay gives the player a brief window to reconnect without being treated as fully gone.

During an active game:

- players who were in the game can rejoin with the same name
- new users can also join as observers (spectators), as long as they use a name not currently in use by a connected user

So in practice:

- refresh => socket drops
- player can rejoin with same `name` + `lobby`
- observer can join with a new `name` + `lobby`
- server restores/replays the current running game state

## How are users authenticated?

There is no account/password/token auth layer.

Identity is lobby-local and name-based:

1. Client calls `GET /check-login?name=...&lobby=...`
2. If accepted, client opens WebSocket with `?name=...&lobby=...`
3. Every WS command includes `name` and `lobby`
4. Server verifies that this WebSocket context is registered as that user in that lobby

This is session-like behavior tied to the current WebSocket connection, not persistent account authentication.

## Cookies, local storage, or session storage?

### Cookies: yes

The frontend uses cookies for convenience/UI state:

- `name` — remember last entered username
- `lobby` — remember last lobby code
- `_unlock_icons` — cosmetic icon unlock state

### localStorage/sessionStorage: no

No `localStorage` or `sessionStorage` usage is used for login/auth state.

### Are cookies used for backend auth?

No. Backend auth/identity checks are based on WebSocket connection + `name` + `lobby` rules, not cookie validation.

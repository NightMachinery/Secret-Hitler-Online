# Temporary bot control during games

## What this does

During an active game, the original lobby creator can temporarily hand off a player to a bot so the round can continue if someone goes AFK or disconnects.

## Rules

- Only available while a game is running.
- Only the original lobby creator can turn bot mode **on** for a player.
- Bot mode can be turned **off** by:
  - the original creator, or
  - the affected player themselves.
- Dead players cannot be toggled.
- Bot status resets when the game ends and returns to lobby.
- Built-in `Bot N` players are always bots and cannot be toggled.

## Reclaiming control

If a player is bot-controlled, they can reclaim control in two ways:

1. Click the UI reclaim button.
2. Successfully perform a valid in-game action themselves.

On the first successful manual game action, bot mode is automatically disabled for that player.

## Visibility

Bot players are shown with a small `BOT` status tag on the player card.

Bot controls are shown as small beveled control tabs on player cards in the top player row:

- creator sees per-player toggle buttons (`BOT` / `HUM`) for eligible human players
- a bot-controlled user can reclaim control from their own card

If bot mode is enabled for a user while they have an action prompt open, the UI immediately closes stale prompts and shows a notice.

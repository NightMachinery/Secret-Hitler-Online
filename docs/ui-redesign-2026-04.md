# UI redesign notes — 2026-04-24

## Self-hosting verification

Verified `self_host.zsh` already supports `dev-start`.

Verified `start`, `dev-start`, and `redeploy` all stop whichever local self-host runtime is currently active before bringing services back up:

- `handle_start`, `handle_dev_start`, and `handle_redeploy` all call `prepare_local_runtime`
- `prepare_local_runtime` calls `stop_local_stack_internal`
- `stop_local_stack_internal` stops the tmux frontend/backend/PostgreSQL sessions and stops the local PostgreSQL instance if needed

This means switching between `start`, `dev-start`, and `redeploy` is already deterministic.

## Baseline UI problems found

Initial browser review of the official self-hosted URL found these recurring design issues:

1. The home screen had weak hierarchy and large empty areas.
2. Inputs, checkboxes, selects, and primary actions did not feel like one visual system.
3. Lobby surfaces felt flat and disconnected instead of grouped into clear panels.
4. Player cards used the original portrait frame well, but action buttons and state badges felt cramped and unclear.
5. Bot/observer/moderator actions relied on small abbreviated controls with weak affordance.
6. The discussion reaction dock worked, but felt bolted on rather than integrated into the rest of the game UI.
7. Modal prompts were functional but visually plain.

## Design direction chosen

Using the generated desktop/mobile references, the redesign direction is:

- dark charcoal / walnut background
- ember + brass accents
- parchment-like framed panels
- stronger section hierarchy
- larger tactile buttons
- clearer player-card status chips and action bars
- reaction controls with labels instead of icon-only affordances
- more polished modal surfaces

## Implemented frontend changes in progress

### Layout and theming

- rewired the login and lobby pages onto a more structured shell/card layout
- added a shared premium dark theme for buttons, text fields, selects, snackbars, and panels
- polished lobby invite/link presentation and supporting shell styles

### Player cards

- redesigned player-card status badges to be more legible and easier to scan
- moved player-card action controls into a clearer action row beneath the card
- expanded action labels so bot / reclaim / moderator / observer actions are easier to understand
- kept discussion reaction badges integrated with the card art while improving surrounding polish

### Discussion reactions and prompts

- redesigned the discussion reaction dock into labeled action tiles with clearer readouts
- upgraded reaction settings styling
- upgraded modal / alert framing to better match the new visual system

## Next step

Once VPS disk pressure is healthy enough again, run `./self_host.zsh dev-start`, review the official URL in Chrome MCP, and continue refinement iterations from the live result.

# Reactions, status ticker, and history results

## Discussion reactions

During an active game, eligible players can send short discussion cues from the fixed reaction side rail on the right edge of the game. The rail overlays the board instead of taking layout space and can be collapsed so it stays available without covering the history log. If a game popup is minimized, the rail is still available; it is hidden only while the popup is expanded.

Reaction cues appear in three places:

- On the reacting player card as a circular emblem.
- In the sticky top status ticker as the latest event.
- In the reaction dock readout while the cue is active.

Reaction sounds are local to each browser/player. Open the reaction settings gear and enable **Mute reaction sounds** to disable cues on that device without changing anyone else’s settings.

## Sticky status ticker

The top status bar sits immediately under the app header and stays visible as a news-style subtitle for the most recent game event. Vote prompts, turn-state updates, and discussion reactions can all update this ticker.

## History result trails

The history log keeps the final result label, but it can also show compact result-trail symbols when randomness changed the outcome:

- `✗ → 🎲 → Fascist/Liberal/...` means a failed election advanced the tracker and enacted a random top-deck card.
- `Ⓐ → 🎲 → Fascist/Liberal/...` means an Anarchist policy resolved into a random replacement card.
- Multiple Anarchist cascades repeat the Anarchist symbol, for example `Ⓐ → Ⓐ → 🎲 → Liberal`.

These trails are recorded by the server and are visible even when the compact table needs to keep each row short.

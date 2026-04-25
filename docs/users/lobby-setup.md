# Lobby setup and history settings

Lobby creators and moderators can configure modded games from **Moderator Game Setup** inside the starting lobby. The panel is visible to everyone, but only the creator and moderators can edit it before the game starts.

## Presets and automation

- **Preset** chooses the standard setup or the Anarchist setup.
- **Auto roles**, **Auto policies**, and **Auto powers** are on by default.
- When an automation group is on, changing the preset refreshes that group from the selected preset.
- Turn an automation group off before making manual overrides you want to keep while switching presets.
- Editing an individual setup field or importing JSON marks the affected setup as manual so those overrides are not silently replaced.

The setup panel keeps the JSON import/export controls for advanced changes such as a custom Fascist power schedule.

## History settings

History controls now live in the same moderator setup panel instead of on the lobby creation screen. They can be changed only before the game starts:

- Show or hide the history panel.
- Show or hide presidential action history.
- Show or hide vote breakdowns.
- Show or hide policy claims.
- Choose all rounds, only the last round, or the last three rounds.

Existing lobby-creation URL query parameters for history settings are still accepted by the backend for compatibility, but the frontend uses the setup panel as the normal editing surface.

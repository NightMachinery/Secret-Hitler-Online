# Anarchist Variant Bot Behavior

This project supports a configurable Anarchist variant in addition to the standard Secret Hitler setup. Standard games remain the default.

## Role and policy basics

- **Anarchist roles** are a third non-Liberal/non-Fascist faction.
- **Anarchist policies** never remain on either policy board.
- When an Anarchist policy is chosen or top-decked, it is counted as an enacted Anarchy policy and the enacted Anarchy card enters the discard pile.
- A fresh Anarchist policy is shuffled into the draw deck, then the election tracker is moved to its top-deck point and the top draw-pile policy is enacted.
- If the forced top-deck is another Anarchist policy, the same rule repeats. Existing tracker-reset setup controls whether the tracker resets after this forced top-deck.
- Cascades are shown in vote history with compact Anarchist/random-card symbols, including repeated Anarchist steps.
- If an Anarchist policy is resolved by the election tracker or by an Anarchist replacement cascade, Anarchists win only when at least one Anarchist player exists.
- If there are no Anarchist players, Anarchist policies are “chaos” policies: they resolve and replace, but they do not produce an Anarchist victory.

## Bot role knowledge

- Standard Fascist/Hitler knowledge is preserved:
  - Fascists know the other hidden Fascist-team roles.
  - Hitler knows Fascists in small games where the standard rules reveal them.
- By default, **Anarchists know each other**. This can be disabled in game setup.
- Anarchist knowledge is separate from Fascist knowledge: Fascist bots do not treat Anarchists as Fascist teammates.
- Investigations reveal Anarchist membership by default. This is configurable.

## Anarchist bot heuristics (v1)

Anarchist bots use lightweight heuristics rather than deep deck counting.

- As President, an Anarchist bot tries to preserve Anarchist policies in the agenda by discarding a non-Anarchist policy when possible.
- As Chancellor, an Anarchist bot prefers enacting an Anarchist policy when one is available.
- In nomination and voting, Anarchist bots use broad tracker-risk behavior and do not calculate exact remaining deck odds.
- Anarchist bots are generally comfortable with unstable governments because election tracker and replacement cascades are their cleanest win paths.

## Non-Anarchist bot treatment of Anarchist policies

Non-Anarchist bots treat Anarchist policies as risky chaos:

- Liberal bots prefer Liberal policies first.
- Fascist bots prefer Fascist policies first.
- Hitler bots may prefer Liberal policies when trying to gain trust unless the Fascist team is near losing.
- Anarchist policies are acceptable when the alternative is an immediately worse faction policy, but they are not treated as direct Liberal/Fascist progress.

## Configurable thresholds

Bot danger checks read the active setup configuration instead of assuming standard 5-Liberal/6-Fascist boards:

- Fascists are considered in danger when Liberals are one policy from the configured Liberal victory threshold.
- Liberals are considered in danger when Fascists are one policy from the configured Fascist victory threshold.
- Hitler election danger uses the configured Fascist-policy threshold.
- Veto behavior also uses the configured final Fascist slot rather than a hardcoded fifth Fascist policy.

## Zero and multiple Hitlers

Custom setup can change Hitler count.

- If there are multiple Hitlers, electing any Hitler as Chancellor after the configured threshold triggers Fascist election victory.
- Liberal execution victory requires the configured number of executed Hitlers.
- If there are zero Hitlers, execution-based Liberal victory is disabled and Fascist election victory cannot occur.

## Custom powers

The setup config can provide a per-Fascist-policy-slot power schedule. Custom thresholds or non-standard Fascist powers render with a generated board on the frontend. Standard-equivalent Liberal/Fascist thresholds and Fascist powers keep the original fixed board art, even when Anarchist roles or Anarchist policies are enabled.

When Anarchist roles or policies are in the setup, the frontend main info panel shows the Anarchist role count, configured Anarchy card count, and a concise `Anarchy Enacted: N` line. The board itself does not show a separate Anarchist summary strip, and standard games hide Anarchy details.

## Frontend art assets

Anarchist-specific frontend art follows the same raster PNG asset convention as the original Liberal/Fascist card art:

- `frontend/src/assets/party-membership-anarchist.png`
- `frontend/src/assets/policy-anarchist.png`
- `frontend/src/assets/role-anarchist.png`
- `frontend/src/assets/victory-anarchist-header.png`

Keep Anarchist imports pointed at these PNGs so the extension art matches the prior card, policy, role, and victory-header assets.

Player cards use `role-anarchist.png` for the on-card Anarchist identity emblem, and all role labels are fitted to the compact bottom identity slot so they stay inside the original card frame.

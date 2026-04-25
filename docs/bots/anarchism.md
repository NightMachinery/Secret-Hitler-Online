# Anarchist Variant Bot Behavior

This project supports a configurable Anarchist variant in addition to the standard Secret Hitler setup. Standard games remain the default.

## Role and policy basics

- **Anarchist roles** are a third non-Liberal/non-Fascist faction.
- **Anarchist policies** never remain on either policy board.
- When an Anarchist policy is chosen or top-decked, it is counted as a resolved Anarchist policy and then replaced by exactly one top-deck policy.
- The replacement count is not configurable. If the replacement is another Anarchist policy, it may cascade under the same one-card replacement rule.
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

The setup config can provide a per-Fascist-policy-slot power schedule. Dynamic/custom boards use that schedule on the backend and render with a generated board on the frontend. Standard-equivalent settings keep the original fixed board art.

# Player Card Text Spacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Improve the player card footer so the player name has more separation from the portrait and the revealed role label is bold, centered, and vertically aligned with its emblem.

**Architecture:** This is a CSS-only layout refinement for the existing `Player` card. The regression coverage stays in `PlayerDisplay.test.tsx`, which already reads `Player.css` to lock card slot positions.

**Tech Stack:** React, Jest, Testing Library, CSS.

---

### Task 1: Lock desired player-card footer CSS

**Files:**
- Modify: `frontend/src/player/PlayerDisplay.test.tsx`
- Modify: `frontend/src/player/Player.css`
- Modify: `docs/superpowers/plans/2026-05-01-player-card-text-spacing.md`

- [x] **Step 1: Write the failing CSS regression test**

Extend `keeps role identity art in a compact bottom slot below the name` in `frontend/src/player/PlayerDisplay.test.tsx` so it expects:

```ts
expect(css).toMatch(/#player-name\s*\{[\s\S]*?top:\s*66%;/);
expect(css).toMatch(/#player-identity-label\s*\{[\s\S]*?top:\s*80%;/);
expect(css).toMatch(/#player-identity-label\s*\{[\s\S]*?height:\s*13%;/);
expect(css).toMatch(/#player-identity-label\s*\{[\s\S]*?font-weight:\s*700;/);
expect(css).toMatch(/#player-identity-label\s*\{[\s\S]*?display:\s*flex;/);
expect(css).toMatch(/#player-identity-label\s*\{[\s\S]*?align-items:\s*center;/);
expect(css).toMatch(/#player-identity-label\s*\{[\s\S]*?justify-content:\s*center;/);
expect(css).toMatch(/#player-identity-label\s*\{[\s\S]*?text-align:\s*center;/);
expect(css).toMatch(/#player-identity-icon\s*\{[\s\S]*?top:\s*80%;/);
```

- [x] **Step 2: Run the targeted test and verify RED**

Run:

```bash
cd frontend && npm test -- --watchAll=false src/player/PlayerDisplay.test.tsx
```

Expected: FAIL because the current CSS still uses `#player-name top: 63%`, `#player-identity-label top: 75%`, no bold/flex centering, and `#player-identity-icon top: 77%`.

- [x] **Step 3: Apply the minimal CSS implementation**

Update `frontend/src/player/Player.css`:

```css
#player-name {
    top: 66%;
}

#player-identity-icon {
    top: 80%;
}

#player-identity-label {
    top: 80%;
    height: 13%;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
}
```

Keep existing declarations not listed here unchanged.

- [x] **Step 4: Run targeted test and verify GREEN**

Run:

```bash
cd frontend && npm test -- --watchAll=false src/player/PlayerDisplay.test.tsx
```

Expected: PASS.

- [x] **Step 5: Run build verification**

Run:

```bash
cd frontend && npm run build
```

Expected: exit code 0.

- [x] **Step 6: Commit and push**

Run:

```bash
git add frontend/src/player/PlayerDisplay.test.tsx frontend/src/player/Player.css docs/superpowers/plans/2026-05-01-player-card-text-spacing.md
git commit -m "Refine player card role footer alignment"
git push
```

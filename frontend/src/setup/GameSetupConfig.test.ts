import {
  applySetupPresetAutomation,
  createAnarchistSetupConfig,
  createStandardSetupConfig,
  parseSetupConfigJson5,
  validateSetupConfig,
} from "./GameSetupConfig";

describe("GameSetupConfig", () => {
  test("standard setup preserves the current role formula and policy deck", () => {
    const config = createStandardSetupConfig(7);
    expect(config.liberalRoles).toBe(4);
    expect(config.fascistRoles).toBe(2);
    expect(config.hitlerRoles).toBe(1);
    expect(config.anarchistRoles).toBe(0);
    expect(config.liberalPolicies).toBe(6);
    expect(config.fascistPolicies).toBe(11);
    expect(config.anarchistPolicies).toBe(0);
    expect(validateSetupConfig(config).valid).toBe(true);
  });

  test("anarchist setup adds one anarchist role and three anarchist policies", () => {
    const config = createAnarchistSetupConfig(7);
    expect(config.liberalRoles).toBe(3);
    expect(config.anarchistRoles).toBe(1);
    expect(config.anarchistPolicies).toBe(3);
    expect(validateSetupConfig(config).valid).toBe(true);
  });

  test("JSON5 parser accepts comments and trailing commas then validates atomically", () => {
    const base = createStandardSetupConfig(7);
    const parsed = parseSetupConfigJson5(
      `{
        // keep current factions but add chaos
        preset: "MANUAL",
        anarchistRoles: 1,
        liberalRoles: 3,
        anarchistPolicies: 3,
      }`,
      base
    );

    expect(parsed.config.anarchistRoles).toBe(1);
    expect(parsed.config.liberalRoles).toBe(3);
    expect(parsed.config.anarchistPolicies).toBe(3);
    expect(parsed.error).toBeUndefined();
  });

  test("JSON5 parser leaves the current config unchanged when a partial import is invalid", () => {
    const base = createStandardSetupConfig(7);
    const parsed = parseSetupConfigJson5(
      `{
        liberalPolicies: 2,
        liberalPoliciesToWin: 5,
      }`,
      base
    );

    expect(parsed.config).toEqual(base);
    expect(parsed.error).toContain("Liberal");
  });

  test("validation rejects decks too small for a legislative draw", () => {
    const config = {
      ...createStandardSetupConfig(6),
      liberalPolicies: 1,
      fascistPolicies: 1,
      anarchistPolicies: 0,
      liberalPoliciesToWin: 1,
      fascistPoliciesToWin: 1,
      hitlerElectionFascistThreshold: 1,
    };

    const result = validateSetupConfig(config);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("deck");
  });

  test("JSON5 parser trims power schedules past the fascist threshold", () => {
    const base = createStandardSetupConfig(7);
    const parsed = parseSetupConfigJson5(
      `{
        preset: "MANUAL",
        fascistPoliciesToWin: 5,
        fascistPowerSchedule: ["NONE", "INVESTIGATE", "ELECTION", "EXECUTION", "EXECUTION", "PEEK"],
      }`,
      base
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.config.fascistPoliciesToWin).toBe(5);
    expect(parsed.config.fascistPowerSchedule).toEqual([
      "NONE",
      "INVESTIGATE",
      "ELECTION",
      "EXECUTION",
      "EXECUTION",
    ]);
  });

  test("Anarchist replacement count is not part of client setup config", () => {
    const base = createAnarchistSetupConfig(7);
    expect((base as any).anarchistReplacementCount).toBeUndefined();

    const parsed = parseSetupConfigJson5(
      `{
        anarchistReplacementCount: 3,
      }`,
      base
    );

    expect(parsed.error).toBeUndefined();
    expect((parsed.config as any).anarchistReplacementCount).toBeUndefined();
  });

  test("preset automation defaults all groups on and applies the selected preset", () => {
    const manual = {
      ...createStandardSetupConfig(7),
      preset: "MANUAL" as const,
      liberalRoles: 2,
      anarchistRoles: 2,
    };

    const next = applySetupPresetAutomation(manual, {
      preset: "ANARCHIST",
      autoRoles: true,
      autoPolicies: true,
      autoPowers: true,
    });

    expect(next.preset).toBe("ANARCHIST");
    expect(next.liberalRoles).toBe(3);
    expect(next.anarchistRoles).toBe(1);
    expect(next.anarchistPolicies).toBe(3);
  });

  test("preset automation preserves manual role overrides when auto roles is off", () => {
    const manual = {
      ...createStandardSetupConfig(7),
      preset: "MANUAL" as const,
      liberalRoles: 2,
      fascistRoles: 2,
      hitlerRoles: 1,
      anarchistRoles: 2,
    };

    const next = applySetupPresetAutomation(manual, {
      preset: "ANARCHIST",
      autoRoles: false,
      autoPolicies: true,
      autoPowers: true,
    });

    expect(next.preset).toBe("MANUAL");
    expect(next.liberalRoles).toBe(2);
    expect(next.anarchistRoles).toBe(2);
    expect(next.anarchistPolicies).toBe(3);
  });

  test("preset automation keeps manual power settings valid when auto roles adds Hitler", () => {
    const manualNoHitler = {
      ...createStandardSetupConfig(7),
      preset: "MANUAL" as const,
      liberalRoles: 5,
      fascistRoles: 2,
      hitlerRoles: 0,
      anarchistRoles: 0,
      requiredExecutedHitlersForLiberalVictory: 0,
    };

    const next = applySetupPresetAutomation(manualNoHitler, {
      preset: "STANDARD",
      autoRoles: true,
      autoPolicies: false,
      autoPowers: false,
    });

    expect(next.hitlerRoles).toBe(1);
    expect(next.requiredExecutedHitlersForLiberalVictory).toBe(1);
    expect(validateSetupConfig(next).valid).toBe(true);
  });
});

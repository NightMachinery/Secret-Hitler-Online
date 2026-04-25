import {
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
});

export type PresetName = "STANDARD" | "ANARCHIST" | "MANUAL";
export type AutomationPresetName = "STANDARD" | "ANARCHIST";

export type SetupAutomationConfig = {
  preset: AutomationPresetName;
  autoRoles: boolean;
  autoPolicies: boolean;
  autoPowers: boolean;
};

export type PresidentialPowerName =
  | "NONE"
  | "PEEK"
  | "INVESTIGATE"
  | "EXECUTION"
  | "ELECTION";

export type GameSetupConfig = {
  preset: PresetName;
  playerCount: number;
  liberalRoles: number;
  fascistRoles: number;
  hitlerRoles: number;
  anarchistRoles: number;
  liberalPolicies: number;
  fascistPolicies: number;
  anarchistPolicies: number;
  liberalPoliciesToWin: number;
  fascistPoliciesToWin: number;
  hitlerElectionFascistThreshold: number;
  requiredExecutedHitlersForLiberalVictory: number;
  anarchistsKnowEachOther: boolean;
  anarchistInvestigationsRevealAnarchist: boolean;
  anarchistPowersEnabled: boolean;
  anarchistTrackerResets: boolean;
  fascistPowerSchedule: PresidentialPowerName[];
};

export type ValidationResult =
  | { valid: true; error?: undefined }
  | { valid: false; error: string };

const NUM_LIBERAL_POLICIES = 6;
const NUM_FASCIST_POLICIES = 11;
const PRESIDENT_DRAW_SIZE = 3;

export const DEFAULT_SETUP_AUTOMATION: SetupAutomationConfig = {
  preset: "STANDARD",
  autoRoles: true,
  autoPolicies: true,
  autoPowers: true,
};

export function normalizeSetupAutomation(
  automation?: Partial<SetupAutomationConfig> | null
): SetupAutomationConfig {
  return {
    preset: automation?.preset === "ANARCHIST" ? "ANARCHIST" : "STANDARD",
    autoRoles:
      typeof automation?.autoRoles === "boolean"
        ? automation.autoRoles
        : DEFAULT_SETUP_AUTOMATION.autoRoles,
    autoPolicies:
      typeof automation?.autoPolicies === "boolean"
        ? automation.autoPolicies
        : DEFAULT_SETUP_AUTOMATION.autoPolicies,
    autoPowers:
      typeof automation?.autoPowers === "boolean"
        ? automation.autoPowers
        : DEFAULT_SETUP_AUTOMATION.autoPowers,
  };
}

export function getDefaultPowerSchedule(playerCount: number): PresidentialPowerName[] {
  const powers: PresidentialPowerName[] = ["NONE", "NONE", "NONE", "NONE", "NONE", "NONE"];
  if (playerCount <= 6) {
    powers[2] = "PEEK";
    powers[3] = "EXECUTION";
    powers[4] = "EXECUTION";
  } else if (playerCount <= 8) {
    powers[1] = "INVESTIGATE";
    powers[2] = "ELECTION";
    powers[3] = "EXECUTION";
    powers[4] = "EXECUTION";
  } else {
    powers[0] = "INVESTIGATE";
    powers[1] = "INVESTIGATE";
    powers[2] = "ELECTION";
    powers[3] = "EXECUTION";
    powers[4] = "EXECUTION";
  }
  return powers;
}

export function createStandardSetupConfig(playerCount: number): GameSetupConfig {
  const totalFascists = Math.floor((playerCount - 1) / 2);
  return {
    preset: "STANDARD",
    playerCount,
    liberalRoles: playerCount - totalFascists,
    fascistRoles: Math.max(0, totalFascists - 1),
    hitlerRoles: totalFascists > 0 ? 1 : 0,
    anarchistRoles: 0,
    liberalPolicies: NUM_LIBERAL_POLICIES,
    fascistPolicies: NUM_FASCIST_POLICIES,
    anarchistPolicies: 0,
    liberalPoliciesToWin: 5,
    fascistPoliciesToWin: 6,
    hitlerElectionFascistThreshold: 3,
    requiredExecutedHitlersForLiberalVictory: totalFascists > 0 ? 1 : 0,
    anarchistsKnowEachOther: true,
    anarchistInvestigationsRevealAnarchist: true,
    anarchistPowersEnabled: true,
    anarchistTrackerResets: true,
    fascistPowerSchedule: getDefaultPowerSchedule(playerCount),
  };
}

export function createAnarchistSetupConfig(playerCount: number): GameSetupConfig {
  const standard = createStandardSetupConfig(playerCount);
  const anarchistRoles = standard.liberalRoles > 0 ? 1 : 0;
  return {
    ...standard,
    preset: "ANARCHIST",
    liberalRoles: standard.liberalRoles - anarchistRoles,
    anarchistRoles,
    anarchistPolicies: 3,
  };
}

function createPresetSetupConfig(
  preset: AutomationPresetName,
  playerCount: number
): GameSetupConfig {
  return preset === "ANARCHIST"
    ? createAnarchistSetupConfig(playerCount)
    : createStandardSetupConfig(playerCount);
}

export function applySetupPresetAutomation(
  currentConfig: GameSetupConfig,
  automationInput: SetupAutomationConfig
): GameSetupConfig {
  const automation = normalizeSetupAutomation(automationInput);
  const presetConfig = createPresetSetupConfig(automation.preset, currentConfig.playerCount);
  const allGroupsAutomated =
    automation.autoRoles && automation.autoPolicies && automation.autoPowers;
  const nextConfig: GameSetupConfig = {
    ...currentConfig,
    preset: allGroupsAutomated ? automation.preset : "MANUAL",
    playerCount: currentConfig.playerCount,
  };

  if (automation.autoRoles) {
    nextConfig.liberalRoles = presetConfig.liberalRoles;
    nextConfig.fascistRoles = presetConfig.fascistRoles;
    nextConfig.hitlerRoles = presetConfig.hitlerRoles;
    nextConfig.anarchistRoles = presetConfig.anarchistRoles;
  }

  if (automation.autoPolicies) {
    nextConfig.liberalPolicies = presetConfig.liberalPolicies;
    nextConfig.fascistPolicies = presetConfig.fascistPolicies;
    nextConfig.anarchistPolicies = presetConfig.anarchistPolicies;
    nextConfig.liberalPoliciesToWin = presetConfig.liberalPoliciesToWin;
    nextConfig.fascistPoliciesToWin = presetConfig.fascistPoliciesToWin;
  }

  if (automation.autoPowers) {
    nextConfig.hitlerElectionFascistThreshold =
      presetConfig.hitlerElectionFascistThreshold;
    nextConfig.requiredExecutedHitlersForLiberalVictory = Math.min(
      presetConfig.requiredExecutedHitlersForLiberalVictory,
      nextConfig.hitlerRoles
    );
    nextConfig.anarchistsKnowEachOther = presetConfig.anarchistsKnowEachOther;
    nextConfig.anarchistInvestigationsRevealAnarchist =
      presetConfig.anarchistInvestigationsRevealAnarchist;
    nextConfig.anarchistPowersEnabled = presetConfig.anarchistPowersEnabled;
    nextConfig.anarchistTrackerResets = presetConfig.anarchistTrackerResets;
    nextConfig.fascistPowerSchedule = presetConfig.fascistPowerSchedule;
  }

  return normalizeSetupConfig(nextConfig);
}

export function validateSetupConfig(config: GameSetupConfig): ValidationResult {
  const roleTotal =
    config.liberalRoles + config.fascistRoles + config.hitlerRoles + config.anarchistRoles;
  if (roleTotal !== config.playerCount) {
    return {
      valid: false,
      error: `Total role count (${roleTotal}) must equal player count (${config.playerCount}).`,
    };
  }
  const numericFields: Array<keyof GameSetupConfig> = [
    "liberalRoles",
    "fascistRoles",
    "hitlerRoles",
    "anarchistRoles",
    "liberalPolicies",
    "fascistPolicies",
    "anarchistPolicies",
  ];
  for (const field of numericFields) {
    if (typeof config[field] === "number" && (config[field] as number) < 0) {
      return { valid: false, error: `${field} cannot be negative.` };
    }
  }
  const policyTotal = config.liberalPolicies + config.fascistPolicies + config.anarchistPolicies;
  if (policyTotal < PRESIDENT_DRAW_SIZE) {
    return {
      valid: false,
      error: `Policy deck must contain at least ${PRESIDENT_DRAW_SIZE} cards.`,
    };
  }
  if (config.liberalPoliciesToWin < 1 || config.liberalPoliciesToWin > config.liberalPolicies) {
    return {
      valid: false,
      error: "Liberal policy victory threshold must be between 1 and the Liberal deck count.",
    };
  }
  if (config.fascistPoliciesToWin < 1 || config.fascistPoliciesToWin > config.fascistPolicies) {
    return {
      valid: false,
      error: "Fascist policy victory threshold must be between 1 and the Fascist deck count.",
    };
  }
  if (
    config.hitlerElectionFascistThreshold < 0 ||
    config.hitlerElectionFascistThreshold > config.fascistPoliciesToWin
  ) {
    return {
      valid: false,
      error: "Hitler election threshold must not exceed the Fascist victory threshold.",
    };
  }
  if (
    config.requiredExecutedHitlersForLiberalVictory < 0 ||
    config.requiredExecutedHitlersForLiberalVictory > config.hitlerRoles
  ) {
    return {
      valid: false,
      error: "Required executed Hitlers must be between 0 and the Hitler role count.",
    };
  }
  if (config.hitlerRoles > 0 && config.requiredExecutedHitlersForLiberalVictory === 0) {
    return {
      valid: false,
      error: "At least one executed Hitler must be required when Hitler roles exist.",
    };
  }
  return { valid: true };
}

export function normalizeSetupConfig(
  config: GameSetupConfig & { anarchistReplacementCount?: number }
): GameSetupConfig {
  const { anarchistReplacementCount, ...withoutReplacementCount } = config;
  const fascistPoliciesToWin = withoutReplacementCount.fascistPoliciesToWin;
  const fascistPowerSchedule = Array.isArray(withoutReplacementCount.fascistPowerSchedule)
    ? withoutReplacementCount.fascistPowerSchedule.slice(0, fascistPoliciesToWin)
    : getDefaultPowerSchedule(withoutReplacementCount.playerCount).slice(0, fascistPoliciesToWin);
  let requiredExecutedHitlersForLiberalVictory =
    withoutReplacementCount.requiredExecutedHitlersForLiberalVictory;
  if (withoutReplacementCount.hitlerRoles === 0) {
    requiredExecutedHitlersForLiberalVictory = 0;
  } else if (requiredExecutedHitlersForLiberalVictory <= 0) {
    requiredExecutedHitlersForLiberalVictory = 1;
  } else {
    requiredExecutedHitlersForLiberalVictory = Math.min(
      requiredExecutedHitlersForLiberalVictory,
      withoutReplacementCount.hitlerRoles
    );
  }
  return {
    ...withoutReplacementCount,
    hitlerElectionFascistThreshold: Math.min(
      Math.max(0, withoutReplacementCount.hitlerElectionFascistThreshold),
      withoutReplacementCount.fascistPoliciesToWin
    ),
    requiredExecutedHitlersForLiberalVictory,
    fascistPowerSchedule,
  };
}

function quoteBareKeys(input: string): string {
  return input.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3');
}

function stripJson5Comments(input: string): string {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function stripTrailingCommas(input: string): string {
  return input.replace(/,\s*([}\]])/g, "$1");
}

export function parseSetupConfigJson5(
  input: string,
  baseConfig: GameSetupConfig
): { config: GameSetupConfig; error?: string } {
  try {
    const normalized = stripTrailingCommas(quoteBareKeys(stripJson5Comments(input)));
    const partial = JSON.parse(normalized);
    const merged: GameSetupConfig = normalizeSetupConfig({
      ...baseConfig,
      ...partial,
      preset: partial.preset || "MANUAL",
      playerCount: baseConfig.playerCount,
    });
    const validation = validateSetupConfig(merged);
    if (!validation.valid) {
      return { config: baseConfig, error: validation.error };
    }
    return { config: merged };
  } catch (error) {
    return {
      config: baseConfig,
      error: error instanceof Error ? error.message : "Could not parse setup JSON.",
    };
  }
}

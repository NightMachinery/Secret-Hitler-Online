package game;

import game.datastructures.board.PresidentialPower;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.Serializable;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Immutable setup settings for standard and custom Secret Hitler variants.
 */
public class GameSetupConfig implements Serializable {
    private static final long serialVersionUID = 680955090301521911L;

    public enum Preset {
        STANDARD,
        ANARCHIST,
        MANUAL
    }

    private final Preset preset;
    private final int playerCount;
    private final int liberalRoleCount;
    private final int fascistRoleCount;
    private final int hitlerRoleCount;
    private final int anarchistRoleCount;
    private final int liberalPolicyCount;
    private final int fascistPolicyCount;
    private final int anarchistPolicyCount;
    private final int liberalPoliciesToWin;
    private final int fascistPoliciesToWin;
    private final int hitlerElectionFascistThreshold;
    private final int requiredExecutedHitlersForLiberalVictory;
    private final boolean anarchistsKnowEachOther;
    private final boolean anarchistInvestigationsRevealAnarchist;
    private final boolean anarchistPowersEnabled;
    private final boolean anarchistTrackerResets;
    private final LinkedHashMap<Integer, PresidentialPower> fascistPowerSchedule;

    private GameSetupConfig(Builder builder) {
        this.preset = builder.preset;
        this.playerCount = builder.playerCount;
        this.liberalRoleCount = builder.liberalRoleCount;
        this.fascistRoleCount = builder.fascistRoleCount;
        this.hitlerRoleCount = builder.hitlerRoleCount;
        this.anarchistRoleCount = builder.anarchistRoleCount;
        this.liberalPolicyCount = builder.liberalPolicyCount;
        this.fascistPolicyCount = builder.fascistPolicyCount;
        this.anarchistPolicyCount = builder.anarchistPolicyCount;
        this.liberalPoliciesToWin = builder.liberalPoliciesToWin;
        this.fascistPoliciesToWin = builder.fascistPoliciesToWin;
        this.hitlerElectionFascistThreshold = builder.hitlerElectionFascistThreshold;
        this.requiredExecutedHitlersForLiberalVictory = builder.requiredExecutedHitlersForLiberalVictory;
        this.anarchistsKnowEachOther = builder.anarchistsKnowEachOther;
        this.anarchistInvestigationsRevealAnarchist = builder.anarchistInvestigationsRevealAnarchist;
        this.anarchistPowersEnabled = builder.anarchistPowersEnabled;
        this.anarchistTrackerResets = builder.anarchistTrackerResets;
        this.fascistPowerSchedule = new LinkedHashMap<>(builder.fascistPowerSchedule);
        validate();
    }

    public static GameSetupConfig standard(int playerCount) {
        int totalFascists = (playerCount - 1) / 2;
        return builder(playerCount)
                .preset(Preset.STANDARD)
                .roles(playerCount - totalFascists, Math.max(0, totalFascists - 1), totalFascists > 0 ? 1 : 0, 0)
                .policies(SecretHitlerGame.NUM_LIBERAL_POLICIES, SecretHitlerGame.NUM_FASCIST_POLICIES, 0)
                .build();
    }

    public static GameSetupConfig anarchist(int playerCount) {
        GameSetupConfig standard = standard(playerCount);
        int anarchists = standard.liberalRoleCount > 0 ? 1 : 0;
        return builder(playerCount)
                .preset(Preset.ANARCHIST)
                .roles(standard.liberalRoleCount - anarchists, standard.fascistRoleCount, standard.hitlerRoleCount,
                        anarchists)
                .policies(SecretHitlerGame.NUM_LIBERAL_POLICIES, SecretHitlerGame.NUM_FASCIST_POLICIES, 3)
                .build();
    }

    public static Builder builder(int playerCount) {
        return new Builder(playerCount);
    }

    public Builder toBuilder() {
        Builder builder = new Builder(playerCount)
                .preset(preset)
                .roles(liberalRoleCount, fascistRoleCount, hitlerRoleCount, anarchistRoleCount)
                .policies(liberalPolicyCount, fascistPolicyCount, anarchistPolicyCount)
                .liberalPoliciesToWin(liberalPoliciesToWin)
                .fascistPoliciesToWin(fascistPoliciesToWin)
                .hitlerElectionFascistThreshold(hitlerElectionFascistThreshold)
                .requiredExecutedHitlersForLiberalVictory(requiredExecutedHitlersForLiberalVictory)
                .anarchistsKnowEachOther(anarchistsKnowEachOther)
                .anarchistInvestigationsRevealAnarchist(anarchistInvestigationsRevealAnarchist)
                .anarchistPowersEnabled(anarchistPowersEnabled)
                .anarchistTrackerResets(anarchistTrackerResets);
        builder.fascistPowerSchedule.clear();
        builder.fascistPowerSchedule.putAll(fascistPowerSchedule);
        return builder;
    }

    public GameSetupConfig withPlayerCount(int newPlayerCount) {
        if (isStandardPreset()) {
            return standard(newPlayerCount);
        }
        if (isAnarchistPreset()) {
            return anarchist(newPlayerCount);
        }
        int liberal = liberalRoleCount;
        int fascist = fascistRoleCount;
        int hitler = hitlerRoleCount;
        int anarchist = anarchistRoleCount;
        int totalRoles = liberal + fascist + hitler + anarchist;
        int delta = newPlayerCount - totalRoles;
        if (delta > 0) {
            liberal += delta;
        } else if (delta < 0) {
            int remaining = -delta;
            int removed = Math.min(liberal, remaining);
            liberal -= removed;
            remaining -= removed;

            removed = Math.min(anarchist, remaining);
            anarchist -= removed;
            remaining -= removed;

            removed = Math.min(fascist, remaining);
            fascist -= removed;
            remaining -= removed;

            removed = Math.min(hitler, remaining);
            hitler -= removed;
        }
        return toBuilder()
                .playerCount(newPlayerCount)
                .roles(liberal, fascist, hitler, anarchist)
                .build();
    }

    private void validate() {
        if (playerCount < SecretHitlerGame.MIN_PLAYERS || playerCount > SecretHitlerGame.MAX_PLAYERS) {
            throw new IllegalArgumentException("Player count must be between " + SecretHitlerGame.MIN_PLAYERS
                    + " and " + SecretHitlerGame.MAX_PLAYERS + ".");
        }
        if (liberalRoleCount < 0 || fascistRoleCount < 0 || hitlerRoleCount < 0 || anarchistRoleCount < 0) {
            throw new IllegalArgumentException("Role counts cannot be negative.");
        }
        int totalRoles = liberalRoleCount + fascistRoleCount + hitlerRoleCount + anarchistRoleCount;
        if (totalRoles != playerCount) {
            throw new IllegalArgumentException("Total role count (" + totalRoles + ") must equal player count ("
                    + playerCount + ").");
        }
        if (liberalPolicyCount < 0 || fascistPolicyCount < 0 || anarchistPolicyCount < 0) {
            throw new IllegalArgumentException("Policy counts cannot be negative.");
        }
        int totalPolicies = liberalPolicyCount + fascistPolicyCount + anarchistPolicyCount;
        if (totalPolicies < SecretHitlerGame.PRESIDENT_DRAW_SIZE) {
            throw new IllegalArgumentException("Policy deck must contain at least "
                    + SecretHitlerGame.PRESIDENT_DRAW_SIZE + " cards.");
        }
        if (liberalPoliciesToWin <= 0 || liberalPoliciesToWin > liberalPolicyCount) {
            throw new IllegalArgumentException("Liberal policy victory threshold must be between 1 and the Liberal deck count.");
        }
        if (fascistPoliciesToWin <= 0 || fascistPoliciesToWin > fascistPolicyCount) {
            throw new IllegalArgumentException("Fascist policy victory threshold must be between 1 and the Fascist deck count.");
        }
        if (hitlerElectionFascistThreshold < 0 || hitlerElectionFascistThreshold > fascistPoliciesToWin) {
            throw new IllegalArgumentException("Hitler election threshold must be between 0 and the Fascist victory threshold.");
        }
        if (requiredExecutedHitlersForLiberalVictory < 0
                || requiredExecutedHitlersForLiberalVictory > hitlerRoleCount) {
            throw new IllegalArgumentException("Required executed Hitlers must be between 0 and the Hitler role count.");
        }
        if (hitlerRoleCount > 0 && requiredExecutedHitlersForLiberalVictory == 0) {
            throw new IllegalArgumentException("At least one executed Hitler must be required when Hitler roles exist.");
        }
        for (Map.Entry<Integer, PresidentialPower> entry : fascistPowerSchedule.entrySet()) {
            if (entry.getKey() == null || entry.getKey() < 1 || entry.getKey() > fascistPoliciesToWin) {
                throw new IllegalArgumentException("Fascist power slots must be within the Fascist board.");
            }
            if (entry.getValue() == null) {
                throw new IllegalArgumentException("Fascist power cannot be null.");
            }
        }
    }

    public JSONObject toJson() {
        JSONObject out = new JSONObject();
        out.put("preset", preset.toString());
        out.put("playerCount", playerCount);
        out.put("liberalRoles", liberalRoleCount);
        out.put("fascistRoles", fascistRoleCount);
        out.put("hitlerRoles", hitlerRoleCount);
        out.put("anarchistRoles", anarchistRoleCount);
        out.put("liberalPolicies", liberalPolicyCount);
        out.put("fascistPolicies", fascistPolicyCount);
        out.put("anarchistPolicies", anarchistPolicyCount);
        out.put("liberalPoliciesToWin", liberalPoliciesToWin);
        out.put("fascistPoliciesToWin", fascistPoliciesToWin);
        out.put("hitlerElectionFascistThreshold", hitlerElectionFascistThreshold);
        out.put("requiredExecutedHitlersForLiberalVictory", requiredExecutedHitlersForLiberalVictory);
        out.put("anarchistsKnowEachOther", anarchistsKnowEachOther);
        out.put("anarchistInvestigationsRevealAnarchist", anarchistInvestigationsRevealAnarchist);
        out.put("anarchistPowersEnabled", anarchistPowersEnabled);
        out.put("anarchistTrackerResets", anarchistTrackerResets);
        JSONArray powers = new JSONArray();
        for (int i = 1; i <= fascistPoliciesToWin; i++) {
            powers.put(fascistPowerSchedule.getOrDefault(i, PresidentialPower.NONE).toString());
        }
        out.put("fascistPowerSchedule", powers);
        return out;
    }

    public static GameSetupConfig fromJson(JSONObject json, int playerCount, GameSetupConfig base) {
        if (json == null) {
            return base == null ? standard(playerCount) : base.withPlayerCount(playerCount);
        }
        String presetName = json.optString("preset", "").trim().toUpperCase();
        GameSetupConfig seed;
        if ("ANARCHIST".equals(presetName)) {
            seed = anarchist(playerCount);
        } else if ("STANDARD".equals(presetName)) {
            seed = standard(playerCount);
        } else {
            seed = base == null ? standard(playerCount) : base.withPlayerCount(playerCount);
        }

        Builder builder = seed.toBuilder().preset("MANUAL".equals(presetName) ? Preset.MANUAL : seed.preset)
                .playerCount(playerCount);
        builder.roles(
                json.optInt("liberalRoles", seed.liberalRoleCount),
                json.optInt("fascistRoles", seed.fascistRoleCount),
                json.optInt("hitlerRoles", seed.hitlerRoleCount),
                json.optInt("anarchistRoles", seed.anarchistRoleCount));
        builder.policies(
                json.optInt("liberalPolicies", seed.liberalPolicyCount),
                json.optInt("fascistPolicies", seed.fascistPolicyCount),
                json.optInt("anarchistPolicies", seed.anarchistPolicyCount));
        builder.liberalPoliciesToWin(json.optInt("liberalPoliciesToWin", seed.liberalPoliciesToWin));
        builder.fascistPoliciesToWin(json.optInt("fascistPoliciesToWin", seed.fascistPoliciesToWin));
        builder.hitlerElectionFascistThreshold(
                json.optInt("hitlerElectionFascistThreshold", seed.hitlerElectionFascistThreshold));
        builder.requiredExecutedHitlersForLiberalVictory(json.optInt("requiredExecutedHitlersForLiberalVictory",
                seed.requiredExecutedHitlersForLiberalVictory));
        builder.anarchistsKnowEachOther(json.optBoolean("anarchistsKnowEachOther", seed.anarchistsKnowEachOther));
        builder.anarchistInvestigationsRevealAnarchist(json.optBoolean("anarchistInvestigationsRevealAnarchist",
                seed.anarchistInvestigationsRevealAnarchist));
        builder.anarchistPowersEnabled(json.optBoolean("anarchistPowersEnabled", seed.anarchistPowersEnabled));
        builder.anarchistTrackerResets(json.optBoolean("anarchistTrackerResets", seed.anarchistTrackerResets));
        if (json.has("fascistPowerSchedule")) {
            builder.clearFascistPowerSchedule();
            JSONArray powers = json.getJSONArray("fascistPowerSchedule");
            for (int i = 0; i < powers.length() && i < builder.fascistPoliciesToWin; i++) {
                builder.powerAt(i + 1, PresidentialPower.valueOf(powers.getString(i).trim().toUpperCase()));
            }
        }
        return builder.build();
    }

    public boolean isStandardPreset() {
        return preset == Preset.STANDARD;
    }

    public boolean isAnarchistPreset() {
        return preset == Preset.ANARCHIST;
    }

    public Preset getPreset() { return preset; }

    public GameSetupConfig withPresetAutomation(Preset selectedPreset, boolean autoRoles, boolean autoPolicies,
            boolean autoPowers) {
        Preset effectivePreset = selectedPreset == Preset.ANARCHIST ? Preset.ANARCHIST : Preset.STANDARD;
        GameSetupConfig presetConfig = effectivePreset == Preset.ANARCHIST
                ? anarchist(playerCount)
                : standard(playerCount);
        boolean allGroupsAutomated = autoRoles && autoPolicies && autoPowers;

        Builder builder = toBuilder().preset(allGroupsAutomated ? effectivePreset : Preset.MANUAL);
        if (autoRoles) {
            builder.roles(presetConfig.liberalRoleCount, presetConfig.fascistRoleCount, presetConfig.hitlerRoleCount,
                    presetConfig.anarchistRoleCount);
        }
        if (autoPolicies) {
            builder.policies(presetConfig.liberalPolicyCount, presetConfig.fascistPolicyCount,
                    presetConfig.anarchistPolicyCount);
            builder.liberalPoliciesToWin(presetConfig.liberalPoliciesToWin);
            builder.fascistPoliciesToWin(presetConfig.fascistPoliciesToWin);
        }
        if (autoPowers) {
            builder.hitlerElectionFascistThreshold(presetConfig.hitlerElectionFascistThreshold);
            builder.requiredExecutedHitlersForLiberalVictory(Math.min(
                    presetConfig.requiredExecutedHitlersForLiberalVictory,
                    builder.hitlerRoleCount));
            builder.anarchistsKnowEachOther(presetConfig.anarchistsKnowEachOther);
            builder.anarchistInvestigationsRevealAnarchist(presetConfig.anarchistInvestigationsRevealAnarchist);
            builder.anarchistPowersEnabled(presetConfig.anarchistPowersEnabled);
            builder.anarchistTrackerResets(presetConfig.anarchistTrackerResets);
            builder.clearFascistPowerSchedule();
            for (Map.Entry<Integer, PresidentialPower> entry : presetConfig.fascistPowerSchedule.entrySet()) {
                if (entry.getKey() <= builder.fascistPoliciesToWin) {
                    builder.powerAt(entry.getKey(), entry.getValue());
                }
            }
        }
        normalizeBuilderForValidation(builder);
        return builder.build();
    }

    private static void normalizeBuilderForValidation(Builder builder) {
        builder.hitlerElectionFascistThreshold = Math.min(
                Math.max(0, builder.hitlerElectionFascistThreshold),
                builder.fascistPoliciesToWin);

        if (builder.hitlerRoleCount == 0) {
            builder.requiredExecutedHitlersForLiberalVictory = 0;
        } else if (builder.requiredExecutedHitlersForLiberalVictory <= 0) {
            builder.requiredExecutedHitlersForLiberalVictory = 1;
        } else if (builder.requiredExecutedHitlersForLiberalVictory > builder.hitlerRoleCount) {
            builder.requiredExecutedHitlersForLiberalVictory = builder.hitlerRoleCount;
        }

        builder.fascistPowerSchedule.entrySet().removeIf(entry ->
                entry.getKey() == null || entry.getKey() < 1 || entry.getKey() > builder.fascistPoliciesToWin);
    }

    public boolean isStandardEquivalent(int players) {
        GameSetupConfig standard = standard(players);
        return playerCount == players
                && liberalRoleCount == standard.liberalRoleCount
                && fascistRoleCount == standard.fascistRoleCount
                && hitlerRoleCount == standard.hitlerRoleCount
                && anarchistRoleCount == 0
                && liberalPolicyCount == SecretHitlerGame.NUM_LIBERAL_POLICIES
                && fascistPolicyCount == SecretHitlerGame.NUM_FASCIST_POLICIES
                && anarchistPolicyCount == 0
                && liberalPoliciesToWin == 5
                && fascistPoliciesToWin == 6
                && hitlerElectionFascistThreshold == 3
                && fascistPowerSchedule.equals(defaultPowerSchedule(players));
    }

    public int getPlayerCount() { return playerCount; }
    public int getLiberalRoleCount() { return liberalRoleCount; }
    public int getFascistRoleCount() { return fascistRoleCount; }
    public int getHitlerRoleCount() { return hitlerRoleCount; }
    public int getAnarchistRoleCount() { return anarchistRoleCount; }
    public int getLiberalPolicyCount() { return liberalPolicyCount; }
    public int getFascistPolicyCount() { return fascistPolicyCount; }
    public int getAnarchistPolicyCount() { return anarchistPolicyCount; }
    public int getLiberalPoliciesToWin() { return liberalPoliciesToWin; }
    public int getFascistPoliciesToWin() { return fascistPoliciesToWin; }
    public int getHitlerElectionFascistThreshold() { return hitlerElectionFascistThreshold; }
    public int getRequiredExecutedHitlersForLiberalVictory() { return requiredExecutedHitlersForLiberalVictory; }
    public boolean doAnarchistsKnowEachOther() { return anarchistsKnowEachOther; }
    public boolean doAnarchistInvestigationsRevealAnarchist() { return anarchistInvestigationsRevealAnarchist; }
    public boolean areAnarchistPowersEnabled() { return anarchistPowersEnabled; }
    public boolean doesAnarchistTrackerReset() { return anarchistTrackerResets; }
    public Map<Integer, PresidentialPower> getFascistPowerSchedule() { return new LinkedHashMap<>(fascistPowerSchedule); }

    static LinkedHashMap<Integer, PresidentialPower> defaultPowerSchedule(int playerCount) {
        LinkedHashMap<Integer, PresidentialPower> powers = new LinkedHashMap<>();
        for (int i = 1; i <= 6; i++) {
            powers.put(i, PresidentialPower.NONE);
        }
        if (playerCount <= 6) {
            powers.put(3, PresidentialPower.PEEK);
            powers.put(4, PresidentialPower.EXECUTION);
            powers.put(5, PresidentialPower.EXECUTION);
        } else if (playerCount <= 8) {
            powers.put(2, PresidentialPower.INVESTIGATE);
            powers.put(3, PresidentialPower.ELECTION);
            powers.put(4, PresidentialPower.EXECUTION);
            powers.put(5, PresidentialPower.EXECUTION);
        } else {
            powers.put(1, PresidentialPower.INVESTIGATE);
            powers.put(2, PresidentialPower.INVESTIGATE);
            powers.put(3, PresidentialPower.ELECTION);
            powers.put(4, PresidentialPower.EXECUTION);
            powers.put(5, PresidentialPower.EXECUTION);
        }
        return powers;
    }

    public static class Builder {
        private Preset preset = Preset.MANUAL;
        private int playerCount;
        private int liberalRoleCount;
        private int fascistRoleCount;
        private int hitlerRoleCount;
        private int anarchistRoleCount;
        private int liberalPolicyCount = SecretHitlerGame.NUM_LIBERAL_POLICIES;
        private int fascistPolicyCount = SecretHitlerGame.NUM_FASCIST_POLICIES;
        private int anarchistPolicyCount = 0;
        private int liberalPoliciesToWin = 5;
        private int fascistPoliciesToWin = 6;
        private int hitlerElectionFascistThreshold = 3;
        private int requiredExecutedHitlersForLiberalVictory = 1;
        private boolean anarchistsKnowEachOther = true;
        private boolean anarchistInvestigationsRevealAnarchist = true;
        private boolean anarchistPowersEnabled = true;
        private boolean anarchistTrackerResets = true;
        private LinkedHashMap<Integer, PresidentialPower> fascistPowerSchedule;

        private Builder(int playerCount) {
            this.playerCount = playerCount;
            int totalFascists = (playerCount - 1) / 2;
            this.hitlerRoleCount = totalFascists > 0 ? 1 : 0;
            this.fascistRoleCount = Math.max(0, totalFascists - hitlerRoleCount);
            this.liberalRoleCount = playerCount - totalFascists;
            this.anarchistRoleCount = 0;
            this.fascistPowerSchedule = defaultPowerSchedule(playerCount);
        }

        public Builder preset(Preset preset) {
            this.preset = preset == null ? Preset.MANUAL : preset;
            return this;
        }

        public Builder playerCount(int playerCount) {
            this.playerCount = playerCount;
            return this;
        }

        public Builder roles(int liberal, int fascist, int hitler, int anarchist) {
            this.liberalRoleCount = liberal;
            this.fascistRoleCount = fascist;
            this.hitlerRoleCount = hitler;
            this.anarchistRoleCount = anarchist;
            if (requiredExecutedHitlersForLiberalVictory > hitler) {
                requiredExecutedHitlersForLiberalVictory = Math.max(0, hitler);
            }
            if (hitler == 0) {
                requiredExecutedHitlersForLiberalVictory = 0;
            } else if (requiredExecutedHitlersForLiberalVictory == 0) {
                requiredExecutedHitlersForLiberalVictory = 1;
            }
            return this;
        }

        public Builder policies(int liberal, int fascist, int anarchist) {
            this.liberalPolicyCount = liberal;
            this.fascistPolicyCount = fascist;
            this.anarchistPolicyCount = anarchist;
            return this;
        }

        public Builder liberalPoliciesToWin(int value) { this.liberalPoliciesToWin = value; return this; }
        public Builder fascistPoliciesToWin(int value) {
            this.fascistPoliciesToWin = value;
            fascistPowerSchedule.entrySet().removeIf(entry -> entry.getKey() != null && entry.getKey() > value);
            return this;
        }
        public Builder hitlerElectionFascistThreshold(int value) { this.hitlerElectionFascistThreshold = value; return this; }
        public Builder requiredExecutedHitlersForLiberalVictory(int value) { this.requiredExecutedHitlersForLiberalVictory = value; return this; }
        public Builder anarchistsKnowEachOther(boolean value) { this.anarchistsKnowEachOther = value; return this; }
        public Builder anarchistInvestigationsRevealAnarchist(boolean value) { this.anarchistInvestigationsRevealAnarchist = value; return this; }
        public Builder anarchistPowersEnabled(boolean value) { this.anarchistPowersEnabled = value; return this; }
        public Builder anarchistTrackerResets(boolean value) { this.anarchistTrackerResets = value; return this; }

        public Builder clearFascistPowerSchedule() {
            this.fascistPowerSchedule.clear();
            return this;
        }

        public Builder powerAt(int slot, PresidentialPower power) {
            this.fascistPowerSchedule.put(slot, power == null ? PresidentialPower.NONE : power);
            return this;
        }

        public GameSetupConfig build() {
            return new GameSetupConfig(this);
        }
    }
}

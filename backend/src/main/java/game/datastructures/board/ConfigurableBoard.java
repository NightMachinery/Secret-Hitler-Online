package game.datastructures.board;

import game.GameSetupConfig;

/**
 * Board driven entirely by GameSetupConfig thresholds and power schedule.
 */
public class ConfigurableBoard extends Board {
    public ConfigurableBoard(GameSetupConfig config) {
        super(config.getFascistPoliciesToWin(),
                config.getLiberalPoliciesToWin(),
                config.getHitlerElectionFascistThreshold(),
                config.getFascistPowerSchedule());
    }
}

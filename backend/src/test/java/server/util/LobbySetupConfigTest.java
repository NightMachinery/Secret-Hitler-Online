package server.util;

import game.GameSetupConfig;
import game.SecretHitlerGame;
import org.junit.Test;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;

import static junit.framework.TestCase.assertEquals;
import static junit.framework.TestCase.assertFalse;
import static junit.framework.TestCase.assertTrue;
import static org.junit.Assert.fail;

public class LobbySetupConfigTest {

    private ArrayList<String> makePlayers(int numPlayers) {
        ArrayList<String> out = new ArrayList<>();
        for (int i = 0; i < numPlayers; i++) {
            out.add(Integer.toString(i));
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private List<String> getLobbyUsernames(Lobby lobby) throws Exception {
        Field field = Lobby.class.getDeclaredField("lobbyUsernames");
        field.setAccessible(true);
        return (List<String>) field.get(lobby);
    }

    private void setGame(Lobby lobby, SecretHitlerGame game) throws Exception {
        Field gameField = Lobby.class.getDeclaredField("game");
        gameField.setAccessible(true);
        gameField.set(lobby, game);
    }

    @Test
    public void testSetupAutomationDefaultsOnWithStandardPreset() {
        Lobby.SetupAutomationConfig automation = new Lobby().getSetupAutomationConfig();

        assertEquals(GameSetupConfig.Preset.STANDARD, automation.getPreset());
        assertTrue(automation.shouldAutoRoles());
        assertTrue(automation.shouldAutoPolicies());
        assertTrue(automation.shouldAutoPowers());
    }

    @Test
    public void testHistoryConfigUpdatesOnlyBeforeGameStarts() throws Exception {
        Lobby lobby = new Lobby();
        Lobby.HistoryDisplayConfig hiddenHistory = new Lobby.HistoryDisplayConfig(
                false,
                true,
                true,
                Lobby.HistoryDisplayConfig.RoundsToShow.ALL,
                true);

        lobby.setHistoryDisplayConfig(hiddenHistory);
        assertFalse(lobby.getHistoryDisplayConfig().shouldShowHistory());

        setGame(lobby, new SecretHitlerGame(makePlayers(5)));

        try {
            lobby.setHistoryDisplayConfig(Lobby.HistoryDisplayConfig.defaultConfig());
            fail("Expected history config changes to be rejected after game start.");
        } catch (IllegalStateException ignored) {
        }
    }

    @Test
    public void testSetupAutomationAppliesSelectedPresetWhenGroupsAreOn() throws Exception {
        Lobby lobby = new Lobby();
        getLobbyUsernames(lobby).addAll(makePlayers(7));

        lobby.setGameSetupConfig(
                GameSetupConfig.standard(7),
                new Lobby.SetupAutomationConfig(GameSetupConfig.Preset.ANARCHIST, true, true, true));

        GameSetupConfig config = lobby.getGameSetupConfig();
        assertEquals(GameSetupConfig.Preset.ANARCHIST, config.getPreset());
        assertEquals(1, config.getAnarchistRoleCount());
        assertEquals(3, config.getAnarchistPolicyCount());
    }

    @Test
    public void testManualRoleOverridesPersistWhenAutoRolesIsOff() throws Exception {
        Lobby lobby = new Lobby();
        getLobbyUsernames(lobby).addAll(makePlayers(7));
        GameSetupConfig manualRoles = GameSetupConfig.standard(7)
                .toBuilder()
                .preset(GameSetupConfig.Preset.MANUAL)
                .roles(2, 2, 1, 2)
                .build();

        lobby.setGameSetupConfig(
                manualRoles,
                new Lobby.SetupAutomationConfig(GameSetupConfig.Preset.ANARCHIST, false, true, true));

        GameSetupConfig config = lobby.getGameSetupConfig();
        assertEquals(GameSetupConfig.Preset.MANUAL, config.getPreset());
        assertEquals(2, config.getLiberalRoleCount());
        assertEquals(2, config.getAnarchistRoleCount());
        assertEquals(3, config.getAnarchistPolicyCount());
    }

    @Test
    public void testLegacyManualSetupWithoutAutomationKeepsManualOverrides() throws Exception {
        Lobby lobby = new Lobby();
        getLobbyUsernames(lobby).addAll(makePlayers(7));
        GameSetupConfig manualNoHitler = GameSetupConfig.standard(7)
                .toBuilder()
                .preset(GameSetupConfig.Preset.MANUAL)
                .roles(5, 2, 0, 0)
                .requiredExecutedHitlersForLiberalVictory(0)
                .build();

        lobby.setGameSetupConfig(manualNoHitler);

        GameSetupConfig config = lobby.getGameSetupConfig();
        assertEquals(GameSetupConfig.Preset.MANUAL, config.getPreset());
        assertEquals(5, config.getLiberalRoleCount());
        assertEquals(0, config.getHitlerRoleCount());
        assertEquals(0, config.getRequiredExecutedHitlersForLiberalVictory());
    }

    @Test
    public void testAutoRolesKeepsManualPowersValidWhenAddingHitlerRole() throws Exception {
        Lobby lobby = new Lobby();
        getLobbyUsernames(lobby).addAll(makePlayers(7));
        GameSetupConfig manualNoHitler = GameSetupConfig.standard(7)
                .toBuilder()
                .preset(GameSetupConfig.Preset.MANUAL)
                .roles(5, 2, 0, 0)
                .requiredExecutedHitlersForLiberalVictory(0)
                .build();

        lobby.setGameSetupConfig(
                manualNoHitler,
                new Lobby.SetupAutomationConfig(GameSetupConfig.Preset.STANDARD, true, false, false));

        GameSetupConfig config = lobby.getGameSetupConfig();
        assertEquals(GameSetupConfig.Preset.MANUAL, config.getPreset());
        assertEquals(1, config.getHitlerRoleCount());
        assertEquals(1, config.getRequiredExecutedHitlersForLiberalVictory());
    }
}

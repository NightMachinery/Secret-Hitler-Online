package game;

import game.datastructures.Deck;
import game.datastructures.Identity;
import game.datastructures.Player;
import game.datastructures.Policy;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;

import static junit.framework.TestCase.*;

public class testAnarchistVariant {

    private ArrayList<String> makePlayers(int numPlayers) {
        ArrayList<String> out = new ArrayList<>();
        for (int i = 0; i < numPlayers; i++) {
            out.add(Integer.toString(i));
        }
        return out;
    }

    private int countIdentity(SecretHitlerGame game, Identity identity) {
        int count = 0;
        for (Player player : game.getPlayerList()) {
            if (player.getIdentity() == identity) {
                count++;
            }
        }
        return count;
    }

    private void replaceDrawDeck(SecretHitlerGame game, Policy.Type... topToBottom) throws Exception {
        Deck deck = new Deck();
        for (int i = topToBottom.length - 1; i >= 0; i--) {
            deck.add(new Policy(topToBottom[i]));
        }
        Field drawField = SecretHitlerGame.class.getDeclaredField("draw");
        drawField.setAccessible(true);
        drawField.set(game, deck);
    }

    private void forceState(SecretHitlerGame game, GameState state) throws Exception {
        Field stateField = SecretHitlerGame.class.getDeclaredField("state");
        stateField.setAccessible(true);
        stateField.set(game, state);
    }

    private void failVote(SecretHitlerGame game, String chancellor) {
        game.nominateChancellor(chancellor);
        for (Player player : game.getPlayerList()) {
            if (player.isAlive()) {
                game.registerVote(player.getUsername(), false);
            }
        }
    }

    private void passVote(SecretHitlerGame game, String chancellor) {
        game.nominateChancellor(chancellor);
        for (Player player : game.getPlayerList()) {
            if (player.isAlive()) {
                game.registerVote(player.getUsername(), true);
            }
        }
    }

    @Test
    public void testStandardPresetMatchesExistingRoleFormulaAndDeckCounts() {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(7), GameSetupConfig.standard(7));

        assertEquals(SecretHitlerGame.NUM_FASCIST_POLICIES + SecretHitlerGame.NUM_LIBERAL_POLICIES,
                game.getDrawSize());
        assertEquals(0, countIdentity(game, Identity.ANARCHIST));
        assertEquals(1, countIdentity(game, Identity.HITLER));
        assertEquals(2, countIdentity(game, Identity.FASCIST));
        assertEquals(4, countIdentity(game, Identity.LIBERAL));
        assertTrue(game.getSetupConfig().isStandardEquivalent(7));
    }

    @Test
    public void testAnarchistPresetAddsOneAnarchistRoleAndThreeAnarchistPolicies() {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(7), GameSetupConfig.anarchist(7));

        assertEquals(1, countIdentity(game, Identity.ANARCHIST));
        assertEquals(1, countIdentity(game, Identity.HITLER));
        assertEquals(2, countIdentity(game, Identity.FASCIST));
        assertEquals(3, countIdentity(game, Identity.LIBERAL));
        assertEquals(SecretHitlerGame.NUM_FASCIST_POLICIES + SecretHitlerGame.NUM_LIBERAL_POLICIES + 3,
                game.getDrawSize());
        assertEquals(3, game.getSetupConfig().getAnarchistPolicyCount());
    }

    @Test
    public void testValidationRejectsImpossibleCountsAndThresholds() {
        try {
            GameSetupConfig.builder(6)
                    .roles(3, 1, 1, 1)
                    .policies(2, 2, 0)
                    .liberalPoliciesToWin(3)
                    .build();
            fail("Expected validation to reject a Liberal threshold above the Liberal policy deck count.");
        } catch (IllegalArgumentException expected) {
            assertTrue(expected.getMessage().contains("Liberal"));
        }

        try {
            GameSetupConfig.builder(6)
                    .roles(1, 1, 1, 1)
                    .policies(3, 3, 0)
                    .build();
            fail("Expected validation to reject role counts that do not match player count.");
        } catch (IllegalArgumentException expected) {
            assertTrue(expected.getMessage().contains("role"));
        }
    }

    @Test
    public void testValidationRejectsDecksTooSmallForLegislativeDraw() {
        try {
            GameSetupConfig.builder(6)
                    .roles(3, 1, 1, 1)
                    .policies(1, 1, 0)
                    .liberalPoliciesToWin(1)
                    .fascistPoliciesToWin(1)
                    .hitlerElectionFascistThreshold(1)
                    .build();
            fail("Expected validation to reject policy decks with fewer than three total cards.");
        } catch (IllegalArgumentException expected) {
            assertTrue(expected.getMessage().contains("deck"));
        }
    }

    @Test
    public void testManualSetupResyncsRoleTotalsWhenPlayerCountChanges() {
        GameSetupConfig sixPlayerManual = GameSetupConfig.builder(6)
                .roles(3, 1, 1, 1)
                .policies(6, 11, 3)
                .build();

        GameSetupConfig sevenPlayerManual = sixPlayerManual.withPlayerCount(7);

        assertEquals(7, sevenPlayerManual.getPlayerCount());
        assertEquals(7, sevenPlayerManual.getLiberalRoleCount()
                + sevenPlayerManual.getFascistRoleCount()
                + sevenPlayerManual.getHitlerRoleCount()
                + sevenPlayerManual.getAnarchistRoleCount());
        assertEquals(4, sevenPlayerManual.getLiberalRoleCount());
        assertEquals(1, sevenPlayerManual.getFascistRoleCount());
        assertEquals(1, sevenPlayerManual.getHitlerRoleCount());
        assertEquals(1, sevenPlayerManual.getAnarchistRoleCount());
    }

    @Test
    public void testFromJsonTrimsPowerScheduleWhenFascistThresholdShrinks() {
        JSONObject json = GameSetupConfig.standard(7).toJson();
        json.put("preset", "MANUAL");
        json.put("fascistPoliciesToWin", 5);
        json.put("hitlerElectionFascistThreshold", 3);
        json.put("fascistPowerSchedule", new JSONArray()
                .put("NONE")
                .put("INVESTIGATE")
                .put("ELECTION")
                .put("EXECUTION")
                .put("EXECUTION")
                .put("PEEK"));

        GameSetupConfig config = GameSetupConfig.fromJson(json, 7, GameSetupConfig.standard(7));

        assertEquals(5, config.getFascistPoliciesToWin());
        assertEquals(5, config.toJson().getJSONArray("fascistPowerSchedule").length());
        assertFalse(config.getFascistPowerSchedule().containsKey(6));
    }

    @Test
    public void testAnarchistReplacementCountIsNotSerializedOrConfigurable() {
        JSONObject json = GameSetupConfig.anarchist(7).toJson();
        assertFalse(json.has("anarchistReplacementCount"));

        json.put("preset", "MANUAL");
        json.put("anarchistReplacementCount", 3);
        GameSetupConfig config = GameSetupConfig.fromJson(json, 7, GameSetupConfig.anarchist(7));

        assertFalse(config.toJson().has("anarchistReplacementCount"));
    }

    @Test
    public void testAnarchistPolicyChosenByChancellorResolvesReplacementWithoutBoardTile() throws Exception {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(7), GameSetupConfig.anarchist(7));
        replaceDrawDeck(game,
                Policy.Type.LIBERAL, Policy.Type.ANARCHIST, Policy.Type.FASCIST,
                Policy.Type.FASCIST, Policy.Type.LIBERAL, Policy.Type.LIBERAL);

        passVote(game, "1");
        List<Policy> presidentChoices = game.getPresidentLegislativeChoices();
        assertEquals(Policy.Type.LIBERAL, presidentChoices.get(0).getType());
        assertEquals(Policy.Type.ANARCHIST, presidentChoices.get(1).getType());
        assertEquals(Policy.Type.FASCIST, presidentChoices.get(2).getType());

        game.presidentDiscardPolicy(0);
        assertEquals(Policy.Type.ANARCHIST, game.getChancellorLegislativeChoices().get(0).getType());
        game.chancellorEnactPolicy(0);

        assertEquals(1, game.getNumAnarchistPoliciesResolved());
        assertEquals(0, game.getNumLiberalPolicies());
        assertEquals(1, game.getNumFascistPolicies());
        assertEquals(Policy.Type.FASCIST, game.getLastEnactedPolicy());
        assertNotSame(GameState.ANARCHIST_VICTORY_POLICY, game.getState());
    }

    @Test
    public void testElectionTrackerAnarchistPolicyWinsOnlyWhenAnarchistsExist() throws Exception {
        SecretHitlerGame withAnarchist = new SecretHitlerGame(makePlayers(7), GameSetupConfig.anarchist(7));
        replaceDrawDeck(withAnarchist, Policy.Type.ANARCHIST, Policy.Type.LIBERAL, Policy.Type.FASCIST);

        failVote(withAnarchist, "1");
        withAnarchist.endPresidentialTerm();
        failVote(withAnarchist, "2");
        withAnarchist.endPresidentialTerm();
        failVote(withAnarchist, "3");

        assertEquals(GameState.ANARCHIST_VICTORY_POLICY, withAnarchist.getState());
        assertEquals(1, withAnarchist.getNumAnarchistPoliciesResolved());

        SecretHitlerGame withoutAnarchist = new SecretHitlerGame(makePlayers(7),
                GameSetupConfig.builder(7)
                        .roles(4, 2, 1, 0)
                        .policies(SecretHitlerGame.NUM_LIBERAL_POLICIES, SecretHitlerGame.NUM_FASCIST_POLICIES, 3)
                        .build());
        replaceDrawDeck(withoutAnarchist, Policy.Type.ANARCHIST, Policy.Type.LIBERAL, Policy.Type.FASCIST);

        failVote(withoutAnarchist, "1");
        withoutAnarchist.endPresidentialTerm();
        failVote(withoutAnarchist, "2");
        withoutAnarchist.endPresidentialTerm();
        failVote(withoutAnarchist, "3");

        assertNotSame(GameState.ANARCHIST_VICTORY_POLICY, withoutAnarchist.getState());
        assertEquals(1, withoutAnarchist.getNumAnarchistPoliciesResolved());
        assertEquals(1, withoutAnarchist.getNumLiberalPolicies() + withoutAnarchist.getNumFascistPolicies());
    }

    @Test
    public void testMultiHitlerExecutionVictoryRequiresConfiguredNumberOfExecutedHitlers() throws Exception {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(7),
                GameSetupConfig.builder(7)
                        .roles(3, 1, 2, 1)
                        .policies(6, 11, 3)
                        .requiredExecutedHitlersForLiberalVictory(2)
                        .build());

        List<String> hitlers = new ArrayList<>();
        for (Player player : game.getPlayerList()) {
            if (player.isHitler()) {
                hitlers.add(player.getUsername());
            }
        }
        assertEquals(2, hitlers.size());

        forceState(game, GameState.PRESIDENTIAL_POWER_EXECUTION);
        game.executePlayer(hitlers.get(0));
        assertEquals(GameState.POST_LEGISLATIVE, game.getState());

        forceState(game, GameState.PRESIDENTIAL_POWER_EXECUTION);
        game.executePlayer(hitlers.get(1));
        assertEquals(GameState.LIBERAL_VICTORY_EXECUTION, game.getState());
    }

    @Test
    public void testAnarchistBotsKnowEachOther() {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(8),
                GameSetupConfig.builder(8)
                        .roles(3, 2, 1, 2)
                        .policies(6, 11, 3)
                        .build());

        String firstAnarchist = null;
        String secondAnarchist = null;
        for (Player player : game.getPlayerList()) {
            if (player.getIdentity() == Identity.ANARCHIST) {
                if (firstAnarchist == null) {
                    firstAnarchist = player.getUsername();
                } else {
                    secondAnarchist = player.getUsername();
                }
            }
        }

        CpuPlayer cpu = new CpuPlayer(firstAnarchist);
        cpu.initialize(game);

        assertEquals(Identity.ANARCHIST, cpu.knownPlayerRoles.get(firstAnarchist));
        assertEquals(Identity.ANARCHIST, cpu.knownPlayerRoles.get(secondAnarchist));
    }
}

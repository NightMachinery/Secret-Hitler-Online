package server.util;

import game.GameState;
import game.GameSetupConfig;
import game.SecretHitlerGame;
import game.datastructures.Deck;
import game.datastructures.Identity;
import game.datastructures.Player;
import game.datastructures.Policy;
import game.datastructures.board.PresidentialPower;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentSkipListSet;

import static junit.framework.TestCase.assertEquals;
import static junit.framework.TestCase.assertFalse;
import static junit.framework.TestCase.assertTrue;

public class GameToJSONConverterTest {

    private ArrayList<String> makePlayers(int numPlayers) {
        ArrayList<String> out = new ArrayList<>();
        for (int i = 0; i < numPlayers; i++) {
            out.add(Integer.toString(i));
        }
        return out;
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

    private void voteYesForAllLiving(SecretHitlerGame game) {
        for (Player player : game.getPlayerList()) {
            if (player.isAlive()) {
                game.registerVote(player.getUsername(), true);
            }
        }
    }

    private void voteNoForAllLiving(SecretHitlerGame game) {
        for (Player player : game.getPlayerList()) {
            if (player.isAlive()) {
                game.registerVote(player.getUsername(), false);
            }
        }
    }

    private String findPlayerWithIdentity(SecretHitlerGame game, Identity identity) {
        for (Player player : game.getPlayerList()) {
            if (player.getIdentity() == identity) {
                return player.getUsername();
            }
        }
        throw new AssertionError("No player with identity " + identity);
    }

    private SecretHitlerGame makeGameAfterInvestigation(String target) throws Exception {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(9),
                GameSetupConfig.builder(9)
                        .powerAt(1, PresidentialPower.INVESTIGATE)
                        .build());
        replaceDrawDeck(game, Policy.Type.FASCIST, Policy.Type.LIBERAL, Policy.Type.LIBERAL, Policy.Type.FASCIST);

        game.nominateChancellor("2");
        voteYesForAllLiving(game);
        game.presidentDiscardPolicy(1);
        game.chancellorEnactPolicy(0);
        game.refusePolicyClaim("0");
        game.refusePolicyClaim("2");

        assertEquals(GameState.PRESIDENTIAL_POWER_INVESTIGATE, game.getState());
        game.investigatePlayer(target);
        assertEquals(GameState.POST_LEGISLATIVE, game.getState());
        return game;
    }

    private String expectedInvestigationResult(SecretHitlerGame game, String target) {
        Player player = game.getPlayer(target);
        if (player.getIdentity() == Identity.ANARCHIST
                && game.getSetupConfig().doAnarchistInvestigationsRevealAnarchist()) {
            return "ANARCHIST";
        }
        return player.isFascist() ? "FASCIST" : "LIBERAL";
    }

    private JSONObject firstPublicAction(JSONObject gamePacket) {
        return gamePacket.getJSONArray("history")
                .getJSONObject(0)
                .getJSONArray("publicActions")
                .getJSONObject(0);
    }

    @Test
    public void testHistoryHiddenWhenConfiguredOff() {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(6));
        game.nominateChancellor("2");
        voteNoForAllLiving(game);

        Lobby.HistoryDisplayConfig config = new Lobby.HistoryDisplayConfig(
                false,
                true,
                true,
                Lobby.HistoryDisplayConfig.RoundsToShow.ALL);
        JSONObject out = GameToJSONConverter.convert(game, "0", config);

        JSONArray history = out.getJSONArray("history");
        assertEquals(0, history.length());
        JSONObject historyConfig = out.getJSONObject("historyConfig");
        assertEquals(false, historyConfig.getBoolean("showHistory"));
    }

    @Test
    public void testHistoryFilteringAndMaskingOptions() {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(6));

        game.nominateChancellor("2");
        voteNoForAllLiving(game);
        assertEquals(GameState.POST_LEGISLATIVE, game.getState());
        game.endPresidentialTerm();

        game.nominateChancellor("3");
        voteNoForAllLiving(game);

        Lobby.HistoryDisplayConfig config = new Lobby.HistoryDisplayConfig(
                true,
                false,
                false,
                Lobby.HistoryDisplayConfig.RoundsToShow.LAST_1);
        JSONObject out = GameToJSONConverter.convert(game, "0", config);

        JSONArray history = out.getJSONArray("history");
        assertEquals(1, history.length());
        JSONObject entry = history.getJSONObject(0);
        assertEquals(2, entry.getInt("round"));
        assertEquals(0, entry.getJSONObject("votes").length());
        assertEquals(0, entry.getJSONArray("publicActions").length());

        JSONObject historyConfig = out.getJSONObject("historyConfig");
        assertEquals(true, historyConfig.getBoolean("showHistory"));
        assertEquals(false, historyConfig.getBoolean("showVoteBreakdown"));
        assertEquals(false, historyConfig.getBoolean("showPublicActions"));
        assertTrue(historyConfig.getString("roundsToShow").equals("LAST_1"));
    }

    @Test
    public void testInvestigationHistoryResultOnlySerializesToInvestigatingPresident() throws Exception {
        String target = "3";
        SecretHitlerGame game = makeGameAfterInvestigation(target);
        String expectedResult = expectedInvestigationResult(game, target);

        JSONObject presidentView = GameToJSONConverter.convert(game, "0", Lobby.HistoryDisplayConfig.defaultConfig());
        JSONObject presidentAction = firstPublicAction(presidentView);
        assertEquals("INVESTIGATED", presidentAction.getString("type"));
        assertEquals("0", presidentAction.getString("president"));
        assertEquals(target, presidentAction.getString("target"));
        assertEquals(expectedResult, presidentAction.getString("investigationResult"));

        JSONObject targetView = GameToJSONConverter.convert(game, target, Lobby.HistoryDisplayConfig.defaultConfig());
        assertTrue(firstPublicAction(targetView).isNull("investigationResult"));

        JSONObject otherPlayerView = GameToJSONConverter.convert(game, "4", Lobby.HistoryDisplayConfig.defaultConfig());
        assertTrue(firstPublicAction(otherPlayerView).isNull("investigationResult"));
    }

    @Test
    public void testInvestigationHistoryResultHiddenWhenPublicActionsAreDisabled() throws Exception {
        SecretHitlerGame game = makeGameAfterInvestigation("3");
        Lobby.HistoryDisplayConfig config = new Lobby.HistoryDisplayConfig(
                true,
                false,
                true,
                Lobby.HistoryDisplayConfig.RoundsToShow.ALL);

        JSONObject presidentView = GameToJSONConverter.convert(game, "0", config);

        assertEquals(0, presidentView.getJSONArray("history")
                .getJSONObject(0)
                .getJSONArray("publicActions")
                .length());
    }


    @Test
    public void testCurrentRoundPolicyClaimsSerializeWhenHistoryOptionIsDisabled() throws Exception {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(6));
        replaceDrawDeck(game, Policy.Type.FASCIST, Policy.Type.LIBERAL, Policy.Type.LIBERAL, Policy.Type.FASCIST);
        game.nominateChancellor("2");
        voteYesForAllLiving(game);
        game.presidentDiscardPolicy(1);
        game.chancellorEnactPolicy(0);
        game.registerPolicyClaim("0", false, Arrays.asList(
                Policy.Type.FASCIST,
                Policy.Type.FASCIST,
                Policy.Type.LIBERAL));

        Lobby.HistoryDisplayConfig config = new Lobby.HistoryDisplayConfig(
                true,
                true,
                true,
                Lobby.HistoryDisplayConfig.RoundsToShow.ALL,
                false);
        JSONObject currentRoundOut = GameToJSONConverter.convert(game, "0", config);

        JSONObject currentEntry = currentRoundOut.getJSONArray("history").getJSONObject(0);
        assertEquals(false, currentRoundOut.getJSONObject("historyConfig").getBoolean("showPolicyClaims"));
        assertEquals(true, currentEntry.getBoolean("policyClaimsRequired"));
        assertEquals(false, currentEntry.getJSONObject("presidentPolicyClaim").getBoolean("refused"));
        assertEquals("FASCIST", currentEntry.getJSONObject("presidentPolicyClaim").getJSONArray("policies").getString(0));
        assertTrue(currentEntry.isNull("chancellorPolicyClaim"));

        game.refusePolicyClaim("2");
        game.endPresidentialTerm();

        JSONObject pastRoundOut = GameToJSONConverter.convert(game, "0", config);
        JSONObject pastEntry = pastRoundOut.getJSONArray("history").getJSONObject(0);
        assertEquals(false, pastEntry.getBoolean("policyClaimsRequired"));
        assertTrue(pastEntry.isNull("presidentPolicyClaim"));
        assertTrue(pastEntry.isNull("chancellorPolicyClaim"));
    }

    @Test
    public void testHistorySerializesResultTrail() throws Exception {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(6));
        replaceDrawDeck(game, Policy.Type.FASCIST, Policy.Type.LIBERAL, Policy.Type.FASCIST);

        game.nominateChancellor("2");
        voteNoForAllLiving(game);
        game.endPresidentialTerm();
        game.nominateChancellor("3");
        voteNoForAllLiving(game);
        game.endPresidentialTerm();
        game.nominateChancellor("4");
        voteNoForAllLiving(game);

        JSONObject out = GameToJSONConverter.convert(game, "0", Lobby.HistoryDisplayConfig.defaultConfig());
        JSONArray resultTrail = out.getJSONArray("history").getJSONObject(2).getJSONArray("resultTrail");
        assertEquals(1, resultTrail.length());
        assertEquals("FAILED_ELECTION_RANDOM", resultTrail.getString(0));
    }


    @Test
    public void testGamePacketIncludesCreatorAndBotControlledMetadata() throws Exception {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(6));
        Lobby lobby = new Lobby();

        Field gameField = Lobby.class.getDeclaredField("game");
        gameField.setAccessible(true);
        gameField.set(lobby, game);

        Field creatorField = Lobby.class.getDeclaredField("creatorUsername");
        creatorField.setAccessible(true);
        creatorField.set(lobby, "0");

        Field botControlledField = Lobby.class.getDeclaredField("botControlledPlayers");
        botControlledField.setAccessible(true);
        ConcurrentSkipListSet<String> botControlled = new ConcurrentSkipListSet<>();
        botControlled.add("2");
        botControlledField.set(lobby, botControlled);

        Field moderatorsField = Lobby.class.getDeclaredField("moderatorUsernames");
        moderatorsField.setAccessible(true);
        ConcurrentSkipListSet<String> moderators = new ConcurrentSkipListSet<>();
        moderators.add("3");
        moderatorsField.set(lobby, moderators);

        Field generatedBotField = Lobby.class.getDeclaredField("generatedBotPlayers");
        generatedBotField.setAccessible(true);
        ConcurrentSkipListSet<String> generatedBots = new ConcurrentSkipListSet<>();
        generatedBots.add("5");
        generatedBotField.set(lobby, generatedBots);

        Field observerAssignmentsField = Lobby.class.getDeclaredField("observerToAssignedPlayer");
        observerAssignmentsField.setAccessible(true);
        ConcurrentHashMap<String, String> observerAssignments = new ConcurrentHashMap<>();
        observerAssignments.put("observer", "5");
        observerAssignmentsField.set(lobby, observerAssignments);

        lobby.setDiscussionReactionConfig(12, false);
        lobby.setDiscussionReaction("2", Lobby.DiscussionReactionType.LIKE);

        JSONObject out = GameToJSONConverter.convert(game, "0", Lobby.HistoryDisplayConfig.defaultConfig(), lobby);
        assertEquals("0", out.getString("creator"));
        assertTrue(out.getJSONObject("botControlled").getBoolean("2"));
        assertEquals("3", out.getJSONArray("moderators").getString(0));
        assertEquals(false, out.getJSONObject("connected").getBoolean("0"));
        assertEquals("0", out.getString("controlledPlayer"));
        assertEquals(true, out.getBoolean("canAct"));
        assertEquals("HUMAN", out.getJSONObject("players").getJSONObject("0").getString("type"));
        assertEquals("HUMAN", out.getJSONObject("players").getJSONObject("2").getString("type"));
        assertEquals("HUMAN", out.getJSONObject("players").getJSONObject("5").getString("type"));
        assertEquals("HUMAN", out.getString("selfType"));
        assertEquals("GENERATED_BOT", out.getJSONObject("observerAssignableTargets").getString("5"));
        assertEquals("5", out.getJSONObject("observerAssignments").getString("observer"));
        assertEquals(false, out.getJSONObject("observerConnected").getBoolean("observer"));
        assertEquals("observer", out.getJSONArray("observers").getString(0));
        assertEquals(12, out.getJSONObject("discussionReactionConfig").getInt("durationSeconds"));
        assertEquals(false, out.getJSONObject("discussionReactionConfig").getBoolean("allowDeadPlayers"));
        assertEquals("LIKE", out.getJSONObject("discussionReactions").getJSONObject("2").getString("type"));

        JSONObject observerView = GameToJSONConverter.convert(game, "observer", Lobby.HistoryDisplayConfig.defaultConfig(),
                lobby);
        assertEquals("HUMAN", observerView.getString("selfType"));
        assertEquals("5", observerView.getString("controlledPlayer"));
        assertEquals(true, observerView.getBoolean("canAct"));
        assertEquals(false, observerView.getJSONObject("connected").getBoolean("5"));
        assertEquals("LIKE", observerView.getJSONObject("discussionReactions").getJSONObject("2").getString("type"));
    }

    @Test
    public void testFascistKnowledgeDoesNotSerializeAnarchistIdentities() {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(6),
                GameSetupConfig.builder(6)
                        .roles(3, 1, 1, 1)
                        .policies(6, 11, 3)
                        .build());

        String fascist = findPlayerWithIdentity(game, Identity.FASCIST);
        String hitler = findPlayerWithIdentity(game, Identity.HITLER);
        String anarchist = findPlayerWithIdentity(game, Identity.ANARCHIST);

        JSONObject fascistView = GameToJSONConverter.convert(game, fascist,
                Lobby.HistoryDisplayConfig.defaultConfig());
        JSONObject fascistPlayers = fascistView.getJSONObject("players");
        assertEquals("FASCIST", fascistPlayers.getJSONObject(fascist).getString("id"));
        assertEquals("HITLER", fascistPlayers.getJSONObject(hitler).getString("id"));
        assertFalse(fascistPlayers.getJSONObject(anarchist).has("id"));

        JSONObject smallHitlerView = GameToJSONConverter.convert(game, hitler,
                Lobby.HistoryDisplayConfig.defaultConfig());
        JSONObject hitlerPlayers = smallHitlerView.getJSONObject("players");
        assertEquals("HITLER", hitlerPlayers.getJSONObject(hitler).getString("id"));
        assertEquals("FASCIST", hitlerPlayers.getJSONObject(fascist).getString("id"));
        assertFalse(hitlerPlayers.getJSONObject(anarchist).has("id"));
    }
}

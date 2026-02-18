package server.util;

import game.GameState;
import game.SecretHitlerGame;
import game.datastructures.Player;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.concurrent.ConcurrentSkipListSet;

import static junit.framework.TestCase.assertEquals;
import static junit.framework.TestCase.assertTrue;

public class GameToJSONConverterTest {

    private ArrayList<String> makePlayers(int numPlayers) {
        ArrayList<String> out = new ArrayList<>();
        for (int i = 0; i < numPlayers; i++) {
            out.add(Integer.toString(i));
        }
        return out;
    }

    private void voteNoForAllLiving(SecretHitlerGame game) {
        for (Player player : game.getPlayerList()) {
            if (player.isAlive()) {
                game.registerVote(player.getUsername(), false);
            }
        }
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
    public void testGamePacketIncludesCreatorAndBotControlledMetadata() throws Exception {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(6));
        Lobby lobby = new Lobby();

        Field creatorField = Lobby.class.getDeclaredField("creatorUsername");
        creatorField.setAccessible(true);
        creatorField.set(lobby, "0");

        Field botControlledField = Lobby.class.getDeclaredField("botControlledPlayers");
        botControlledField.setAccessible(true);
        ConcurrentSkipListSet<String> botControlled = new ConcurrentSkipListSet<>();
        botControlled.add("2");
        botControlledField.set(lobby, botControlled);

        Field generatedBotField = Lobby.class.getDeclaredField("generatedBotPlayers");
        generatedBotField.setAccessible(true);
        ConcurrentSkipListSet<String> generatedBots = new ConcurrentSkipListSet<>();
        generatedBots.add("5");
        generatedBotField.set(lobby, generatedBots);

        JSONObject out = GameToJSONConverter.convert(game, "0", Lobby.HistoryDisplayConfig.defaultConfig(), lobby);
        assertEquals("0", out.getString("creator"));
        assertTrue(out.getJSONObject("botControlled").getBoolean("2"));
        assertEquals("HUMAN", out.getJSONObject("players").getJSONObject("0").getString("type"));
        assertEquals("HUMAN", out.getJSONObject("players").getJSONObject("2").getString("type"));
        assertEquals("BOT", out.getJSONObject("players").getJSONObject("5").getString("type"));
        assertEquals("HUMAN", out.getString("selfType"));

        JSONObject observerView = GameToJSONConverter.convert(game, "observer", Lobby.HistoryDisplayConfig.defaultConfig(),
                lobby);
        assertEquals("OBSERVER", observerView.getString("selfType"));
    }
}

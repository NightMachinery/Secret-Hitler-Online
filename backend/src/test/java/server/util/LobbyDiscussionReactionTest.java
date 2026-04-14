package server.util;

import game.SecretHitlerGame;
import org.junit.Test;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Map;

import static junit.framework.TestCase.assertEquals;
import static junit.framework.TestCase.assertFalse;
import static junit.framework.TestCase.assertTrue;
import static org.junit.Assert.fail;

public class LobbyDiscussionReactionTest {

    private ArrayList<String> makePlayers(int numPlayers) {
        ArrayList<String> out = new ArrayList<>();
        for (int i = 0; i < numPlayers; i++) {
            out.add(Integer.toString(i));
        }
        return out;
    }

    private Lobby createLobbyWithGame() throws Exception {
        Lobby lobby = new Lobby();
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(5));

        Field gameField = Lobby.class.getDeclaredField("game");
        gameField.setAccessible(true);
        gameField.set(lobby, game);
        return lobby;
    }

    @Test
    public void testReactionReplaceAndClear() throws Exception {
        Lobby lobby = createLobbyWithGame();

        lobby.setDiscussionReaction("1", Lobby.DiscussionReactionType.LIKE);
        Map<String, Lobby.DiscussionReaction> initial = lobby.getDiscussionReactionsSnapshot();
        assertEquals(Lobby.DiscussionReactionType.LIKE, initial.get("1").getType());

        long firstExpiry = initial.get("1").getExpiresAtMillis();
        Thread.sleep(10L);

        lobby.setDiscussionReaction("1", Lobby.DiscussionReactionType.DISLIKE);
        Map<String, Lobby.DiscussionReaction> replaced = lobby.getDiscussionReactionsSnapshot();
        assertEquals(Lobby.DiscussionReactionType.DISLIKE, replaced.get("1").getType());
        assertTrue(replaced.get("1").getExpiresAtMillis() > firstExpiry);

        lobby.setDiscussionReaction("1", Lobby.DiscussionReactionType.CLEAR);
        assertFalse(lobby.getDiscussionReactionsSnapshot().containsKey("1"));
    }

    @Test
    public void testReactionConfigClearsDeadPlayerReactionsWhenDisabled() throws Exception {
        Lobby lobby = createLobbyWithGame();
        lobby.setDiscussionReaction("1", Lobby.DiscussionReactionType.LIKE);
        lobby.game().getPlayer("1").kill();

        lobby.setDiscussionReactionConfig(15, false);

        assertFalse(lobby.getDiscussionReactionsSnapshot().containsKey("1"));
        assertFalse(lobby.getDiscussionReactionConfig().shouldAllowDeadPlayers());

        try {
            lobby.setDiscussionReaction("1", Lobby.DiscussionReactionType.DISLIKE);
            fail("Expected dead-player reactions to be rejected.");
        } catch (IllegalStateException ignored) {
        }
    }

    @Test
    public void testExpiredReactionsArePrunedFromSnapshots() throws Exception {
        Lobby lobby = createLobbyWithGame();
        lobby.setDiscussionReactionConfig(1, true);
        lobby.setDiscussionReaction("2", Lobby.DiscussionReactionType.LIKE);

        assertTrue(lobby.getDiscussionReactionsSnapshot().containsKey("2"));
        Thread.sleep(1100L);

        assertFalse(lobby.getDiscussionReactionsSnapshot().containsKey("2"));
    }
}

package game;

import game.datastructures.Player;
import org.junit.Test;

import java.util.ArrayList;
import java.util.List;

import static junit.framework.TestCase.*;

public class testSecretHitlerGame {

    private ArrayList<String> makePlayers(int numPlayers) {
        ArrayList<String> out = new ArrayList<>();
        for (int i = 0; i < numPlayers; i++) {
            out.add(Integer.toString(i));
        }
        return out;
    }

    private int getExpectedTotalFascists(int numPlayers) {
        return (numPlayers - 1) / 2;
    }

    private int getExpectedRegularFascists(int numPlayers) {
        return getExpectedTotalFascists(numPlayers) - 1;
    }

    private int getExpectedLiberals(int numPlayers) {
        return numPlayers - getExpectedTotalFascists(numPlayers);
    }

    @Test
    public void testGameFlow() {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(6));

        assertEquals(game.getCurrentPresident(), "0");
        assertNull(game.getCurrentChancellor());
        assertEquals(game.getDrawSize(), SecretHitlerGame.NUM_FASCIST_POLICIES + SecretHitlerGame.NUM_LIBERAL_POLICIES);

        List<Player> playerList = game.getPlayerList();
        int fascistCount = 0;
        int liberalCount = 0;
        int hitlerCount = 0;
        for (Player player : playerList) {
            if (player.isHitler()) {
                hitlerCount++;
            } else if (player.isFascist()) {
                fascistCount++;
            } else {
                liberalCount++;
            }
            assertTrue(player.isAlive());
        }
        assertEquals(fascistCount, getExpectedRegularFascists(6));
        assertEquals(hitlerCount, 1);
        assertEquals(liberalCount, getExpectedLiberals(6));

        game.nominateChancellor("2");
        assertEquals(game.getState(), GameState.CHANCELLOR_VOTING);
    }

    @Test
    public void testRoleAssignmentMatchesFormulaForFiveToTwentyPlayers() {
        for (int numPlayers = SecretHitlerGame.MIN_PLAYERS; numPlayers <= SecretHitlerGame.MAX_PLAYERS; numPlayers++) {
            SecretHitlerGame game = new SecretHitlerGame(makePlayers(numPlayers));
            List<Player> playerList = game.getPlayerList();

            int fascistCount = 0;
            int liberalCount = 0;
            int hitlerCount = 0;
            for (Player player : playerList) {
                if (player.isHitler()) {
                    hitlerCount++;
                } else if (player.isFascist()) {
                    fascistCount++;
                } else {
                    liberalCount++;
                }
            }

            assertEquals("Unexpected Hitler count for " + numPlayers + " players", 1, hitlerCount);
            assertEquals("Unexpected fascist count for " + numPlayers + " players",
                    getExpectedRegularFascists(numPlayers), fascistCount);
            assertEquals("Unexpected liberal count for " + numPlayers + " players",
                    getExpectedLiberals(numPlayers), liberalCount);
        }
    }

    @Test
    public void testBoundaryPlayerCountsFiveToTwentyInclusive() {
        new SecretHitlerGame(makePlayers(SecretHitlerGame.MAX_PLAYERS));

        try {
            new SecretHitlerGame(makePlayers(SecretHitlerGame.MAX_PLAYERS + 1));
            fail("Expected an IllegalArgumentException for player counts above MAX_PLAYERS.");
        } catch (IllegalArgumentException ignored) {
            // Expected
        }
    }

    @Test
    public void testHistoryTracksFailedVoteRound() {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(6));
        game.nominateChancellor("2");

        for (Player player : game.getPlayerList()) {
            if (player.isAlive()) {
                game.registerVote(player.getUsername(), false);
            }
        }

        assertEquals(GameState.POST_LEGISLATIVE, game.getState());
        assertEquals(1, game.getHistory().size());

        SecretHitlerGame.RoundHistoryEntry entry = game.getHistory().get(0);
        assertEquals(1, entry.getRound());
        assertEquals("0", entry.getPresident());
        assertEquals("2", entry.getChancellor());
        assertFalse(entry.didVotePass());
        assertEquals(SecretHitlerGame.RoundHistoryResult.VOTE_FAILED, entry.getResult());
        assertTrue(entry.getPublicActions().isEmpty());
        assertEquals(6, entry.getVotes().size());
    }
}

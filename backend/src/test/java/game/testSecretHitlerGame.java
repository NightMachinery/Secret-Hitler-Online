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
        assertEquals(fascistCount, SecretHitlerGame.NUM_FASCISTS_FOR_PLAYERS[6]);
        assertEquals(hitlerCount, 1);
        assertEquals(liberalCount, playerList.size() - SecretHitlerGame.NUM_FASCISTS_FOR_PLAYERS[6] - 1);

        game.nominateChancellor("2");
        assertEquals(game.getState(), GameState.CHANCELLOR_VOTING);
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

package server.util;

import game.SecretHitlerGame;
import game.GameState;
import org.junit.Test;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Set;
import java.util.concurrent.ConcurrentSkipListSet;

import static junit.framework.TestCase.assertFalse;
import static junit.framework.TestCase.assertTrue;
import static junit.framework.TestCase.assertEquals;
import static org.junit.Assert.fail;

public class LobbyBotControlTest {

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

    private Lobby createLobbyWithPostLegislativeGame() throws Exception {
        Lobby lobby = new Lobby();
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(5));

        game.nominateChancellor("1");
        for (String player : makePlayers(5)) {
            game.registerVote(player, true);
        }
        game.presidentDiscardPolicy(0);
        game.chancellorEnactPolicy(0);
        assertEquals(GameState.POST_LEGISLATIVE, game.getState());

        Field gameField = Lobby.class.getDeclaredField("game");
        gameField.setAccessible(true);
        gameField.set(lobby, game);
        return lobby;
    }

    @Test
    public void testEnableAndDisableTemporaryBotControl() throws Exception {
        Lobby lobby = createLobbyWithGame();

        lobby.enableTemporaryBotControl("1");
        assertTrue(lobby.isBotControlled("1"));
        assertTrue(lobby.game().getPlayer("1").isCpu());

        lobby.disableTemporaryBotControl("1");
        assertFalse(lobby.isBotControlled("1"));
        assertFalse(lobby.game().getPlayer("1").isCpu());
    }

    @Test
    public void testGeneratedBotCannotBeModified() throws Exception {
        Lobby lobby = createLobbyWithGame();

        Field generatedBotField = Lobby.class.getDeclaredField("generatedBotPlayers");
        generatedBotField.setAccessible(true);
        Set<String> generated = new ConcurrentSkipListSet<>();
        generated.add("1");
        generatedBotField.set(lobby, generated);

        try {
            lobby.enableTemporaryBotControl("1");
            fail("Expected enableTemporaryBotControl to reject generated bot targets.");
        } catch (IllegalArgumentException ignored) {
        }
    }

    @Test
    public void testEnableTemporaryBotControlCanAdvanceCurrentPresidentsPostLegislativeTurn() throws Exception {
        Lobby lobby = createLobbyWithPostLegislativeGame();
        String currentPresident = lobby.game().getCurrentPresident();
        int currentRound = lobby.game().getRound();

        lobby.enableTemporaryBotControl(currentPresident);

        assertTrue(lobby.isBotControlled(currentPresident));
        assertEquals(GameState.CHANCELLOR_NOMINATION, lobby.game().getState());
        assertEquals(currentRound + 1, lobby.game().getRound());
        assertFalse(currentPresident.equals(lobby.game().getCurrentPresident()));
    }

    @Test
    public void testUpdateAllUsersDoesNotCrashWhenPlayerBecomesBotMidGame() throws Exception {
        Lobby lobby = createLobbyWithGame();
        String currentPresident = lobby.game().getCurrentPresident();

        lobby.enableTemporaryBotControl(currentPresident);
        lobby.updateAllUsers();

        assertTrue(lobby.isBotControlled(currentPresident));
        assertEquals(GameState.CHANCELLOR_VOTING, lobby.game().getState());
    }
}

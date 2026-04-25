package server.util;

import game.SecretHitlerGame;
import game.GameState;
import io.javalin.websocket.WsContext;
import org.eclipse.jetty.websocket.api.Session;
import org.junit.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.Arrays;
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

    private WsContext createContext() {
        Session session = (Session) Proxy.newProxyInstance(
                Session.class.getClassLoader(),
                new Class[] { Session.class },
                (proxy, method, args) -> {
                    Class<?> returnType = method.getReturnType();
                    if (returnType.equals(boolean.class)) {
                        return false;
                    }
                    if (returnType.equals(int.class)) {
                        return 0;
                    }
                    if (returnType.equals(long.class)) {
                        return 0L;
                    }
                    if (returnType.equals(double.class)) {
                        return 0d;
                    }
                    if (returnType.equals(float.class)) {
                        return 0f;
                    }
                    return null;
                });
        return new WsContext("/", session) {
        };
    }

    private WsContext addConnectedObserver(Lobby lobby, String observerName) {
        WsContext context = createContext();
        lobby.addUser(context, observerName);
        return context;
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
        game.refusePolicyClaim(game.getCurrentPresident());
        game.refusePolicyClaim(game.getCurrentChancellor());
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

    @Test
    public void testConnectedObserverCanTakeOverGeneratedBotSeat() throws Exception {
        Lobby lobby = createLobbyWithGame();
        addConnectedObserver(lobby, "observer");

        Field generatedBotField = Lobby.class.getDeclaredField("generatedBotPlayers");
        generatedBotField.setAccessible(true);
        Set<String> generated = new ConcurrentSkipListSet<>();
        generated.add("1");
        generatedBotField.set(lobby, generated);

        lobby.setObserverAssignment("1", "observer");

        assertEquals("1", lobby.getAssignedSeatForObserver("observer"));
        assertTrue(lobby.isSeatObserverControlled("1"));
        assertTrue(lobby.canUserAct("observer"));
        assertTrue(lobby.getSeatControllerConnectedStatusSnapshot(Arrays.asList("1")).get("1"));
        assertFalse(lobby.game().getPlayer("1").isCpu());
    }

    @Test
    public void testObserverAssignmentOnTemporaryHumanBotSeatMakesOwnerReadOnly() throws Exception {
        Lobby lobby = createLobbyWithGame();
        WsContext observerContext = addConnectedObserver(lobby, "observer");

        lobby.enableTemporaryBotControl("1");
        lobby.setObserverAssignment("1", "observer");

        assertTrue(lobby.isSeatObserverControlled("1"));
        assertTrue(lobby.canUserAct("observer"));
        assertFalse(lobby.canUserAct("1"));
        assertFalse(lobby.game().getPlayer("1").isCpu());

        lobby.removeUserImmediately(observerContext);
        assertFalse(lobby.getSeatControllerConnectedStatusSnapshot(Arrays.asList("1")).get("1"));
        assertEquals("1", lobby.getAssignedSeatForObserver("observer"));

        lobby.setObserverAssignment("1", null);
        assertFalse(lobby.isSeatObserverControlled("1"));
        assertFalse(lobby.isBotControlled("1"));
        assertTrue(lobby.canUserAct("1"));
    }
}

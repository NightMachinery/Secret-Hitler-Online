package server.util;

import org.junit.Test;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentSkipListSet;

import static junit.framework.TestCase.assertEquals;
import static junit.framework.TestCase.assertFalse;
import static junit.framework.TestCase.assertTrue;

public class LobbyModerationTest {

    @SuppressWarnings("unchecked")
    private List<String> getLobbyUsernames(Lobby lobby) throws Exception {
        Field field = Lobby.class.getDeclaredField("lobbyUsernames");
        field.setAccessible(true);
        return (List<String>) field.get(lobby);
    }

    @SuppressWarnings("unchecked")
    private Set<String> getUsersInGame(Lobby lobby) throws Exception {
        Field field = Lobby.class.getDeclaredField("usersInGame");
        field.setAccessible(true);
        return (Set<String>) field.get(lobby);
    }

    @SuppressWarnings("unchecked")
    private ConcurrentHashMap<String, String> getAuthTokens(Lobby lobby) throws Exception {
        Field field = Lobby.class.getDeclaredField("usernameToAuthToken");
        field.setAccessible(true);
        return (ConcurrentHashMap<String, String>) field.get(lobby);
    }

    @SuppressWarnings("unchecked")
    private Set<String> getModerators(Lobby lobby) throws Exception {
        Field field = Lobby.class.getDeclaredField("moderatorUsernames");
        field.setAccessible(true);
        return (Set<String>) field.get(lobby);
    }

    @Test
    public void testLeaveLobbyRemovesMembershipButKeepsCreatorIdentity() throws Exception {
        Lobby lobby = new Lobby();
        List<String> usernames = getLobbyUsernames(lobby);
        usernames.add("creator");
        usernames.add("other");

        Field creatorField = Lobby.class.getDeclaredField("creatorUsername");
        creatorField.setAccessible(true);
        creatorField.set(lobby, "creator");

        lobby.leaveLobby("creator");

        assertFalse(lobby.hasLobbyMember("creator"));
        assertEquals("creator", lobby.getCreatorUsername());
        assertTrue(lobby.hasLobbyMember("other"));
    }

    @Test
    public void testBanRemovesModeratorAndClearsNameBinding() throws Exception {
        Lobby lobby = new Lobby();
        getLobbyUsernames(lobby).add("bob");
        getModerators(lobby).add("bob");
        getAuthTokens(lobby).put("bob", "token-1");

        lobby.kickUser("bob", true);

        assertFalse(lobby.hasLobbyMember("bob"));
        assertFalse(lobby.isModerator("bob"));
        assertTrue(lobby.isTokenBanned("token-1"));
        assertTrue(lobby.canUseNameWithToken("bob", "another-token"));
    }

    @Test
    public void testCanPromoteDisconnectedMidGamePlayerToModerator() throws Exception {
        Lobby lobby = new Lobby();
        getUsersInGame(lobby).add("alice");

        lobby.setModeratorStatus("alice", true);

        assertTrue(lobby.isModerator("alice"));
        assertTrue(lobby.canManageModeratorsTarget("alice"));
    }
}

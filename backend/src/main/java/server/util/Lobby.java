package server.util;

import game.CpuPlayer;
import game.GameState;
import game.SecretHitlerGame;
import game.datastructures.Player;
import io.javalin.websocket.WsContext;
import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import server.SecretHitlerServer;

import java.io.IOException;
import java.nio.channels.ClosedChannelException;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentSkipListSet;
import java.util.stream.Collectors;

/**
 * A Lobby holds a collection of websocket connections, each representing a
 * player.
 * It maintains the game that the connections are associated with.
 *
 * A user is defined as an active websocket connection.
 */
public class Lobby implements Serializable {
    private static final long serialVersionUID = -1555206041648247736L;

    public static class HistoryDisplayConfig implements Serializable {
        public enum RoundsToShow {
            ALL,
            LAST_1,
            LAST_3;

            public static RoundsToShow fromString(String value) {
                if (value == null) {
                    return ALL;
                }
                String normalized = value.trim().toUpperCase();
                if (normalized.equals("LAST_1") || normalized.equals("LAST1") || normalized.equals("1")) {
                    return LAST_1;
                } else if (normalized.equals("LAST_3") || normalized.equals("LAST3") || normalized.equals("3")) {
                    return LAST_3;
                } else {
                    return ALL;
                }
            }
        }

        private final boolean showHistory;
        private final boolean showPublicActions;
        private final boolean showVoteBreakdown;
        private final RoundsToShow roundsToShow;

        public HistoryDisplayConfig(boolean showHistory, boolean showPublicActions, boolean showVoteBreakdown,
                RoundsToShow roundsToShow) {
            this.showHistory = showHistory;
            this.showPublicActions = showPublicActions;
            this.showVoteBreakdown = showVoteBreakdown;
            this.roundsToShow = roundsToShow == null ? RoundsToShow.ALL : roundsToShow;
        }

        public static HistoryDisplayConfig defaultConfig() {
            return new HistoryDisplayConfig(true, true, true, RoundsToShow.ALL);
        }

        public boolean shouldShowHistory() {
            return showHistory;
        }

        public boolean shouldShowPublicActions() {
            return showPublicActions;
        }

        public boolean shouldShowVoteBreakdown() {
            return showVoteBreakdown;
        }

        public RoundsToShow getRoundsToShow() {
            return roundsToShow;
        }
    }

    private SecretHitlerGame game;

    transient private ConcurrentHashMap<WsContext, String> userToUsername;

    private List<String> lobbyUsernames;
    final private Set<String> usersInGame;
    final private ConcurrentHashMap<String, String> usernameToIcon;
    private ConcurrentHashMap<String, String> usernameToAuthToken;
    private String creatorUsername;
    private Set<String> moderatorUsernames;
    private Set<String> bannedTokens;
    private Set<String> botControlledPlayers;
    private Set<String> generatedBotPlayers;
    private ConcurrentHashMap<String, CpuPlayer> cpuControllersByName;

    private HistoryDisplayConfig historyDisplayConfig;

    /* Used to reassign users to previously chosen images if they disconnect */
    final private ConcurrentHashMap<String, String> usernameToPreferredIcon;

    public static long LOBBY_TIMEOUT_DURATION_IN_MIN = 72 * 60;
    public static float CPU_ACTION_DELAY_IN_SEC = 4;
    private long timeout;

    private static final Logger logger = LoggerFactory.getLogger(Lobby.class);

    private static final int MAX_TIMER_SCHEDULING_ATTEMPTS = 2;
    transient private Timer cpuTickTimer = new Timer();

    static String DEFAULT_ICON = "p_default";

    /**
     * Constructs a new Lobby.
     */
    public Lobby() {
        this(HistoryDisplayConfig.defaultConfig());
    }

    public Lobby(HistoryDisplayConfig historyDisplayConfig) {
        userToUsername = new ConcurrentHashMap<>();
        lobbyUsernames = new ArrayList<>();
        usersInGame = new ConcurrentSkipListSet<>();
        usernameToIcon = new ConcurrentHashMap<>();
        usernameToAuthToken = new ConcurrentHashMap<>();
        creatorUsername = null;
        moderatorUsernames = new ConcurrentSkipListSet<>();
        bannedTokens = new ConcurrentSkipListSet<>();
        botControlledPlayers = new ConcurrentSkipListSet<>();
        generatedBotPlayers = new ConcurrentSkipListSet<>();
        cpuControllersByName = new ConcurrentHashMap<>();
        usernameToPreferredIcon = new ConcurrentHashMap<>();
        this.historyDisplayConfig = historyDisplayConfig == null ? HistoryDisplayConfig.defaultConfig() : historyDisplayConfig;
        resetTimeout();
    }

    public HistoryDisplayConfig getHistoryDisplayConfig() {
        if (historyDisplayConfig == null) {
            return HistoryDisplayConfig.defaultConfig();
        }
        return historyDisplayConfig;
    }

    /**
     * Resets the internal timeout for this lobby.
     *
     * @effects The lobby will time out in {@code TIMEOUT_DURATION_MS} ms from now.
     */
    synchronized public void resetTimeout() {
        long msPerMinute = 1000L * 60L;
        timeout = System.currentTimeMillis() + msPerMinute * LOBBY_TIMEOUT_DURATION_IN_MIN;
    }

    /**
     * Returns whether the lobby has timed out.
     *
     * @return true if the Lobby has timed out.
     */
    synchronized public boolean hasTimedOut() {
        return timeout <= System.currentTimeMillis();
    }

    /**
     * Returns the set of websocket connections connected to this Lobby.
     */
    synchronized public Set<WsContext> getConnections() {
        return new HashSet<>(userToUsername.keySet());
    }

    /**
     * Returns the list of usernames currently in the lobby or game. Includes bot
     * names if the game is running and has bots.
     */
    synchronized public List<String> getUserNames() {
        if (game != null) {
            return game.getPlayerList().stream().map(player -> player.getUsername()).collect(Collectors.toList());
        }
        return new ArrayList<>(lobbyUsernames);
    }

    synchronized public List<String> getLobbyUsernamesSnapshot() {
        return new ArrayList<>(lobbyUsernames);
    }

    synchronized public String getCreatorUsername() {
        return creatorUsername;
    }

    synchronized public boolean isCreator(String name) {
        if (creatorUsername == null || name == null || name.isBlank()) {
            return false;
        }
        return creatorUsername.equals(name);
    }

    synchronized public boolean isModerator(String name) {
        if (name == null || name.isBlank()) {
            return false;
        }
        return moderatorUsernames.contains(name);
    }

    synchronized public boolean hasModeratorPrivileges(String name) {
        return isCreator(name) || isModerator(name);
    }

    synchronized public Set<String> getModeratorUsernamesSnapshot() {
        return new LinkedHashSet<>(moderatorUsernames);
    }

    synchronized public boolean hasLobbyMember(String name) {
        return name != null && lobbyUsernames.contains(name);
    }

    synchronized public boolean isConnected(String name) {
        return name != null && userToUsername.containsValue(name);
    }

    synchronized public Map<String, Boolean> getConnectedStatusSnapshot(Collection<String> usernames) {
        Map<String, Boolean> connected = new HashMap<>();
        if (usernames == null) {
            return connected;
        }
        for (String username : usernames) {
            connected.put(username, isConnected(username));
        }
        return connected;
    }

    synchronized public Map<String, Boolean> getLobbyConnectedStatusSnapshot() {
        return getConnectedStatusSnapshot(lobbyUsernames);
    }

    synchronized public boolean isTokenBanned(String token) {
        return token != null && !token.isBlank() && bannedTokens.contains(token);
    }

    synchronized public void clearBannedTokens() {
        bannedTokens.clear();
    }

    private void initializeCreatorIfUnset(String name) {
        if (creatorUsername == null && name != null && !name.isBlank()) {
            creatorUsername = name;
        }
    }

    private void restorePreferredIconIfPresent(String name, WsContext context) {
        usernameToIcon.putIfAbsent(name, DEFAULT_ICON);
        if (usernameToPreferredIcon.containsKey(name)) {
            trySetUserIcon(usernameToPreferredIcon.get(name), context);
        }
    }

    private void addLobbyMemberIfAbsent(String name) {
        if (!lobbyUsernames.contains(name)) {
            lobbyUsernames.add(name);
        }
    }

    private void removeLobbyMemberInternal(String name, boolean clearTokenBinding, boolean clearPreferredIcon) {
        lobbyUsernames.remove(name);
        moderatorUsernames.remove(name);
        usernameToIcon.remove(name);
        if (clearTokenBinding) {
            usernameToAuthToken.remove(name);
        }
        if (clearPreferredIcon) {
            usernameToPreferredIcon.remove(name);
        }
    }

    /////// User Management
    // <editor-fold desc="User Management">

    /**
     * Returns whether the given user (websocket connection) is in this lobby.
     */
    synchronized public boolean hasUser(WsContext context) {
        return userToUsername.containsKey(context);
    }

    /**
     * Returns whether a user with the given connection/name pair exists in this
     * lobby.
     */
    synchronized public boolean hasUser(WsContext context, String name) {
        return userToUsername.containsKey(context) && userToUsername.get(context).equals(name);
    }

    /**
     * Returns true if the lobby currently has an active connection for a username.
     */
    synchronized public boolean hasUserWithName(String name) {
        return userToUsername.containsValue(name);
    }

    /**
     * Returns true if the lobby has seen a user with the given name before.
     */
    synchronized public boolean hasKnownName(String name) {
        return usernameToAuthToken.containsKey(name);
    }

    /**
     * Returns true if the supplied token matches the stored token for a name.
     */
    synchronized public boolean hasMatchingAuthToken(String name, String token) {
        if (name == null || token == null || token.isBlank()) {
            return false;
        }
        String expectedToken = usernameToAuthToken.get(name);
        return expectedToken != null && expectedToken.equals(token);
    }

    /**
     * Returns true iff the supplied token is permitted to use the given name.
     */
    synchronized public boolean canUseNameWithToken(String name, String token) {
        if (name == null || name.isBlank() || token == null || token.isBlank()) {
            return false;
        }
        String expectedToken = usernameToAuthToken.get(name);
        return expectedToken == null || expectedToken.equals(token);
    }

    /**
     * Binds a token to a username if no token is currently stored.
     */
    synchronized public void bindAuthTokenIfAbsent(String name, String token) {
        if (name == null || name.isBlank() || token == null || token.isBlank()) {
            throw new IllegalArgumentException("Name and token must be non-empty.");
        }
        usernameToAuthToken.putIfAbsent(name, token);
    }

    /**
     * Returns whether the provided name belongs to a player from the currently
     * running game.
     */
    synchronized public boolean wasUserInCurrentGame(String name) {
        return usersInGame.contains(name);
    }

    synchronized public boolean canManageModeratorsTarget(String target) {
        if (target == null || target.isBlank()) {
            return false;
        }
        return lobbyUsernames.contains(target) || usersInGame.contains(target);
    }

    /**
     * Returns all currently connected sockets for the provided username.
     */
    synchronized public List<WsContext> getConnectionsForName(String name) {
        List<WsContext> out = new ArrayList<>();
        for (Map.Entry<WsContext, String> entry : userToUsername.entrySet()) {
            if (entry.getValue().equals(name)) {
                out.add(entry.getKey());
            }
        }
        return out;
    }

    /**
     * Returns true if a temporary human->bot handoff is enabled for the player.
     */
    synchronized public boolean isBotControlled(String name) {
        if (name == null || name.isBlank()) {
            return false;
        }
        return botControlledPlayers.contains(name);
    }

    synchronized public boolean isGeneratedBotPlayer(String name) {
        if (name == null || name.isBlank()) {
            return false;
        }
        return generatedBotPlayers.contains(name);
    }

    synchronized public Set<String> getBotControlledPlayersSnapshot() {
        return new HashSet<>(botControlledPlayers);
    }

    private boolean shouldCpuActForPlayer(String name) {
        return generatedBotPlayers.contains(name) || botControlledPlayers.contains(name);
    }

    /**
     * Enables temporary bot control for a currently alive human player.
     */
    synchronized public void enableTemporaryBotControl(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Target player must be specified.");
        }
        if (!isInGame() || game == null) {
            throw new IllegalStateException("Bot control can only be changed during an active game.");
        }
        if (!game.hasPlayer(name)) {
            throw new IllegalArgumentException("Player '" + name + "' is not in the current game.");
        }
        if (!game.getPlayer(name).isAlive()) {
            throw new IllegalArgumentException("Cannot enable bot control for dead player '" + name + "'.");
        }
        if (generatedBotPlayers.contains(name)) {
            throw new IllegalArgumentException("Cannot modify built-in bot player '" + name + "'.");
        }

        CpuPlayer cpu = cpuControllersByName.get(name);
        if (cpu == null) {
            cpu = new CpuPlayer(name);
            cpuControllersByName.put(name, cpu);
            cpu.initialize(game);
        } else {
            cpu.synchronizeWithGame(game);
        }
        botControlledPlayers.add(name);

        if (game.getState() == GameState.POST_LEGISLATIVE && name.equals(game.getCurrentPresident())) {
            game.endPresidentialTerm();
            cpu.synchronizeWithGame(game);
        }
    }

    /**
     * Disables temporary bot control for a player.
     */
    synchronized public void disableTemporaryBotControl(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Target player must be specified.");
        }
        if (generatedBotPlayers.contains(name)) {
            throw new IllegalArgumentException("Cannot modify built-in bot player '" + name + "'.");
        }
        botControlledPlayers.remove(name);
        cpuControllersByName.remove(name);
        if (game != null && game.hasPlayer(name)) {
            game.getPlayer(name).markAsHuman();
        }
    }

    synchronized public void setTemporaryBotControl(String name, boolean enabled) {
        if (enabled) {
            enableTemporaryBotControl(name);
        } else {
            disableTemporaryBotControl(name);
        }
    }

    synchronized public void clearBotControlForGame() {
        if (game != null) {
            for (String username : botControlledPlayers) {
                if (game.hasPlayer(username)) {
                    game.getPlayer(username).markAsHuman();
                }
            }
        }
        botControlledPlayers.clear();
        generatedBotPlayers.clear();
        cpuControllersByName.clear();
    }

    /**
     * Checks if a user can be added back to the lobby while a game is running.
     */
    synchronized public boolean canAddUserDuringGame(String name) {
        return usersInGame.contains(name) && !isConnected(name);
    }

    /**
     * Checks if a user can be added as an observer while a game is running.
     */
    synchronized public boolean canAddObserverDuringGame(String name) {
        if (name == null || name.isBlank()) {
            return false;
        }
        return isInGame() && !usersInGame.contains(name);
    }

    /**
     * Checks whether the lobby is full.
     */
    synchronized public boolean isFull() {
        if (isInGame()) {
            return usersInGame.size() >= SecretHitlerGame.MAX_PLAYERS;
        }
        return lobbyUsernames.size() >= SecretHitlerGame.MAX_PLAYERS;
    }

    /**
     * Adds a user (websocket connection) to the lobby.
     */
    synchronized public void addUser(WsContext context, String name) {
        if (userToUsername.containsKey(context)) {
            throw new IllegalArgumentException("Duplicate websockets cannot be added to a lobby.");
        }

        if (isInGame()) {
            if (canAddUserDuringGame(name) || canAddObserverDuringGame(name)) {
                userToUsername.put(context, name);
                initializeCreatorIfUnset(name);
                restorePreferredIconIfPresent(name, context);
                return;
            }
            throw new IllegalArgumentException("Cannot add a new player to a lobby currently in a game.");
        }

        if (isFull()) {
            throw new IllegalArgumentException("Cannot add the player because the lobby is full.");
        }
        if (hasLobbyMember(name)) {
            throw new IllegalArgumentException("Cannot add duplicate names.");
        }

        userToUsername.put(context, name);
        initializeCreatorIfUnset(name);
        addLobbyMemberIfAbsent(name);
        restorePreferredIconIfPresent(name, context);
    }

    /**
     * Adds a connected websocket context for a user whose identity has already been
     * verified by token ownership.
     */
    synchronized public void addOrReplaceConnectedUser(WsContext context, String name) {
        if (userToUsername.containsKey(context)) {
            throw new IllegalArgumentException("Duplicate websockets cannot be added to a lobby.");
        }
        userToUsername.put(context, name);
        initializeCreatorIfUnset(name);
        if (!isInGame()) {
            addLobbyMemberIfAbsent(name);
        }
        restorePreferredIconIfPresent(name, context);
    }

    /**
     * Removes a websocket context immediately.
     */
    synchronized public void removeUserImmediately(WsContext context) {
        userToUsername.remove(context);
    }

    /**
     * Removes a user connection from the Lobby.
     */
    synchronized public void removeUser(WsContext context) {
        if (!hasUser(context)) {
            throw new IllegalArgumentException("Cannot remove a websocket that is not in the Lobby.");
        }
        userToUsername.remove(context);
    }

    synchronized public void leaveLobby(String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Username must be specified.");
        }
        if (isInGame()) {
            throw new IllegalStateException("Cannot leave the setup lobby during an active game.");
        }
        if (!hasLobbyMember(username)) {
            throw new IllegalArgumentException("Player '" + username + "' is not in the setup lobby.");
        }
        removeLobbyMemberInternal(username, false, false);
    }

    synchronized public void setModeratorStatus(String username, boolean enabled) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Target player must be specified.");
        }
        if (!canManageModeratorsTarget(username)) {
            throw new IllegalArgumentException("Player '" + username + "' is not eligible for moderator status.");
        }
        if (isCreator(username)) {
            if (!enabled) {
                throw new IllegalArgumentException("The creator cannot be demoted.");
            }
            return;
        }
        if (enabled) {
            moderatorUsernames.add(username);
        } else {
            moderatorUsernames.remove(username);
        }
    }

    synchronized public void kickUser(String username, boolean ban) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Target player must be specified.");
        }
        if (isInGame()) {
            throw new IllegalStateException("Players can only be removed from the setup lobby.");
        }
        if (!hasLobbyMember(username)) {
            throw new IllegalArgumentException("Player '" + username + "' is not in the setup lobby.");
        }
        if (isCreator(username)) {
            throw new IllegalArgumentException("The creator cannot be kicked or banned.");
        }

        if (ban) {
            String token = usernameToAuthToken.remove(username);
            if (token != null && !token.isBlank()) {
                bannedTokens.add(token);
            }
        }
        removeLobbyMemberInternal(username, false, ban);
    }

    /**
     * Returns the number of current players in the setup lobby, or players in game
     * if a game is active.
     */
    synchronized public int getUserCount() {
        return isInGame() ? usersInGame.size() : lobbyUsernames.size();
    }

    /**
     * Sends a message to every connected user with the current game state.
     */
    synchronized public void updateAllUsers() {
        for (Map.Entry<WsContext, String> entry : userToUsername.entrySet()) {
            updateUser(entry.getKey(), entry.getValue());
        }

        if (game != null && game.hasGameFinished()) {
            game = null;
            clearBotControlForGame();
        }

        boolean didCpuUpdateState = false;
        if (isInGame()) {
            List<CpuPlayer> activeCpuControllers = new ArrayList<>();
            for (Map.Entry<String, CpuPlayer> entry : cpuControllersByName.entrySet()) {
                if (shouldCpuActForPlayer(entry.getKey())) {
                    activeCpuControllers.add(entry.getValue());
                }
            }
            for (CpuPlayer cpu : activeCpuControllers) {
                cpu.update(game);
            }
            for (CpuPlayer cpu : activeCpuControllers) {
                if (game.getState() == GameState.CHANCELLOR_VOTING) {
                    boolean stateUpdated = cpu.act(game);
                    if (stateUpdated && game.getState() != GameState.CHANCELLOR_VOTING) {
                        didCpuUpdateState = true;
                        break;
                    }
                } else if (cpu.act(game)) {
                    didCpuUpdateState = true;
                    break;
                }
            }
        }

        if (didCpuUpdateState) {
            int delayInMs = (int) (CPU_ACTION_DELAY_IN_SEC * 1000);
            int timerSchedulingAttempts = 0;
            while (timerSchedulingAttempts < MAX_TIMER_SCHEDULING_ATTEMPTS) {
                try {
                    cpuTickTimer.schedule(new UpdateUsersTask(), delayInMs);
                    break;
                } catch (IllegalStateException e) {
                    cpuTickTimer.cancel();
                    cpuTickTimer = new Timer();
                    timerSchedulingAttempts++;
                }
            }
            if (timerSchedulingAttempts == MAX_TIMER_SCHEDULING_ATTEMPTS) {
                logger.error("Failed to schedule timer for CPU ticks.");
            }
        }
    }

    /**
     * Small helper class for updating all users after CPU actions.
     */
    class UpdateUsersTask extends TimerTask {
        public void run() {
            updateAllUsers();
        }
    }

    /**
     * Sends a message to the specified user with the current game state.
     */
    synchronized public void updateUser(WsContext ctx, String userName) {
        JSONObject message;
        if (isInGame()) {
            message = GameToJSONConverter.convert(game, userName, getHistoryDisplayConfig(), this);
            message.put(SecretHitlerServer.PARAM_PACKET_TYPE, SecretHitlerServer.PACKET_GAME_STATE);
        } else {
            message = new JSONObject();
            message.put(SecretHitlerServer.PARAM_PACKET_TYPE, SecretHitlerServer.PACKET_LOBBY);
            message.put("usernames", new JSONArray(lobbyUsernames));
            message.put("creator", creatorUsername == null ? "" : creatorUsername);
            message.put("moderators", new JSONArray(moderatorUsernames));
            message.put("connected", new JSONObject(getLobbyConnectedStatusSnapshot()));
        }

        message.put("icon", new JSONObject(usernameToIcon));

        try {
            ctx.send(message.toString());
        } catch (RuntimeException e) {
            removeUserImmediately(ctx);
            if (isClosedSocketException(e)) {
                logger.debug("Skipping websocket update for closed connection of user '{}'.", userName);
            } else {
                logger.warn("Failed to send websocket update to user '{}'.", userName, e);
            }
        }
    }

    private boolean isClosedSocketException(Throwable error) {
        Throwable current = error;
        while (current != null) {
            if (current instanceof ClosedChannelException) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    /**
     * Called when an object is deserialized.
     */
    private void readObject(java.io.ObjectInputStream in) throws IOException, ClassNotFoundException {
        in.defaultReadObject();
        userToUsername = new ConcurrentHashMap<>();
        cpuTickTimer = new Timer();
        if (lobbyUsernames == null) {
            lobbyUsernames = game == null
                    ? new ArrayList<>()
                    : game.getPlayerList().stream().map(Player::getUsername).collect(Collectors.toCollection(ArrayList::new));
        }
        if (usernameToAuthToken == null) {
            usernameToAuthToken = new ConcurrentHashMap<>();
        }
        if (moderatorUsernames == null) {
            moderatorUsernames = new ConcurrentSkipListSet<>();
        }
        if (bannedTokens == null) {
            bannedTokens = new ConcurrentSkipListSet<>();
        }
        if (botControlledPlayers == null) {
            botControlledPlayers = new ConcurrentSkipListSet<>();
        }
        if (generatedBotPlayers == null) {
            generatedBotPlayers = new ConcurrentSkipListSet<>();
        }
        if (cpuControllersByName == null) {
            cpuControllersByName = new ConcurrentHashMap<>();
        }
        if (game != null && cpuControllersByName.isEmpty()) {
            for (Player player : game.getPlayerList()) {
                if (!player.isCpu()) {
                    continue;
                }
                String username = player.getUsername();
                CpuPlayer cpu = new CpuPlayer(username);
                cpuControllersByName.put(username, cpu);
                cpu.initialize(game);
                if (username.startsWith("Bot ")) {
                    generatedBotPlayers.add(username);
                } else {
                    botControlledPlayers.add(username);
                }
            }
        } else if (game != null) {
            for (CpuPlayer cpu : cpuControllersByName.values()) {
                cpu.synchronizeWithGame(game);
            }
        }
        if (game != null) {
            for (Player player : game.getPlayerList()) {
                if (generatedBotPlayers.contains(player.getUsername())) {
                    player.setType(Player.Type.BOT);
                } else {
                    player.setType(Player.Type.HUMAN);
                }
            }
        }
        if (historyDisplayConfig == null) {
            historyDisplayConfig = HistoryDisplayConfig.defaultConfig();
        }
    }

    /**
     * Attempts to set the player's icon to the given iconID and returns whether it
     * was set.
     */
    synchronized public void trySetUserIcon(String iconID, WsContext user) {
        if (!hasUser(user)) {
            throw new IllegalArgumentException("User is not in this lobby.");
        }

        String username = userToUsername.get(user);
        if (!iconID.equals(DEFAULT_ICON)) {
            Collection<String> namesToCheck = isInGame() ? usersInGame : lobbyUsernames;
            for (String name : namesToCheck) {
                if (name.equals(username)) {
                    continue;
                }
                if (usernameToIcon.containsKey(name) && usernameToIcon.get(name).equals(iconID)) {
                    return;
                }
            }
        }

        usernameToIcon.put(username, iconID);
        usernameToPreferredIcon.put(username, iconID);
    }

    // </editor-fold>

    ////// Game Management
    // <editor-fold desc="Game Management">

    /**
     * Returns whether the Lobby is currently in a game.
     */
    synchronized public boolean isInGame() {
        return game != null;
    }

    /**
     * Starts a new SecretHitlerGame with the setup-lobby users as players.
     */
    synchronized public void startNewGame() {
        if (lobbyUsernames.size() > SecretHitlerGame.MAX_PLAYERS) {
            throw new RuntimeException("Too many users to start a game.");
        } else if (isInGame()) {
            throw new RuntimeException("Cannot start a new game while a game is in progress.");
        }

        for (String username : lobbyUsernames) {
            if (DEFAULT_ICON.equals(usernameToIcon.get(username))) {
                throw new RuntimeException("Not all players have selected icons.");
            }
        }

        usersInGame.clear();
        usersInGame.addAll(lobbyUsernames);
        clearBotControlForGame();

        List<String> cpuNames = new ArrayList<>();
        if (usersInGame.size() < SecretHitlerGame.MIN_PLAYERS) {
            int numCpuPlayersToGenerate = SecretHitlerGame.MIN_PLAYERS - usersInGame.size();
            int i = 1;
            while (numCpuPlayersToGenerate > 0) {
                String botName = "Bot " + i;
                if (!lobbyUsernames.contains(botName)) {
                    cpuNames.add(botName);
                    generatedBotPlayers.add(botName);
                    numCpuPlayersToGenerate--;
                }
                i++;
            }
        }

        List<String> playerNames = new ArrayList<>(lobbyUsernames);
        playerNames.addAll(cpuNames);
        Collections.shuffle(playerNames);

        game = new SecretHitlerGame(playerNames);

        for (String botName : generatedBotPlayers) {
            game.getPlayer(botName).setType(Player.Type.BOT);
            CpuPlayer cpu = new CpuPlayer(botName);
            cpuControllersByName.put(botName, cpu);
            cpu.initialize(game);
        }
    }

    /**
     * Returns the current game.
     */
    synchronized public SecretHitlerGame game() {
        if (game == null) {
            throw new RuntimeException();
        }
        return game;
    }

    // </editor-fold>
}

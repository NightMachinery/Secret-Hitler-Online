package server.util;

import game.CpuPlayer;
import game.GameState;
import game.SecretHitlerGame;
import game.datastructures.Player;
import io.javalin.websocket.WsContext;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import server.SecretHitlerServer;

import java.io.IOException;
import java.io.Serializable;
import java.util.*;
import java.util.Map.Entry;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
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

    // These two marked transient because they track currently active/connected
    // users.
    transient private ConcurrentHashMap<WsContext, String> userToUsername;
    transient private Queue<String> activeUsernames;

    final private Set<String> usersInGame;
    final private ConcurrentHashMap<String, String> usernameToIcon;
    private ConcurrentHashMap<String, String> usernameToAuthToken;
    private String creatorUsername;
    private Set<String> botControlledPlayers;
    private Set<String> generatedBotPlayers;
    private ConcurrentHashMap<String, CpuPlayer> cpuControllersByName;

    private HistoryDisplayConfig historyDisplayConfig;

    /* Used to reassign users to previously chosen images if they disconnect */
    final private ConcurrentHashMap<String, String> usernameToPreferredIcon;

    public static long LOBBY_TIMEOUT_DURATION_IN_MIN = 72 * 60;
    public static float PLAYER_TIMEOUT_IN_SEC = 3;
    public static float CPU_ACTION_DELAY_IN_SEC = 4;
    private long timeout;

    private static Logger logger = LoggerFactory.getLogger(Lobby.class);

    private static int MAX_TIMER_SCHEDULING_ATTEMPTS = 2;
    transient private Timer userTimeoutTimer = new Timer();
    transient private Timer cpuTickTimer = new Timer();

    static String DEFAULT_ICON = "p_default";

    /**
     * Constructs a new Lobby.
     */
    public Lobby() {
        this(HistoryDisplayConfig.defaultConfig());
    }

    public Lobby(HistoryDisplayConfig historyDisplayConfig) {
        userToUsername = new ConcurrentHashMap<WsContext, String>();
        activeUsernames = new ConcurrentLinkedQueue<>();
        usersInGame = new ConcurrentSkipListSet<>();
        usernameToIcon = new ConcurrentHashMap<>();
        usernameToAuthToken = new ConcurrentHashMap<>();
        creatorUsername = null;
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
        // The timeout duration for the server. (currently 30 minutes)
        long MS_PER_MINUTE = 1000 * 60;
        timeout = System.currentTimeMillis() + MS_PER_MINUTE * LOBBY_TIMEOUT_DURATION_IN_MIN;
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
     * 
     * @return a set of WsContexts, where each context is a user connected to the
     *         Lobby.
     */
    synchronized public Set<WsContext> getConnections() {
        return userToUsername.keySet();
    }

    /**
     * Returns the list of usernames currently in the lobby or game. Includes
     * bot names if the game is running and has bots.
     */
    synchronized public List<String> getUserNames() {
        if (game != null) {
            return game.getPlayerList().stream().map(player -> player.getUsername()).collect(Collectors.toList());
        } else {
            return new ArrayList<String>(userToUsername.values());
        }
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

    private void initializeCreatorIfUnset(String name) {
        if (creatorUsername == null && name != null && !name.isBlank()) {
            creatorUsername = name;
        }
    }

    /////// User Management
    // <editor-fold desc="User Management">

    /**
     * Returns whether the given user (websocket connection) is in this lobby
     * 
     * @param context the Websocket context of a user.
     * @return true iff the {@code context} is in this lobby.
     */
    synchronized public boolean hasUser(WsContext context) {
        return userToUsername.containsKey(context);
    }

    /**
     * Returns whether a user with the given name exists in this lobby.
     * 
     * @param context the Websocket context of the user.
     * @param name    the name of the user.
     * @return true iff {@code context} is a user in the lobby with the name
     *         {@code name}.
     */
    synchronized public boolean hasUser(WsContext context, String name) {
        return userToUsername.containsKey(context) && userToUsername.get(context).equals(name);
    }

    /**
     * Returns true if the lobby has a user with a given username.
     * 
     * @param name the username to check the Lobby for.
     * @return true iff the username {@code name} is in this lobby.
     */
    synchronized public boolean hasUserWithName(String name) {
        return userToUsername.values().contains(name);
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
     * If the name has no stored token yet, it is considered available.
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

    /**
     * Returns all currently connected sockets for the provided username.
     */
    synchronized public List<WsContext> getConnectionsForName(String name) {
        List<WsContext> out = new ArrayList<>();
        for (Entry<WsContext, String> entry : userToUsername.entrySet()) {
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
            game.getPlayer(name).markAsCpu();
        }
        botControlledPlayers.add(name);
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
     * 
     * @param name the name of the user to add.
     * @return true if the user can be added. A user can only be added back if they
     *         were in the current game but were then
     *         removed from the lobby.
     *
     */
    synchronized public boolean canAddUserDuringGame(String name) {
        return (usersInGame.contains(name) && !activeUsernames.contains(name)); // the user was in the game but was
                                                                                // disconnected.
    }

    /**
     * Checks if a user can be added as an observer while a game is running.
     *
     * @param name the name of the user to add.
     * @return true if the user can be added as an observer.
     */
    synchronized public boolean canAddObserverDuringGame(String name) {
        if (name == null || name.isBlank()) {
            return false;
        }
        // Observers are users that are not players from this game.
        return isInGame() && !usersInGame.contains(name);
    }

    /**
     * Checks whether the lobby is full.
     * 
     * @return Returns true if the number of players in the lobby is {@literal >= }
     *         {@code SecretHitlerGame.MAX_PLAYERS}.
     */
    synchronized public boolean isFull() {
        return activeUsernames.size() >= SecretHitlerGame.MAX_PLAYERS;
    }

    /**
     * Adds a user (websocket connection) to the lobby.
     * 
     * @param context the websocket connection context.
     * @param name    the name of the player to be added.
     * @throws IllegalArgumentException if a duplicate websocket is added, if there
     *                                  is already a websocket with the
     *                                  given name in the game, if the lobby is
     *                                  full, if the player has a duplicate name,
     *                                  or if a new player is added during a game.
     * @modifies this
     * @effects adds the given user to the lobby.
     *          If the game has already started, the player can only join if a
     *          player with the name {@name} was
     *          previously in the same game but was removed.
     */
    synchronized public void addUser(WsContext context, String name) {
        if (userToUsername.containsKey(context)) {
            throw new IllegalArgumentException("Duplicate websockets cannot be added to a lobby.");
        } else {
            if (isInGame()) {
                if (canAddUserDuringGame(name)) { // This username is in the game but is not currently connected.
                    // allow the user to be connected.
                    userToUsername.put(context, name);
                    initializeCreatorIfUnset(name);

                    usernameToIcon.put(name, DEFAULT_ICON); // load default icon
                    // Try setting the player's icon using their previous choice
                    if (usernameToPreferredIcon.containsKey(name)) {
                        String iconID = usernameToPreferredIcon.get(name);
                        trySetUserIcon(iconID, context);
                    }
                } else if (canAddObserverDuringGame(name)) {
                    // Allow non-player spectators to join active games.
                    userToUsername.put(context, name);
                    initializeCreatorIfUnset(name);

                    usernameToIcon.put(name, DEFAULT_ICON);
                    if (usernameToPreferredIcon.containsKey(name)) {
                        String iconID = usernameToPreferredIcon.get(name);
                        trySetUserIcon(iconID, context);
                    }
                } else {
                    throw new IllegalArgumentException("Cannot add a new player to a lobby currently in a game.");
                }
            } else {
                if (!isFull()) {
                    if (!hasUserWithName(name)) { // This is a new user with a new name, so we add them to the Lobby.
                        userToUsername.put(context, name);
                        initializeCreatorIfUnset(name);
                        if (!activeUsernames.contains(name)) {
                            activeUsernames.add(name);
                        }
                        // Set icon to default
                        usernameToIcon.put(name, DEFAULT_ICON);
                        // Attempt to retrieve previous icon (if it exists)
                        if (usernameToPreferredIcon.containsKey(name)) {
                            String iconID = usernameToPreferredIcon.get(name);
                            trySetUserIcon(iconID, context);
                        }
                    } else {
                        throw new IllegalArgumentException("Cannot add duplicate names.");
                    }
                } else {
                    throw new IllegalArgumentException("Cannot add the player because the lobby is full.");
                }
            }
        }
    }

    /**
     * Adds a connected websocket context for a user whose identity has already
     * been verified by token ownership.
     * This is used for force-rejoin/replace flows.
     */
    synchronized public void addOrReplaceConnectedUser(WsContext context, String name) {
        if (userToUsername.containsKey(context)) {
            throw new IllegalArgumentException("Duplicate websockets cannot be added to a lobby.");
        }
        userToUsername.put(context, name);
        initializeCreatorIfUnset(name);
        if (!isInGame() && !activeUsernames.contains(name)) {
            activeUsernames.add(name);
        }
        usernameToIcon.put(name, DEFAULT_ICON);
        if (usernameToPreferredIcon.containsKey(name)) {
            String iconID = usernameToPreferredIcon.get(name);
            trySetUserIcon(iconID, context);
        }
    }

    /**
     * Removes a websocket context immediately without scheduling delayed user
     * removal.
     */
    synchronized public void removeUserImmediately(WsContext context) {
        userToUsername.remove(context);
    }

    /**
     * Removes a user from the Lobby.
     * 
     * @param context the websocket connection context of the player to remove.
     * @throws IllegalArgumentException if {@code context} is not a user in the
     *                                  Lobby.
     * @modifies this
     * @effects removes the user context (websocket connection) of the player from
     *          the lobby.
     */
    synchronized public void removeUser(WsContext context) {
        if (!hasUser(context)) {
            throw new IllegalArgumentException("Cannot remove a websocket that is not in the Lobby.");
        } else {
            // Delay removing players from the list by adding it to a timer.
            int delay_in_ms = (int) (PLAYER_TIMEOUT_IN_SEC * 1000);
            final String username = userToUsername.get(context);

            int timerSchedulingAttempts = 0;
            while (timerSchedulingAttempts < MAX_TIMER_SCHEDULING_ATTEMPTS) {
                try {
                    userTimeoutTimer.schedule(new RemoveUserTask(username), delay_in_ms);
                    break; // exit loop if successful
                } catch (IllegalStateException e) {
                    // Timer hit an error state and must be reset.
                    userTimeoutTimer.cancel();
                    userTimeoutTimer = new Timer();
                    timerSchedulingAttempts++;
                }
            }
            if (timerSchedulingAttempts == MAX_TIMER_SCHEDULING_ATTEMPTS) {
                System.out.println("Failed to schedule removal of the user '" + username + "'.");
            }

            userToUsername.remove(context);
        }
    }

    /**
     * Small helper class for removing users from the active users queue.
     */
    class RemoveUserTask extends TimerTask {
        private final String username;

        RemoveUserTask(String username) {
            this.username = username;
        }

        public void run() {
            // If the user is still disconnected when the task runs, mark them as inactive
            // and
            // remove them from the lobby.
            if (!userToUsername.values().contains(username) && activeUsernames.contains(username)) {
                activeUsernames.remove(username);

                if (usernameToIcon.containsKey(username)) {
                    usernameToIcon.remove(username); // possible for users to disconnect before choosing icon
                }
                updateAllUsers();
            }
        }
    }

    /**
     * Returns the number of active users connected to the Lobby.
     * 
     * @return the number of active websocket connections currently in the lobby.
     */
    synchronized public int getUserCount() {
        return activeUsernames.size();
    }

    /**
     * Sends a message to every connected user with the current game state.
     * 
     * @effects a message containing a JSONObject representing the state of the
     *          SecretHitlerGame is sent
     *          to each connected WsContext.
     *          ({@code GameToJSONConverter.convert()}). Also
     *          updates all connected CpuPlayers after a set amount of time.
     */
    synchronized public void updateAllUsers() {
        for (Entry<WsContext, String> entry : userToUsername.entrySet()) {
            updateUser(entry.getKey(), entry.getValue());
        }

        // Check if the game ended.
        if (game != null && game.hasGameFinished()) {
            game = null;
            clearBotControlForGame();
        }

        // Update all the CpuPlayers so they can act
        boolean didCpuUpdateState = false;
        if (isInGame()) {
            // Update all CPUs before allowing them to start acting
            List<CpuPlayer> activeCpuControllers = new ArrayList<>();
            for (Entry<String, CpuPlayer> entry : cpuControllersByName.entrySet()) {
                if (shouldCpuActForPlayer(entry.getKey())) {
                    activeCpuControllers.add(entry.getValue());
                }
            }
            for (CpuPlayer cpu : activeCpuControllers) {
                cpu.update(game);
            }
            for (CpuPlayer cpu : activeCpuControllers) {
                if (game.getState() == GameState.CHANCELLOR_VOTING) {
                    // We're in a voting step, so it doesn't matter if the CPU is
                    // acting unless the gamestate changes.
                    boolean stateUpdated = cpu.act(game);
                    // Did acting cause voting to end?
                    if (stateUpdated && game.getState() != GameState.CHANCELLOR_VOTING) {
                        didCpuUpdateState = true;
                        break;
                    }
                } else {
                    if (cpu.act(game)) {
                        didCpuUpdateState = true;
                        break;
                    }
                }
            }
        }

        if (didCpuUpdateState) {
            int delay_in_ms = (int) (CPU_ACTION_DELAY_IN_SEC * 1000);
            int timerSchedulingAttempts = 0;
            // Make multiple attempts to schedule the timer.
            while (timerSchedulingAttempts < MAX_TIMER_SCHEDULING_ATTEMPTS) {
                try {
                    cpuTickTimer.schedule(new updateUsersTask(), delay_in_ms);
                    break;
                } catch (IllegalStateException e) {
                    // Timer hit an error state and must be reset.
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
     * Small helper class for removing users from the active users queue.
     */
    class updateUsersTask extends TimerTask {
        public void run() {
            updateAllUsers();
        }
    }

    /**
     * Sends a message to the specified user with the current game state.
     * 
     * @param ctx the WsContext websocket context.
     * @effects a message containing a JSONObject representing the state of the
     *          SecretHitlerGame is sent
     *          to the specified WsContext. ({@code GameToJSONConverter.convert()})
     */
    synchronized public void updateUser(WsContext ctx, String userName) {
        JSONObject message;
        if (isInGame()) {
            message = GameToJSONConverter.convert(game, userName, getHistoryDisplayConfig(), this); // sends the game state
            message.put(SecretHitlerServer.PARAM_PACKET_TYPE, SecretHitlerServer.PACKET_GAME_STATE);
        } else {
            message = new JSONObject();
            message.put(SecretHitlerServer.PARAM_PACKET_TYPE, SecretHitlerServer.PACKET_LOBBY);
            message.put("usernames", activeUsernames.toArray());
        }
        // Add user icons to the update message
        JSONObject icons = new JSONObject(usernameToIcon);
        message.put("icon", icons);

        ctx.send(message.toString());
    }

    /**
     * Called when an object is deserialized (see Serializable in Java docs).
     * Initializes the userToUsername and activeUsernames, as they are transient
     * objects and not saved during
     * serialization of Lobby.
     * 
     * @param in the Object Input Stream that is reading in the object.
     * @throws IOException
     * @throws ClassNotFoundException
     */
    private void readObject(java.io.ObjectInputStream in) throws IOException, ClassNotFoundException {
        in.defaultReadObject();
        userToUsername = new ConcurrentHashMap<>();
        activeUsernames = new ConcurrentLinkedQueue<>();
        userTimeoutTimer = new Timer();
        cpuTickTimer = new Timer();
        if (usernameToAuthToken == null) {
            usernameToAuthToken = new ConcurrentHashMap<>();
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
        }
        if (historyDisplayConfig == null) {
            historyDisplayConfig = HistoryDisplayConfig.defaultConfig();
        }
    }

    /**
     * Attempts to set the player's icon to the given iconID and returns whether it
     * was set.
     * 
     * @param iconID the ID of the new icon to give the player.
     * @param user   the user to change the icon of.
     * @effects If no other user has the given {@code iconID}, sets the icon of the
     *          {@code user}
     *          to {@code iconID}. (exception is for the default value.)
     * @throws IllegalArgumentException if {@code user} is not in the game.
     */
    synchronized public void trySetUserIcon(String iconID, WsContext user) {
        // Verify that the user exists.
        if (!hasUser(user)) {
            throw new IllegalArgumentException("User is not in this lobby.");
        }

        String username = userToUsername.get(user);
        // Verify that no user has the same icon
        if (!iconID.equals(DEFAULT_ICON)) { // all icons other than the default cannot be shared.
            for (String name : userToUsername.values()) {
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
     * 
     * @return true iff the Lobby has a currently active game.
     */
    synchronized public boolean isInGame() {
        return game != null;
    }

    /**
     * Starts a new SecretHitlerGame with the connected users as players.
     * 
     * @throws RuntimeException if there are an insufficient number of players to
     *                          start a game, if there are too
     *                          many in the lobby, or if the lobby is in a game
     *                          ({@code isInGame() == true}). Also throws exception
     *                          if
     *                          not all players have selected an icon.
     * @modifies this
     * @effects creates and stores a new SecretHitlerGame.
     *          The usernames of all active users are added to the game in a
     *          randomized order.
     */
    synchronized public void startNewGame() {
        if (activeUsernames.size() > SecretHitlerGame.MAX_PLAYERS) {
            throw new RuntimeException("Too many users to start a game.");
        } else if (isInGame()) {
            throw new RuntimeException("Cannot start a new game while a game is in progress.");
        }

        // Check that all players have (non-default) icons set.
        for (String username : activeUsernames) {
            if (usernameToIcon.get(username).equals(DEFAULT_ICON)) {
                throw new RuntimeException("Not all players have selected icons.");
            }
        }

        usersInGame.clear();
        usersInGame.addAll(userToUsername.values());
        clearBotControlForGame();

        // Generate CpuPlayers if the lobby size has not been met
        List<String> cpuNames = new ArrayList<>();
        if (usersInGame.size() < SecretHitlerGame.MIN_PLAYERS) {
            int numCpuPlayersToGenerate = SecretHitlerGame.MIN_PLAYERS - usersInGame.size();
            int i = 1;
            while (numCpuPlayersToGenerate > 0) {
                String botName = "Bot " + i;
                if (!userToUsername.containsValue(botName)) {
                    cpuNames.add(botName);
                    generatedBotPlayers.add(botName);
                    numCpuPlayersToGenerate--;
                }
                i++;
            }
        }

        // Initialize the new game
        List<String> playerNames = new ArrayList<>(activeUsernames);
        playerNames.addAll(cpuNames);
        Collections.shuffle(playerNames);

        game = new SecretHitlerGame(playerNames);

        // Initialize all of the CpuPlayers
        for (String botName : generatedBotPlayers) {
            CpuPlayer cpu = new CpuPlayer(botName);
            cpuControllersByName.put(botName, cpu);
            cpu.initialize(game);
        }
    }

    /**
     * Returns the current game.
     * 
     * @throws RuntimeException if called when there is no active game
     *                          ({@code !this.isInGame()}).
     * @return the SecretHitlerGame for this lobby.
     */
    synchronized public SecretHitlerGame game() {
        if (game == null) {
            throw new RuntimeException();
        } else {
            return game;
        }
    }

    // </editor-fold>

}

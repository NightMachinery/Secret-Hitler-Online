package server;

import game.datastructures.Identity;
import io.javalin.Javalin;
import io.javalin.http.Context;
import io.javalin.websocket.WsCloseContext;
import io.javalin.websocket.WsConnectContext;
import io.javalin.websocket.WsContext;
import io.javalin.websocket.WsMessageContext;

import org.eclipse.jetty.websocket.api.StatusCode;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import server.util.Lobby;

import java.io.*;
import java.net.URI;
import java.sql.*;

import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;


public class SecretHitlerServer {

    ////// Static Fields
    // <editor-fold desc="Static Fields">
    // TODO: Replace this with an environment variable or environment flag
    public static final int DEFAULT_PORT_NUMBER = 4040;

    // Passed to server
    public static final String PARAM_LOBBY = "lobby";
    public static final String PARAM_NAME = "name";
    public static final String PARAM_TOKEN = "token";
    public static final String PARAM_COMMAND = "command";
    public static final String PARAM_TARGET = "target";
    public static final String PARAM_VOTE = "vote";
    public static final String PARAM_VETO = "veto";
    public static final String PARAM_CHOICE = "choice"; // the index of the chosen policy.
    public static final String PARAM_ICON = "icon";
    public static final String PARAM_ENABLED = "enabled";
    public static final String PARAM_OBSERVER = "observer";
    public static final String PARAM_REACTION = "reaction";
    public static final String PARAM_DURATION_SECONDS = "durationSeconds";
    public static final String PARAM_ALLOW_DEAD_PLAYERS = "allowDeadPlayers";
    public static final String PARAM_HISTORY_SHOW = "history-show";
    public static final String PARAM_HISTORY_SHOW_PRESIDENTIAL_ACTIONS = "history-show-presidential-actions";
    public static final String PARAM_HISTORY_SHOW_VOTE_BREAKDOWN = "history-show-vote-breakdown";
    public static final String PARAM_HISTORY_ROUNDS_TO_SHOW = "history-rounds-to-show";

    // Passed to client
    // The type of the packet tells the client how to parse the contents.
    public static final String PARAM_PACKET_TYPE = "type";
    public static final String PACKET_INVESTIGATION = "investigation";
    public static final String PACKET_GAME_STATE = "game";
    public static final String PACKET_LOBBY = "lobby";
    public static final String PACKET_OK = "ok"; // general response packet sent after any successful command.
    public static final String PACKET_PONG = "pong"; // response to pings.

    public static final String PARAM_INVESTIGATION = "investigation";
    public static final String FASCIST = "FASCIST";
    public static final String LIBERAL = "LIBERAL";

    // These are the commands that can be passed via a websocket connection.
    public static final String COMMAND_PING = "ping";
    public static final String COMMAND_START_GAME = "start-game";
    public static final String COMMAND_GET_STATE = "get-state";
    public static final String COMMAND_SET_LOBBY_SIZE = "set-lobby-size";
    public static final String COMMAND_SELECT_ICON = "select-icon";
    public static final String COMMAND_NOMINATE_CHANCELLOR = "nominate-chancellor";
    public static final String COMMAND_REGISTER_VOTE = "register-vote";
    public static final String COMMAND_REGISTER_PRESIDENT_CHOICE = "register-president-choice";
    public static final String COMMAND_REGISTER_CHANCELLOR_CHOICE = "register-chancellor-choice";
    public static final String COMMAND_REGISTER_CHANCELLOR_VETO = "chancellor-veto";
    public static final String COMMAND_REGISTER_PRESIDENT_VETO = "president-veto";

    public static final String COMMAND_REGISTER_EXECUTION = "register-execution";
    public static final String COMMAND_REGISTER_SPECIAL_ELECTION = "register-special-election";
    public static final String COMMAND_GET_INVESTIGATION = "get-investigation";
    public static final String COMMAND_REGISTER_PEEK = "register-peek";

    public static final String COMMAND_END_TERM = "end-term";
    public static final String COMMAND_SET_BOT_STATUS = "set-bot-status";
    public static final String COMMAND_SET_OBSERVER_ASSIGNMENT = "set-observer-assignment";
    public static final String COMMAND_SET_DISCUSSION_REACTION = "set-discussion-reaction";
    public static final String COMMAND_SET_DISCUSSION_REACTION_CONFIG = "set-discussion-reaction-config";
    public static final String COMMAND_LEAVE_LOBBY = "leave-lobby";
    public static final String COMMAND_SET_MODERATOR_STATUS = "set-moderator-status";
    public static final String COMMAND_KICK_USER = "kick-user";
    public static final String COMMAND_BAN_USER = "ban-user";
    public static final String COMMAND_RESET_BANS = "reset-bans";

    private static final String CODE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTWXYZ"; // u,v characters can look ambiguous
    private static final int CODE_LENGTH = 4;

    private static final float UPDATE_FREQUENCY_SECONDS = 60;
    // </editor-fold>

    ///// Private Fields
    // <editor-fold desc="Private Fields">

    transient private static ConcurrentHashMap<WsContext, Lobby> userToLobby = new ConcurrentHashMap<>();
    private static ConcurrentHashMap<String, Lobby> codeToLobby = new ConcurrentHashMap<>();

    private static final Logger logger = LoggerFactory.getLogger(SecretHitlerServer.class);

    transient private static boolean hasLobbyChanged;
    transient private static boolean databasePersistenceEnabled;

    // </editor-fold>

    ////// Private Methods

    /**
     * Prints the current list of lobbies and their players.
     */
    private static void printLobbyStatus() {
        synchronized (codeToLobby) {
            logger.info("Lobbies (" + codeToLobby.mappingCount() + ") : " + codeToLobby.keySet());
            for (Map.Entry<String, Lobby> entry : codeToLobby.entrySet()) {
                logger.debug("Lobby " + entry.getKey() + ": " + entry.getValue().getUserNames());
            }
        }
    }

    private static int getPortFromEnvironment() {
        String configuredPort = System.getenv("PORT");
        if (configuredPort != null) {
            return Integer.parseInt(configuredPort);
        }
        return DEFAULT_PORT_NUMBER;
    }

    public static void main(String[] args) {
        databasePersistenceEnabled = shouldEnableDatabasePersistence();

        // On load, check the connected database to see if there's a stored state from
        // the server.
        if (databasePersistenceEnabled) {
            loadDatabaseBackup();
        }
        removeInactiveLobbies(); // immediately clean in case of redundant lobbies.

        // Only initialize Javalin communication after the database has been queried.
        Javalin serverApp = Javalin.create(config -> {
            config.plugins.enableCors(cors -> {
                cors.add(it -> {
                    if (ApplicationConfig.DEBUG) {
                        it.anyHost();
                        return;
                    }
                    String allowedOrigins = System.getenv("CORS_ALLOWED_ORIGINS");
                    if (allowedOrigins != null && !allowedOrigins.isBlank()) {
                        String trimmed = allowedOrigins.trim();
                        if ("*".equals(trimmed)) {
                            it.anyHost();
                            return;
                        }
                        for (String origin : allowedOrigins.split(",")) {
                            String normalized = origin.trim();
                            if (!normalized.isEmpty()) {
                                it.allowHost(normalized);
                            }
                        }
                    } else {
                        logger.warn("CORS_ALLOWED_ORIGINS is not set. Allowing requests from any origin.");
                        it.anyHost();
                    }
                });
            });
        });

        String bindHost = ApplicationConfig.BIND_HOST;
        if (bindHost != null && !bindHost.isBlank()) {
            serverApp.start(bindHost.trim(), getPortFromEnvironment());
        } else {
            serverApp.start(getPortFromEnvironment());
        }

        serverApp.get("/check-login", SecretHitlerServer::checkLogin); // Checks if a login is valid.
        serverApp.get("/new-lobby", SecretHitlerServer::createNewLobby); // Creates and returns the code for a new lobby
        serverApp.get("/ping", SecretHitlerServer::ping);

        serverApp.ws("/game", wsHandler -> {
            wsHandler.onConnect(SecretHitlerServer::onWebsocketConnect);
            wsHandler.onMessage(SecretHitlerServer::onWebSocketMessage);
            wsHandler.onClose(SecretHitlerServer::onWebSocketClose);
        });

        // Add hook for termination that backs up the lobbies to the database.
        Runtime.getRuntime().addShutdownHook(new Thread() {
            public void run() {
                if (databasePersistenceEnabled) {
                    logger.info("Attempting to back up lobby data.");
                    storeDatabaseBackup();
                }
                printLobbyStatus();
            }
        });

        // Add timer for periodic updates.
        int delayMs = 0;
        int periodMs = (int) (UPDATE_FREQUENCY_SECONDS * 1000.0f);
        Timer timer = new Timer();
        timer.schedule(new TimerTask() {
            @Override
            public void run() {
                removeInactiveLobbies();
                if (!codeToLobby.isEmpty()) {
                    printLobbyStatus();
                }
                // If there are active lobbies, store a backup of the game.
                if (databasePersistenceEnabled && !codeToLobby.isEmpty() && hasLobbyChanged) {
                    storeDatabaseBackup();
                    hasLobbyChanged = false;
                }
            }
        }, delayMs, periodMs);
    }

    private static boolean shouldEnableDatabasePersistence() {
        if (ApplicationConfig.DISABLE_DATABASE_PERSISTENCE) {
            logger.info("Database persistence disabled by DISABLE_DATABASE_PERSISTENCE.");
            return false;
        }
        if (ApplicationConfig.DATABASE_URI == null || ApplicationConfig.DATABASE_URI.isBlank()) {
            logger.info("Database persistence disabled: DATABASE_URL is not set.");
            return false;
        }
        return true;
    }

    /**
     * Checks for and removes any lobbies that have timed out.
     * 
     * @effects For each lobby in the {@code codeToLobby} map, checks if the lobby
     *          has timed out.
     *          If so, closes all websockets associated with the lobby and removes
     *          them from the
     *          {@code userToLobby} map, then removes the lobby from the
     *          {@code codeToLobby} map.
     */
    private static void removeInactiveLobbies() {
        Set<String> removedLobbyCodes = new HashSet<>();
        int removedCount = 0;
        Iterator<Map.Entry<String, Lobby>> itr = codeToLobby.entrySet().iterator();
        while (itr.hasNext()) {
            Map.Entry<String, Lobby> entry = itr.next();
            Lobby lobby = entry.getValue();
            if (lobby.hasTimedOut()) {
                // Remove the websocket connections.
                for (WsContext ctx : lobby.getConnections()) {
                    ctx.session.close(StatusCode.NORMAL, "The lobby has timed out.");
                    userToLobby.remove(ctx);
                }
                removedLobbyCodes.add(entry.getKey());
                removedCount++;
                itr.remove();
            }
        }
        if (removedCount > 0) {
            logger.info(String.format("Removed %d inactive lobbies: %s", removedCount, removedLobbyCodes));
            printLobbyStatus();
            hasLobbyChanged = true;
        }
    }

    /////// Database Handling
    // <editor-fold desc="Database Handling">

    /**
     * Attempts to get a connection to the PostGres database.
     * 
     * @return null if no connection could be made.
     *         otherwise, returns a {@code java.sql.Connection} object.
     */
    private static Connection getDatabaseConnection() {
        // Get credentials from database or (if debug flag is set) via manual input.
        Connection c;
        try {
            URI databaseUri;
            String envUri = ApplicationConfig.DATABASE_URI;
            if (envUri == null || envUri.isBlank()) {
                logger.error("Could not connect to database: No ENV_DATABASE_URL environment variable provided.");
                return null;
            }
            databaseUri = new URI(envUri);

            String username = databaseUri.getUserInfo().split(":")[0];
            String password = databaseUri.getUserInfo().split(":")[1];
            String dbUrl = "jdbc:postgresql://" + databaseUri.getHost() + ':' + databaseUri.getPort()
                    + databaseUri.getPath();

            Class.forName("org.postgresql.Driver");
            c = DriverManager.getConnection(dbUrl, username, password);
            logger.info("Successfully connected to database.");
            return c;
        } catch (Exception e) {
            // Print failures no matter what
            logger.error("Failed to connect to database.", e);
            return null;
        }
    }

    /**
     * Loads lobby data stored in the database (intended to be run on server wake).
     * 
     * @effects {@code codeToLobby} is set to the stored database
     */
    @SuppressWarnings("unchecked")
    private static void loadDatabaseBackup() {
        // Get connection to the Postgres Database and select the backup data.
        Connection c = getDatabaseConnection();
        if (c == null) {
            return;
        }
        Statement stmt = null;

        try {
            // Initialize table, just in case
            initializeDatabase(c);

            stmt = c.createStatement();
            ResultSet rs = stmt.executeQuery("select * from backup;");
            rs.next(); // Will fail if there are no entries in the table, which is fine.

            String timestamp = rs.getString("timestamp");
            int numAttempts = rs.getInt("attempts");
            byte[] lobbyBytes = rs.getBytes("lobby_bytes");
            logger.info("Loaded backup from " + timestamp + ".");
            rs.close();
            stmt.close();

            // Update the number of attempts that have been made, for debugging.
            stmt = c.createStatement();
            stmt.executeUpdate("UPDATE backup SET attempts = '" + (numAttempts + 1) + "';");
            stmt.close();
            c.close();

            // Deserialize the data and convert to lobbies.
            // (Use try-with-resources to ensure streams are closed even if an error
            // occurs.)
            try (
                    ByteArrayInputStream lobbyByteStream = new ByteArrayInputStream(lobbyBytes);
                    ObjectInputStream objectStream = new ObjectInputStream(lobbyByteStream)) {
                codeToLobby = (ConcurrentHashMap<String, Lobby>) objectStream.readObject();
                objectStream.close();
                logger.debug("Successfully parsed lobby data from the database.");
            } catch (Exception e) {
                logger.error("Failed to parse lobby data from stored backup.", e);
            }

        } catch (Exception e) {
            logger.error("Failed to retrieve lobby backups from the database.", e);
        }
        printLobbyStatus();
    }

    private static void storeDatabaseBackup() {
        ByteArrayOutputStream byteBuilder = new ByteArrayOutputStream();
        try {
            // Serialize the Lobby data.
            ObjectOutputStream objectOutputStream = new ObjectOutputStream(byteBuilder);
            objectOutputStream.writeObject(codeToLobby);
            objectOutputStream.flush();
            objectOutputStream.close();
            byteBuilder.flush();
            // No need to close bytebuilder (close has no effect)
        } catch (Exception e) {
            logger.error("Failed to serialize the Lobby data.", e);
            return;
        }
        byte[] lobbyData = byteBuilder.toByteArray();
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        String timestamp = formatter.format(new Timestamp(System.currentTimeMillis()));
        int attempts = 0;

        Connection c = getDatabaseConnection();
        if (c == null) {
            return;
        }
        try {
            String queryStr = "INSERT INTO BACKUP (id, timestamp, attempts, lobby_bytes)" +
                    "VALUES (0, ?, ?, ?) " +
                    "ON CONFLICT (id) DO UPDATE " +
                    "SET timestamp = excluded.timestamp, " +
                    "attempts = excluded.attempts, " +
                    "lobby_bytes = excluded.lobby_bytes; ";
            PreparedStatement pstmt = c.prepareStatement(queryStr);
            int i = 1;
            pstmt.setString(i++, timestamp);
            pstmt.setInt(i++, attempts);
            pstmt.setBytes(i++, lobbyData);
            pstmt.executeUpdate();
            c.close();
        } catch (Exception e) {
            logger.error("Failed to store the Lobby data in the database.", e);
            return;
        }
        logger.debug("Successfully saved Lobby state to the database.");
    }

    /**
     * Initializes the database by adding the BACKUP table.
     * 
     * @param c the connection to the database.
     * @effects the Postgres SQL datbase has a new
     */
    private static void initializeDatabase(Connection c) throws SQLException {
        Statement stmt = c.createStatement();
        stmt.executeUpdate("create table if not exists backup " +
                "(id INT UNIQUE, timestamp TEXT, attempts INT, lobby_bytes BYTEA);");
        stmt.close();
    }

    // </editor-fold>

    /////// Get Requests
    // <editor-fold desc="Get Requests">

    /**
     * Pings the server (intended to wake the inactive server)
     * 
     * @param ctx the context of the login request
     * @effects Returns the message "OK" with status code 200.
     */
    public static void ping(Context ctx) {
        ctx.status(200);
        ctx.result("OK");
    }

    /**
     * Determines whether a login is valid.
     * 
     * @param ctx the context of the login request.
     * @requires the context must have the following parameters:
     *           {@code lobby}: the code of the lobby.
     *           {@code name}: the username of the user.
     *           {@code command}: the command
     * @effects Result status is one of the following:
     *          <p>
     *          - 400: if the {@code lobby} or {@code name} parameters are
     *          missing (or blank).
     *          <p>
     *          - 404: if there is no lobby with the given code
     *          <p>
     *          - 403: the username is invalid (there is already another user
     *          with that name in the lobby.)
     *          <p>
     *          - 488: the lobby is currently in a game.
     *          <p>
     *          - 489: the lobby is full.
     *          <p>
     *          - 200: Success. There is a lobby with the given name and the
     *          user can open a websocket connection with these login
     *          credentials.
     */
    public static void checkLogin(Context ctx) {
        String lobbyCode = ctx.queryParam(PARAM_LOBBY);
        String name = ctx.queryParam(PARAM_NAME);
        String token = ctx.queryParam(PARAM_TOKEN);
        if (lobbyCode == null || name == null || name.isEmpty() || name.isBlank()
                || token == null || token.isBlank()) {
            ctx.status(400);
            ctx.result("Lobby, name, and token must be specified.");
            return;
        }

        if (!codeToLobby.containsKey(lobbyCode)) { // lobby does not exist
            ctx.status(404);
            ctx.result("No such lobby found.");
        } else { // the lobby exists
            Lobby lobby = codeToLobby.get(lobbyCode);

            if (lobby.isTokenBanned(token)) {
                ctx.status(490);
                ctx.result("This session has been banned from the lobby.");
                return;
            }

            if (!lobby.canUseNameWithToken(name, token)) {
                ctx.status(403);
                ctx.result("This name is protected by another session token.");
                return;
            }

            if (lobby.isInGame()) {
                if (lobby.hasUserWithName(name)) {
                    ctx.status(200);
                    ctx.result("Login request valid (replacing active session).");
                } else if (lobby.wasUserInCurrentGame(name)) {
                    ctx.status(200);
                    ctx.result("Login request valid (re-joining an existing game).");
                } else if (lobby.canAddObserverDuringGame(name)) {
                    ctx.status(200);
                    ctx.result("Login request valid (joining as observer).");
                } else {
                    ctx.status(488);
                    ctx.result("The lobby is currently in a game.");
                }
            } else if (lobby.hasLobbyMember(name)) {
                ctx.status(200);
                ctx.result("Login request valid (rejoining the setup lobby).");
            } else if (lobby.isFull()) {
                ctx.status(489);
                ctx.result("The lobby is currently full.");
            } else { // unique username found. Return OK.
                ctx.status(200);
                ctx.result("Login request valid.");
            }
        }
    }

    /**
     * Generates a new lobby and returns the access code.
     * 
     * @param ctx the HTTP get request context.
     */
    public static void createNewLobby(Context ctx) {
        removeInactiveLobbies();
        hasLobbyChanged = true;

        String newCode = generateCode();
        while (codeToLobby.containsKey(newCode)) {
            newCode = generateCode();
        }

        Lobby lobby = new Lobby(parseHistoryDisplayConfig(ctx));
        codeToLobby.put(newCode, lobby); // add a new lobby with the given code.

        ctx.status(200);
        ctx.result(newCode);
        logger.info("New lobby created: " + newCode);
        logger.info("Available lobbies: " + codeToLobby.keySet());
    }

    private static boolean parseBooleanQueryParam(Context ctx, String paramName, boolean defaultValue) {
        String value = ctx.queryParam(paramName);
        if (value == null) {
            return defaultValue;
        }
        String normalized = value.trim().toLowerCase();
        if (normalized.equals("true") || normalized.equals("1") || normalized.equals("y")
                || normalized.equals("yes")) {
            return true;
        } else if (normalized.equals("false") || normalized.equals("0") || normalized.equals("n")
                || normalized.equals("no")) {
            return false;
        } else {
            return defaultValue;
        }
    }

    private static Lobby.HistoryDisplayConfig parseHistoryDisplayConfig(Context ctx) {
        boolean showHistory = parseBooleanQueryParam(ctx, PARAM_HISTORY_SHOW, true);
        boolean showPublicActions = parseBooleanQueryParam(ctx, PARAM_HISTORY_SHOW_PRESIDENTIAL_ACTIONS, true);
        boolean showVoteBreakdown = parseBooleanQueryParam(ctx, PARAM_HISTORY_SHOW_VOTE_BREAKDOWN, true);
        Lobby.HistoryDisplayConfig.RoundsToShow roundsToShow = Lobby.HistoryDisplayConfig.RoundsToShow
                .fromString(ctx.queryParam(PARAM_HISTORY_ROUNDS_TO_SHOW));
        return new Lobby.HistoryDisplayConfig(showHistory, showPublicActions, showVoteBreakdown, roundsToShow);
    }

    /**
     * Generates a random code.
     * 
     * @return a String code, with length specified by {@code this.CODE_LENGTH} and
     *         characters randomly
     *         chosen from {@code CODE_CHARACTERS}.
     */
    private static String generateCode() {
        StringBuilder builder = new StringBuilder();
        while (builder.length() < CODE_LENGTH) {
            int index = (int) (Math.random() * CODE_CHARACTERS.length());
            builder.append(CODE_CHARACTERS.charAt(index));
        }
        return builder.toString();
    }

    // </editor-fold>

    /////// Websocket Handling
    // <editor-fold desc="Websocket Handling">

    /**
     * Called when a websocket connects to the server.
     * 
     * @param ctx the WsConnectContext of the websocket.
     * @requires the context must have the following parameters:
     *           {@code lobby}: a String representing the lobby code.
     *           {@code name}: a String username. Cannot already exist in the given
     *           lobby.
     * @effects Closes the websocket session if:
     *          <p>
     *          - 400 if the {@code lobby} or {@code name} parameters are missing.
     *          <p>
     *          - 404 if there is no lobby with the given code
     *          <p>
     *          - 403 the username is invalid (there is already another user
     *          with that name in the lobby).
     *          <p>
     *          - 488 if the lobby is currently in a game and the user is not
     *          a rejoining player.
     *          <p>
     *          - 489 if the lobby is full.
     *          <p>
     *          Otherwise, connects the user to the lobby.
     */
    private static void onWebsocketConnect(WsConnectContext ctx) {
        if (ctx.queryParam(PARAM_LOBBY) == null || ctx.queryParam(PARAM_NAME) == null
                || ctx.queryParam(PARAM_TOKEN) == null) {
            logger.debug("A websocket request was missing a parameter and was disconnected.");
            ctx.session.close(StatusCode.PROTOCOL,
                    "Must have the '" + PARAM_LOBBY + "', '" + PARAM_NAME + "', and '" + PARAM_TOKEN + "' parameters.");
            return;
        }

        // Sanitize user input
        String code = ctx.queryParam(PARAM_LOBBY);
        String name = ctx.queryParam(PARAM_NAME);
        String token = ctx.queryParam(PARAM_TOKEN);

        if (code == null || name == null || token == null
                || name.isEmpty() || name.isBlank()
                || token.isBlank()) {
            logger.debug("FAILED (Lobby, name, or token is empty/null)");
            ctx.session.close(StatusCode.PROTOCOL, "Lobby, name, and token must be specified.");
            return;
        }

        logger.debug("Attempting to connect user '" + name + "' to lobby '" + code + "': ");
        if (!codeToLobby.containsKey(code)) { // the lobby does not exist.
            logger.debug("FAILED (The lobby does not exist)");
            ctx.session.close(StatusCode.PROTOCOL, "The lobby '" + code + "' does not exist.");
            return;
        }

        Lobby lobby = codeToLobby.get(code);
        synchronized (lobby) {
            if (lobby.isTokenBanned(token)) {
                logger.debug("FAILED (Banned token)");
                ctx.session.close(StatusCode.PROTOCOL, "This session has been banned from the lobby.");
                return;
            }

            if (!lobby.canUseNameWithToken(name, token)) {
                logger.debug("FAILED (Invalid token for username)");
                ctx.session.close(StatusCode.PROTOCOL, "This name is protected by another session token.");
                return;
            }

            boolean replacingActiveConnection = lobby.hasUserWithName(name);
            boolean forceAttachUsingToken = replacingActiveConnection;

            if (lobby.isInGame()) {
                boolean tokenVerifiedGamePlayer = lobby.wasUserInCurrentGame(name)
                        && (lobby.hasMatchingAuthToken(name, token) || !lobby.hasKnownName(name));

                if (!replacingActiveConnection
                        && !tokenVerifiedGamePlayer
                        && !lobby.canAddObserverDuringGame(name)) {
                    logger.debug("FAILED (Lobby in game)");
                    ctx.session.close(StatusCode.PROTOCOL, "The lobby " + code + " is currently in a game.");
                    return;
                }

                // If this is a known game player with a valid token, allow immediate
                // re-attach even before timeout-based cleanup completes.
                if (!replacingActiveConnection && tokenVerifiedGamePlayer && !lobby.canAddUserDuringGame(name)) {
                    forceAttachUsingToken = true;
                }
            } else {
                boolean rejoiningSetupLobby = lobby.hasLobbyMember(name)
                        && (lobby.hasMatchingAuthToken(name, token) || !lobby.hasKnownName(name));
                forceAttachUsingToken = forceAttachUsingToken || rejoiningSetupLobby;

                if (!replacingActiveConnection && !rejoiningSetupLobby && lobby.isFull()) {
                    logger.debug("FAILED (Lobby is full)");
                    ctx.session.close(StatusCode.PROTOCOL, "The lobby " + code + " is currently full.");
                    return;
                }
            }

            if (replacingActiveConnection) {
                for (WsContext priorCtx : lobby.getConnectionsForName(name)) {
                    priorCtx.session.close(StatusCode.NORMAL, "Replaced by a newer session.");
                    lobby.removeUserImmediately(priorCtx);
                    userToLobby.remove(priorCtx);
                }
            }

            lobby.bindAuthTokenIfAbsent(name, token);
            if (forceAttachUsingToken) {
                lobby.addOrReplaceConnectedUser(ctx, name);
            } else {
                lobby.addUser(ctx, name);
            }
            logger.debug("SUCCESS");
            userToLobby.put(ctx, lobby); // keep track of which lobby this connection is in.
            lobby.updateAllUsers();
            hasLobbyChanged = true;
        }
    }

    /**
     * Parses a websocket message sent from the user.
     * 
     * @param ctx the WsMessageContext of the websocket.
     * @requires the context must have the following parameters:
     *           {@code lobby}: a String representing the lobby code.
     *           {@code name}: a String username. Cannot already exist in the given
     *           lobby.
     *           {@code command}: a String command.
     * @modifies this
     * @effects Ends the websocket command with code 400 if the specified lobby does
     *          not exist, the user is not allowed
     *          to make this action (usually because they are not a
     *          president/chancellor), if a required parameter is
     *          missing, or the command cannot be executed in this state.
     *          <p>
     *          Updates the game state according to the specified command and
     *          updates every other connected user
     *          with the new state.
     */
    private static void onWebSocketMessage(WsMessageContext ctx) {
        // Parse message to JSON object.
        JSONObject message = new JSONObject(ctx.message());

        if (message.getString(PARAM_LOBBY) == null
                || message.getString(PARAM_NAME) == null
                || message.getString(PARAM_COMMAND) == null) {
            logger.warn("Message request failed: missing a parameter.");
            ctx.session.close(StatusCode.PROTOCOL, "A required parameter is missing.");
            return;
        }

        String name = message.getString(PARAM_NAME);
        String lobbyCode = message.getString(PARAM_LOBBY);

        String logMessage = "Received a message from user '" + name + "' in lobby '" + lobbyCode + "' ("
                + ctx.message() + "): ";

        if (!codeToLobby.containsKey(lobbyCode)) {
            logger.debug(logMessage + " FAILED (Lobby requested does not exist)");
            ctx.session.close(StatusCode.PROTOCOL, "The lobby does not exist.");
            return;
        }

        Lobby lobby = codeToLobby.get(lobbyCode);

        synchronized (lobby) {
            if (!lobby.hasUser(ctx, name)) {
                logger.debug(logMessage + " FAILED (Lobby does not have the user)");
                ctx.session.close(StatusCode.PROTOCOL, "The user is not in the lobby " + lobbyCode + ".");
                return;
            }

            lobby.resetTimeout();

            boolean updateUsers = true; // this flag can be disabled by certain commands.
            boolean sendOKMessage = true;
            boolean closeCurrentSocketAfterCommand = false;
            String closeCurrentSocketReason = null;
            try {
                String command = message.getString(PARAM_COMMAND);
                switch (command) {
                    case COMMAND_PING:
                        sendOKMessage = false;
                        updateUsers = false;
                        JSONObject msg = new JSONObject();
                        msg.put(PARAM_PACKET_TYPE, PACKET_PONG);
                        ctx.send(msg.toString());
                        break;

                    case COMMAND_START_GAME: // Starts the game.
                        verifyIsModerator(name, lobby);
                        lobby.startNewGame();
                        break;

                    case COMMAND_LEAVE_LOBBY:
                        if (lobby.isInGame()) {
                            throw new RuntimeException("Cannot leave the setup lobby during an active game.");
                        }
                        lobby.leaveLobby(name);
                        lobby.removeUserImmediately(ctx);
                        userToLobby.remove(ctx);
                        sendOKMessage = false;
                        closeCurrentSocketAfterCommand = true;
                        closeCurrentSocketReason = "Left lobby.";
                        break;

                    case COMMAND_GET_STATE: // Requests the updated state of the game.
                        lobby.updateUser(ctx, name);
                        break;

                    case COMMAND_NOMINATE_CHANCELLOR: // params: PARAM_TARGET (String)
                        verifyIsPresident(requireActingPlayer(name, lobby), lobby);
                        lobby.game().nominateChancellor(message.getString(PARAM_TARGET));
                        break;

                    case COMMAND_REGISTER_VOTE: // params: PARAM_VOTE (boolean)
                        boolean vote = message.getBoolean(PARAM_VOTE);
                        lobby.game().registerVote(requireActingPlayer(name, lobby), vote);
                        break;

                    case COMMAND_REGISTER_PRESIDENT_CHOICE: // params: PARAM_CHOICE (int)
                        verifyIsPresident(requireActingPlayer(name, lobby), lobby);
                        int discard = message.getInt(PARAM_CHOICE);
                        lobby.game().presidentDiscardPolicy(discard);
                        break;

                    case COMMAND_REGISTER_CHANCELLOR_CHOICE: // params: PARAM_CHOICE (int)
                        verifyIsChancellor(requireActingPlayer(name, lobby), lobby);
                        int enact = message.getInt(PARAM_CHOICE);
                        lobby.game().chancellorEnactPolicy(enact);
                        break;

                    case COMMAND_REGISTER_CHANCELLOR_VETO:
                        verifyIsChancellor(requireActingPlayer(name, lobby), lobby);
                        lobby.game().chancellorVeto();
                        break;

                    case COMMAND_REGISTER_PRESIDENT_VETO: // params: PARAM_VETO (boolean)
                        verifyIsPresident(requireActingPlayer(name, lobby), lobby);
                        boolean veto = message.getBoolean(PARAM_VETO);
                        lobby.game().presidentialVeto(veto);
                        break;

                    case COMMAND_REGISTER_EXECUTION: // params: PARAM_TARGET (String)
                        verifyIsPresident(requireActingPlayer(name, lobby), lobby);
                        lobby.game().executePlayer(message.getString(PARAM_TARGET));
                        break;

                    case COMMAND_REGISTER_SPECIAL_ELECTION: // params: PARAM_TARGET (String)
                        verifyIsPresident(requireActingPlayer(name, lobby), lobby);
                        lobby.game().electNextPresident(message.getString(PARAM_TARGET));
                        break;

                    case COMMAND_GET_INVESTIGATION: // params: PARAM_TARGET (String)
                        verifyIsPresident(requireActingPlayer(name, lobby), lobby);
                        Identity id = lobby.game().investigatePlayer(message.getString(PARAM_TARGET));
                        // Construct and send a JSONObject.
                        JSONObject obj = new JSONObject();
                        obj.put(PARAM_PACKET_TYPE, PACKET_INVESTIGATION);
                        if (id == Identity.FASCIST) {
                            obj.put(PARAM_INVESTIGATION, FASCIST);
                        } else {
                            obj.put(PARAM_INVESTIGATION, LIBERAL);
                        }
                        obj.put(PARAM_TARGET, message.getString(PARAM_TARGET));
                        ctx.send(obj.toString());
                        break;

                    case COMMAND_REGISTER_PEEK:
                        verifyIsPresident(requireActingPlayer(name, lobby), lobby);
                        lobby.game().endPeek();
                        break;

                    case COMMAND_END_TERM:
                        verifyIsPresident(requireActingPlayer(name, lobby), lobby);
                        lobby.game().endPresidentialTerm();
                        break;

                    case COMMAND_SELECT_ICON:
                        String iconId = message.getString(PARAM_ICON);
                        lobby.trySetUserIcon(iconId, ctx);
                        break;

                    case COMMAND_SET_BOT_STATUS:
                        if (!lobby.isInGame()) {
                            throw new RuntimeException("Bot control can only be changed during an active game.");
                        }

                        String target = message.getString(PARAM_TARGET);
                        boolean enabled = message.getBoolean(PARAM_ENABLED);
                        if (target == null || target.isBlank()) {
                            throw new RuntimeException("Target player must be specified.");
                        }
                        if (!lobby.game().hasPlayer(target)) {
                            throw new RuntimeException("Player '" + target + "' is not in the current game.");
                        }
                        if (!lobby.game().getPlayer(target).isAlive()) {
                            throw new RuntimeException("Cannot modify bot control for dead player '" + target + "'.");
                        }
                        if (lobby.isGeneratedBotPlayer(target)) {
                            throw new RuntimeException("Cannot modify built-in bot player '" + target + "'.");
                        }

                        boolean actorIsCreator = lobby.isCreator(name);
                        if (enabled) {
                            if (!actorIsCreator) {
                                throw new RuntimeException("Only the creator can enable bot control for players.");
                            }
                        } else if (lobby.isSeatObserverControlled(target) && !actorIsCreator) {
                            throw new RuntimeException(
                                    "Only the creator can return an observer-controlled player to manual control.");
                        } else if (!actorIsCreator && !name.equals(target)) {
                            throw new RuntimeException("Only the creator or the target player can disable bot control.");
                        }
                        lobby.setTemporaryBotControl(target, enabled);
                        break;

                    case COMMAND_SET_OBSERVER_ASSIGNMENT:
                        if (!lobby.isInGame()) {
                            throw new RuntimeException("Observer control can only be changed during an active game.");
                        }
                        verifyIsModerator(name, lobby);
                        String observerTarget = message.getString(PARAM_TARGET);
                        String observer = message.has(PARAM_OBSERVER) && !message.isNull(PARAM_OBSERVER)
                                ? message.getString(PARAM_OBSERVER)
                                : null;
                        lobby.setObserverAssignment(observerTarget, observer);
                        break;

                    case COMMAND_SET_DISCUSSION_REACTION:
                        if (!lobby.isInGame()) {
                            throw new RuntimeException("Discussion reactions are only available during an active game.");
                        }
                        String reactingSeat = requireActingPlayer(name, lobby);
                        Lobby.DiscussionReactionType reactionType = Lobby.DiscussionReactionType
                                .fromString(message.getString(PARAM_REACTION));
                        lobby.setDiscussionReaction(reactingSeat, reactionType);
                        break;

                    case COMMAND_SET_DISCUSSION_REACTION_CONFIG:
                        if (!lobby.isInGame()) {
                            throw new RuntimeException("Discussion reaction settings are only available during an active game.");
                        }
                        verifyIsModerator(name, lobby);
                        int durationSeconds = message.getInt(PARAM_DURATION_SECONDS);
                        boolean allowDeadPlayers = message.getBoolean(PARAM_ALLOW_DEAD_PLAYERS);
                        lobby.setDiscussionReactionConfig(durationSeconds, allowDeadPlayers);
                        break;

                    case COMMAND_SET_MODERATOR_STATUS:
                        String moderatorTarget = message.getString(PARAM_TARGET);
                        boolean moderatorEnabled = message.getBoolean(PARAM_ENABLED);
                        verifyCanChangeModeratorStatus(name, moderatorTarget, moderatorEnabled, lobby);
                        lobby.setModeratorStatus(moderatorTarget, moderatorEnabled);
                        break;

                    case COMMAND_KICK_USER:
                        if (lobby.isInGame()) {
                            throw new RuntimeException("Players can only be removed from the setup lobby.");
                        }
                        verifyIsModerator(name, lobby);
                        String kickTarget = message.getString(PARAM_TARGET);
                        verifyCanRemoveFromLobby(name, kickTarget, lobby);
                        disconnectUserFromLobby(kickTarget, lobby, "Kicked from the lobby.");
                        lobby.kickUser(kickTarget, false);
                        break;

                    case COMMAND_BAN_USER:
                        if (lobby.isInGame()) {
                            throw new RuntimeException("Players can only be removed from the setup lobby.");
                        }
                        verifyIsModerator(name, lobby);
                        String banTarget = message.getString(PARAM_TARGET);
                        verifyCanRemoveFromLobby(name, banTarget, lobby);
                        disconnectUserFromLobby(banTarget, lobby, "Banned from the lobby.");
                        lobby.kickUser(banTarget, true);
                        break;

                    case COMMAND_RESET_BANS:
                        if (lobby.isInGame()) {
                            throw new RuntimeException("Ban management is only available in the setup lobby.");
                        }
                        verifyIsModerator(name, lobby);
                        lobby.clearBannedTokens();
                        break;

                    default: // This is an invalid command.
                        throw new RuntimeException("unrecognized command " + message.get(PARAM_COMMAND));
                } // End switch

                if (lobby.isBotControlled(name) && shouldAutoDisableBotControl(command)) {
                    lobby.disableTemporaryBotControl(name);
                }

                if (sendOKMessage) {
                    logger.debug(logMessage + " SUCCESS");
                    JSONObject msg = new JSONObject();
                    msg.put(PARAM_PACKET_TYPE, PACKET_OK);
                    ctx.send(msg.toString());
                }

                if (closeCurrentSocketAfterCommand) {
                    ctx.session.close(StatusCode.NORMAL, closeCurrentSocketReason == null ? "Connection closed."
                            : closeCurrentSocketReason);
                }

            } catch (NullPointerException e) {
                // Show error messages by default, since they indicate API access
                // issues.
                logger.error(logMessage + " FAILED", e);
                ctx.session.close(StatusCode.PROTOCOL, "NullPointerException:" + e.toString());
            } catch (RuntimeException e) {
                logger.error(logMessage + " FAILED", e);
                ctx.session.close(StatusCode.PROTOCOL, "RuntimeException:" + e.toString());
            }
            if (updateUsers) {
                lobby.updateAllUsers();
            }
        }
        hasLobbyChanged = true;
    }

    private static boolean shouldAutoDisableBotControl(String command) {
        return !COMMAND_PING.equals(command)
                && !COMMAND_GET_STATE.equals(command)
                && !COMMAND_SELECT_ICON.equals(command)
                && !COMMAND_SET_BOT_STATUS.equals(command)
                && !COMMAND_SET_OBSERVER_ASSIGNMENT.equals(command)
                && !COMMAND_SET_DISCUSSION_REACTION_CONFIG.equals(command);
    }

    // TODO: This is bad. This is bad code practice. Exceptions should not be
    // used for control flow.

    /**
     * Verifies that the user is the president.
     * 
     * @param name  String name of the user.
     * @param lobby the Lobby that the game is in.
     * @throws RuntimeException if the user is not the president.
     */
    private static void verifyIsPresident(String name, Lobby lobby) {
        if (!lobby.game().getCurrentPresident().equals(name)) {
            throw new RuntimeException("The player '" + name + "' is not currently president.");
        }
    }

    /**
     * Verifies that the user is the chancellor.
     * 
     * @param name  String name of the user.
     * @param lobby the Lobby that the game is in.
     * @throws RuntimeException if the user is not the chancellor.
     */
    private static void verifyIsChancellor(String name, Lobby lobby) {
        if (!lobby.game().getCurrentChancellor().equals(name)) {
            throw new RuntimeException("The player '" + name + "' is not currently chancellor.");
        }
    }

    private static void verifyIsModerator(String name, Lobby lobby) {
        if (!lobby.hasModeratorPrivileges(name)) {
            throw new RuntimeException("Only the creator or a moderator can do that.");
        }
    }

    private static String requireActingPlayer(String name, Lobby lobby) {
        String actingPlayer = lobby.getControlledPlayerForUser(name);
        if (actingPlayer == null) {
            throw new RuntimeException("Observers must be assigned to a seat to do that.");
        }
        if (!lobby.canUserAct(name)) {
            throw new RuntimeException("Your seat is currently being controlled by an observer.");
        }
        return actingPlayer;
    }

    private static void verifyCanChangeModeratorStatus(String actor, String target, boolean enabled, Lobby lobby) {
        if (target == null || target.isBlank()) {
            throw new RuntimeException("Target player must be specified.");
        }
        if (!lobby.canManageModeratorsTarget(target)) {
            throw new RuntimeException("Player '" + target + "' is not eligible for moderator status.");
        }
        if (lobby.isCreator(target)) {
            throw new RuntimeException("The creator cannot be promoted or demoted.");
        }
        if (enabled) {
            verifyIsModerator(actor, lobby);
            return;
        }
        if (!lobby.isCreator(actor)) {
            throw new RuntimeException("Only the creator can demote moderators.");
        }
    }

    private static void verifyCanRemoveFromLobby(String actor, String target, Lobby lobby) {
        if (target == null || target.isBlank()) {
            throw new RuntimeException("Target player must be specified.");
        }
        if (target.equals(actor)) {
            throw new RuntimeException("Use leave-lobby to remove yourself from the setup lobby.");
        }
        if (!lobby.hasLobbyMember(target)) {
            throw new RuntimeException("Player '" + target + "' is not in the setup lobby.");
        }
        if (lobby.isCreator(target)) {
            throw new RuntimeException("The creator cannot be kicked or banned.");
        }
    }

    private static void disconnectUserFromLobby(String target, Lobby lobby, String reason) {
        for (WsContext targetCtx : lobby.getConnectionsForName(target)) {
            targetCtx.session.close(StatusCode.NORMAL, reason);
            lobby.removeUserImmediately(targetCtx);
            userToLobby.remove(targetCtx);
        }
    }

    /**
     * Called when a websocket is closed.
     * 
     * @param ctx the WsContext of the websocket.
     * @modifies this
     * @effects Removes the user from any connected lobbies.
     */
    private static void onWebSocketClose(WsCloseContext ctx) {
        if (userToLobby.containsKey(ctx)) {
            Lobby lobby = userToLobby.get(ctx);
            synchronized (lobby) {
                if (lobby.hasUser(ctx)) {
                    lobby.removeUser(ctx);
                    lobby.updateAllUsers();
                }
            }
            userToLobby.remove(ctx);
        }
    }

    // </editor-fold>

}

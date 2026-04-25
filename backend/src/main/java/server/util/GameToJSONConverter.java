package server.util;

import game.GameState;
import game.SecretHitlerGame;
import game.datastructures.Identity;
import game.datastructures.Player;
import game.datastructures.Policy;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;
import java.util.Map;

/**
 * Converts a SecretHitlerGame to a JSONObject that represents the game state.
 */
public class GameToJSONConverter {
    /**
     * Creates a JSON object from a SecretHitlerGame that represents its state.
     * 
     * @param game the SecretHitlerGame to convert.
     * @param name the name of the user to create JSON content for. This is used
     *             to determine what player identity information to send to the
     *             user.
     * @throws NullPointerException if {@code game} is null.
     * @return a JSONObject with the following properties:
     *         - {@code state}: the state of the game.
     *         - {@code player-order}: an array of names representing the order of
     *         the players in the game.
     *
     *         - {@code players}: a JSONObject map, with keys that are a player's
     *         {@code username}.
     *         Each {@code username} key maps to an object with the properties
     *         {@code id} (String),
     *         {@code alive} (boolean), {@code investigated} (boolean), and
     *         {@code type} (String), to
     *         represent the player.
     *         The identity is either this.HITLER, this.FASCIST, or this.LIBERAL.
     *         Ex: {"player1":{"alive": true, "investigated": false, "id":
     *         "LIBERAL"}}.
     *
     *         - {@code president}: the username of the current president.
     *         - {@code chancellor}: the username of the current chancellor (can be
     *         null).
     *         - {@code last-president}: The username of the last president that
     *         presided over a legislative session.
     *         - {@code last-chancellor}: The username of the last chancellor that
     *         presided over a legislative session.
     *         - {@code draw-size}: The size of the draw deck.
     *         - {@code discard-size}: The size of the discard deck.
     *         - {@code fascist-policies}: The number of passed fascist policies.
     *         - {@code liberal-policies}: The number of passed liberal policies.:
     *         - {@code user-votes}: A map from each user to their vote from the
     *         last chancellor nomination.
     *         - {@code president-choices}: The choices for the president during the
     *         legislative session (only if in
     *         game state LEGISLATIVE_PRESIDENT).
     *         - {@code chancellor-choices}: The choices for the chancellor during
     *         the legislative session (only if in
     *         game state LEGISLATIVE_CHANCELLOR).
     *         - {@code veto-occurred}: Set to true if a veto has already taken
     *         place on this legislative session.
     *         - {@code selfType}: HUMAN, BOT, or OBSERVER for the requesting user.
     */
    public static JSONObject convert(SecretHitlerGame game, String userName, Lobby.HistoryDisplayConfig historyConfig) {
        return convert(game, userName, historyConfig, null);
    }

    public static JSONObject convert(SecretHitlerGame game, String userName, Lobby.HistoryDisplayConfig historyConfig,
            Lobby lobby) {
        if (game == null) {
            throw new NullPointerException();
        }
        Lobby.HistoryDisplayConfig effectiveHistoryConfig = historyConfig == null
                ? Lobby.HistoryDisplayConfig.defaultConfig()
                : historyConfig;

        JSONObject out = new JSONObject();
        JSONObject playerData = new JSONObject();
        String[] playerOrder = new String[game.getPlayerList().size()];
        List<Player> playerList = game.getPlayerList();

        // Players should only be shown all roles under specific circumstances.
        // Observers (non-players) should not see hidden roles until the game has
        // finished.
        String perspectivePlayer = lobby == null
                ? (game.hasPlayer(userName) ? userName : null)
                : lobby.getControlledPlayerForUser(userName);
        if (perspectivePlayer == null && game.hasPlayer(userName)) {
            perspectivePlayer = userName;
        }
        boolean userIsPlayer = perspectivePlayer != null && game.hasPlayer(perspectivePlayer);
        Identity role = userIsPlayer ? game.getPlayer(perspectivePlayer).getIdentity() : null;
        boolean gameFinished = game.hasGameFinished();
        Player.Type selfType = userIsPlayer ? Player.Type.HUMAN : Player.Type.OBSERVER;
        boolean canAct = lobby == null ? userIsPlayer : (lobby.canUserAct(userName) || userName.equals(perspectivePlayer));

        for (int i = 0; i < playerList.size(); i++) {
            JSONObject playerObj = new JSONObject();
            Player player = playerList.get(i);

            playerObj.put("alive", player.isAlive());

            // Only include player role for self or under specific rules
            boolean showAnarchistAlly = role == Identity.ANARCHIST
                    && game.getSetupConfig().doAnarchistsKnowEachOther()
                    && player.getIdentity() == Identity.ANARCHIST;
            boolean showFascistTeamRole = (role == Identity.FASCIST
                    || (role == Identity.HITLER && game.getPlayerList().size() <= 6))
                    && (player.getIdentity() == Identity.FASCIST || player.getIdentity() == Identity.HITLER);
            if (player.getUsername().equals(perspectivePlayer) || gameFinished || showFascistTeamRole
                    || showAnarchistAlly) {
                String id = player.getIdentity().toString();
                playerObj.put("id", id);
            }
            playerObj.put("investigated", player.hasBeenInvestigated());
            Player.Type playerType = player.getType();
            if (lobby != null && lobby.isSeatObserverControlled(player.getUsername())) {
                playerType = Player.Type.HUMAN;
            } else if (lobby != null && lobby.isGeneratedBotPlayer(player.getUsername())) {
                playerType = Player.Type.BOT;
            }
            playerObj.put("type", playerType.toString());

            playerData.put(player.getUsername(), playerObj);
            playerOrder[i] = player.getUsername();
        }

        out.put("players", playerData);
        out.put("playerOrder", playerOrder);

        out.put("president", game.getCurrentPresident());
        out.put("chancellor", game.getCurrentChancellor());
        out.put("state", game.getState().toString());
        out.put("lastState", game.getLastState().toString());
        out.put("lastPresident", game.getLastPresident());
        out.put("lastChancellor", game.getLastChancellor());
        out.put("targetUser", game.getTarget());

        out.put("electionTracker", game.getElectionTracker());
        out.put("electionTrackerAdvanced", game.didElectionTrackerAdvance());

        out.put("lastPolicy", game.getLastEnactedPolicy().toString().toUpperCase());

        out.put("drawSize", game.getDrawSize());
        out.put("discardSize", game.getDiscardSize());
        out.put("fascistPolicies", game.getNumFascistPolicies());
        out.put("liberalPolicies", game.getNumLiberalPolicies());
        out.put("anarchistPoliciesResolved", game.getNumAnarchistPoliciesResolved());
        out.put("setupConfig", game.getSetupConfig().toJson());
        out.put("userVotes", game.getVotes());
        out.put("vetoOccurred", game.didVetoOccurThisTurn());
        out.put("presidentPolicyClaimSubmitted", game.hasPresidentPolicyClaim());
        out.put("chancellorPolicyClaimSubmitted", game.hasChancellorPolicyClaim());
        out.put("history", convertHistory(game.getHistory(), effectiveHistoryConfig, game.getRound(), perspectivePlayer));
        out.put("historyConfig", convertHistoryConfig(effectiveHistoryConfig));
        out.put("setupAutomation",
                lobby == null ? Lobby.SetupAutomationConfig.defaultConfig().toJson() : lobby.getSetupAutomationConfig().toJson());
        Lobby.DiscussionReactionConfig reactionConfig = lobby == null
                ? Lobby.DiscussionReactionConfig.defaultConfig()
                : lobby.getDiscussionReactionConfig();
        out.put("discussionReactionConfig", convertDiscussionReactionConfig(reactionConfig));
        out.put("discussionReactions",
                lobby == null ? new JSONObject() : convertDiscussionReactions(lobby.getDiscussionReactionsSnapshot()));
        out.put("creator", lobby == null || lobby.getCreatorUsername() == null ? "" : lobby.getCreatorUsername());
        out.put("moderators", lobby == null ? new JSONArray() : new JSONArray(lobby.getModeratorUsernamesSnapshot()));
        out.put("connected", lobby == null
                ? new JSONObject()
                : new JSONObject(lobby.getSeatControllerConnectedStatusSnapshot(java.util.Arrays.asList(playerOrder))));
        out.put("selfType", selfType.toString());
        out.put("controlledPlayer", perspectivePlayer == null ? "" : perspectivePlayer);
        out.put("canAct", canAct);

        JSONObject botControlled = new JSONObject();
        if (lobby != null) {
            for (String username : lobby.getBotControlledPlayersSnapshot()) {
                if (game.hasPlayer(username)) {
                    botControlled.put(username, true);
                }
            }
        }
        out.put("botControlled", botControlled);
        out.put("observers", lobby == null ? new JSONArray() : new JSONArray(lobby.getObserverUsernamesSnapshot()));
        out.put("observerConnected",
                lobby == null ? new JSONObject() : new JSONObject(lobby.getObserverConnectedStatusSnapshot()));
        out.put("observerAssignments",
                lobby == null ? new JSONObject() : new JSONObject(lobby.getObserverAssignmentsSnapshot()));
        out.put("observerAssignableTargets",
                lobby == null ? new JSONObject() : new JSONObject(lobby.getObserverAssignableTargetTypesSnapshot()));

        if (game.getState() == GameState.LEGISLATIVE_PRESIDENT) {
            out.put("presidentChoices", convertPolicyListToStringArray(game.getPresidentLegislativeChoices()));
        }
        if (game.getState() == GameState.LEGISLATIVE_CHANCELLOR) {
            out.put("chancellorChoices", convertPolicyListToStringArray(game.getChancellorLegislativeChoices()));
        }
        if (game.getState() == GameState.PRESIDENTIAL_POWER_PEEK) {
            out.put("peek", convertPolicyListToStringArray(game.getPeek()));
        }

        return out;
    }

    /**
     * Converts a list of policies into a string array.
     * 
     * @param list the list of policies.
     * @return a string array with the same length as the list, where each index is
     *         "FASCIST", "LIBERAL", or "ANARCHIST"
     *         according to the type of the Policy at that index in the list.
     */
    public static String[] convertPolicyListToStringArray(List<Policy> list) {
        String[] out = new String[list.size()];
        for (int i = 0; i < list.size(); i++) {
            out[i] = list.get(i).getType().toString();
        }
        return out;
    }

    private static JSONObject convertHistoryConfig(Lobby.HistoryDisplayConfig historyConfig) {
        JSONObject out = new JSONObject();
        out.put("showHistory", historyConfig.shouldShowHistory());
        out.put("showPublicActions", historyConfig.shouldShowPublicActions());
        out.put("showVoteBreakdown", historyConfig.shouldShowVoteBreakdown());
        out.put("showPolicyClaims", historyConfig.shouldShowPolicyClaims());
        out.put("roundsToShow", historyConfig.getRoundsToShow().toString());
        return out;
    }

    private static JSONObject convertDiscussionReactionConfig(Lobby.DiscussionReactionConfig reactionConfig) {
        JSONObject out = new JSONObject();
        out.put("durationSeconds", reactionConfig.getDurationSeconds());
        out.put("allowDeadPlayers", reactionConfig.shouldAllowDeadPlayers());
        return out;
    }

    private static JSONObject convertDiscussionReactions(Map<String, Lobby.DiscussionReaction> reactions) {
        JSONObject out = new JSONObject();
        if (reactions == null) {
            return out;
        }

        for (Map.Entry<String, Lobby.DiscussionReaction> entry : reactions.entrySet()) {
            Lobby.DiscussionReaction reaction = entry.getValue();
            if (reaction == null) {
                continue;
            }

            JSONObject reactionJson = new JSONObject();
            reactionJson.put("type", reaction.getType().toString());
            reactionJson.put("expiresAt", reaction.getExpiresAtMillis());
            out.put(entry.getKey(), reactionJson);
        }
        return out;
    }

    private static JSONArray convertHistory(List<SecretHitlerGame.RoundHistoryEntry> history,
            Lobby.HistoryDisplayConfig historyConfig, int currentRound, String perspectivePlayer) {
        JSONArray out = new JSONArray();
        if (!historyConfig.shouldShowHistory()) {
            return out;
        }

        int startIndex = 0;
        switch (historyConfig.getRoundsToShow()) {
            case LAST_1:
                startIndex = Math.max(0, history.size() - 1);
                break;
            case LAST_3:
                startIndex = Math.max(0, history.size() - 3);
                break;
            case ALL:
            default:
                startIndex = 0;
        }

        for (int i = startIndex; i < history.size(); i++) {
            SecretHitlerGame.RoundHistoryEntry entry = history.get(i);
            JSONObject jsonEntry = new JSONObject();
            jsonEntry.put("round", entry.getRound());
            jsonEntry.put("president", entry.getPresident());
            jsonEntry.put("chancellor", entry.getChancellor());
            jsonEntry.put("votePassed", entry.didVotePass());
            jsonEntry.put("result", entry.getResult() == null ? JSONObject.NULL : entry.getResult().toString());
            jsonEntry.put("isCurrentRound", entry.getRound() == currentRound);

            JSONObject voteData = new JSONObject();
            if (historyConfig.shouldShowVoteBreakdown()) {
                for (Map.Entry<String, Boolean> vote : entry.getVotes().entrySet()) {
                    voteData.put(vote.getKey(), vote.getValue());
                }
            }
            jsonEntry.put("votes", voteData);

            JSONArray actions = new JSONArray();
            if (historyConfig.shouldShowPublicActions()) {
                for (SecretHitlerGame.PublicAction action : entry.getPublicActions()) {
                    JSONObject actionData = new JSONObject();
                    actionData.put("type", action.getType().toString());
                    actionData.put("president", action.getPresident());
                    actionData.put("target", action.getTarget() == null ? JSONObject.NULL : action.getTarget());
                    actionData.put("hitlerExecuted",
                            action.getHitlerExecuted() == null ? JSONObject.NULL : action.getHitlerExecuted());
                    actionData.put("investigationResult", convertInvestigationResult(action, perspectivePlayer));
                    actions.put(actionData);
                }
            }
            jsonEntry.put("publicActions", actions);

            boolean includePolicyClaims = historyConfig.shouldShowPolicyClaims() || entry.getRound() == currentRound;
            jsonEntry.put("policyClaimsRequired", includePolicyClaims && entry.arePolicyClaimsRequired());
            jsonEntry.put("presidentPolicyClaim", includePolicyClaims
                    ? convertPolicyClaim(entry.getPresidentPolicyClaim())
                    : JSONObject.NULL);
            jsonEntry.put("chancellorPolicyClaim", includePolicyClaims
                    ? convertPolicyClaim(entry.getChancellorPolicyClaim())
                    : JSONObject.NULL);

            out.put(jsonEntry);
        }
        return out;
    }

    private static Object convertInvestigationResult(SecretHitlerGame.PublicAction action, String perspectivePlayer) {
        if (action.getType() == SecretHitlerGame.PublicActionType.INVESTIGATED
                && perspectivePlayer != null
                && perspectivePlayer.equals(action.getPresident())
                && action.getInvestigationResult() != null) {
            return action.getInvestigationResult().toString();
        }
        return JSONObject.NULL;
    }

    private static Object convertPolicyClaim(SecretHitlerGame.PolicyClaim claim) {
        if (claim == null) {
            return JSONObject.NULL;
        }
        JSONObject out = new JSONObject();
        out.put("refused", claim.isRefused());
        out.put("policies", convertPolicyListToJsonArray(claim.getPolicies()));
        return out;
    }

    private static JSONArray convertPolicyListToJsonArray(List<Policy.Type> policies) {
        JSONArray out = new JSONArray();
        if (policies == null) {
            return out;
        }
        for (Policy.Type policy : policies) {
            out.put(policy.toString());
        }
        return out;
    }
}

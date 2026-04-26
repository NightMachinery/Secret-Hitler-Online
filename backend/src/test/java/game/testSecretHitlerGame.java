package game;

import game.datastructures.Deck;
import game.datastructures.Player;
import game.datastructures.Policy;
import game.datastructures.board.PresidentialPower;
import org.junit.Test;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;
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


    private void replaceDrawDeck(SecretHitlerGame game, Policy.Type... topToBottom) throws Exception {
        Deck deck = new Deck();
        for (int i = topToBottom.length - 1; i >= 0; i--) {
            deck.add(new Policy(topToBottom[i]));
        }
        Field drawField = SecretHitlerGame.class.getDeclaredField("draw");
        drawField.setAccessible(true);
        drawField.set(game, deck);
    }

    private void passVote(SecretHitlerGame game, String chancellor) {
        game.nominateChancellor(chancellor);
        for (Player player : game.getPlayerList()) {
            if (player.isAlive()) {
                game.registerVote(player.getUsername(), true);
            }
        }
    }

    private void failVote(SecretHitlerGame game, String chancellor) {
        game.nominateChancellor(chancellor);
        for (Player player : game.getPlayerList()) {
            if (player.isAlive()) {
                game.registerVote(player.getUsername(), false);
            }
        }
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

    @Test
    public void testLegislativePolicyRequiresPresidentAndChancellorClaimsBeforeEndTerm() throws Exception {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(6));
        replaceDrawDeck(game, Policy.Type.FASCIST, Policy.Type.LIBERAL, Policy.Type.LIBERAL, Policy.Type.FASCIST);

        passVote(game, "2");
        game.presidentDiscardPolicy(1);
        game.chancellorEnactPolicy(0);

        assertEquals(GameState.POLICY_CLAIMS, game.getState());
        SecretHitlerGame.RoundHistoryEntry entry = game.getHistory().get(0);
        assertTrue(entry.arePolicyClaimsRequired());
        assertFalse(entry.hasPresidentPolicyClaim());
        assertFalse(entry.hasChancellorPolicyClaim());

        game.registerPolicyClaim("0", false, Arrays.asList(
                Policy.Type.FASCIST,
                Policy.Type.FASCIST,
                Policy.Type.LIBERAL));

        assertEquals(GameState.POLICY_CLAIMS, game.getState());
        entry = game.getHistory().get(0);
        assertTrue(entry.hasPresidentPolicyClaim());
        assertFalse(entry.hasChancellorPolicyClaim());

        game.refusePolicyClaim("2");

        assertEquals(GameState.POST_LEGISLATIVE, game.getState());
        entry = game.getHistory().get(0);
        assertEquals(Arrays.asList(Policy.Type.FASCIST, Policy.Type.FASCIST, Policy.Type.LIBERAL),
                entry.getPresidentPolicyClaim().getPolicies());
        assertTrue(entry.getChancellorPolicyClaim().isRefused());
    }

    @Test
    public void testPolicyClaimValidationRejectsUnsupportedPolicyTypesAndDuplicates() throws Exception {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(6));
        replaceDrawDeck(game, Policy.Type.FASCIST, Policy.Type.LIBERAL, Policy.Type.LIBERAL, Policy.Type.FASCIST);

        passVote(game, "2");
        game.presidentDiscardPolicy(1);
        game.chancellorEnactPolicy(0);

        try {
            game.registerPolicyClaim("0", false, Arrays.asList(
                    Policy.Type.FASCIST,
                    Policy.Type.ANARCHIST,
                    Policy.Type.LIBERAL));
            fail("Expected standard games to reject Anarchist policy claims.");
        } catch (IllegalArgumentException expected) {
            assertTrue(expected.getMessage().contains("not available"));
        }

        game.registerPolicyClaim("0", false, Arrays.asList(
                Policy.Type.FASCIST,
                Policy.Type.FASCIST,
                Policy.Type.LIBERAL));

        try {
            game.refusePolicyClaim("0");
            fail("Expected duplicate president claims to be rejected.");
        } catch (IllegalStateException expected) {
            assertTrue(expected.getMessage().contains("already"));
        }
    }

    @Test
    public void testElectionTrackerTopDeckDoesNotRequestPolicyClaims() throws Exception {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(6));
        replaceDrawDeck(game, Policy.Type.FASCIST, Policy.Type.LIBERAL, Policy.Type.FASCIST);

        failVote(game, "2");
        game.endPresidentialTerm();
        failVote(game, "3");
        game.endPresidentialTerm();
        failVote(game, "4");

        assertEquals(GameState.POST_LEGISLATIVE, game.getState());
        assertFalse(game.getHistory().get(2).arePolicyClaimsRequired());
    }

    @Test
    public void testElectionTrackerTopDeckRecordsRandomCardHistoryTrail() throws Exception {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(6));
        replaceDrawDeck(game, Policy.Type.FASCIST, Policy.Type.LIBERAL, Policy.Type.FASCIST);

        failVote(game, "2");
        game.endPresidentialTerm();
        failVote(game, "3");
        game.endPresidentialTerm();
        failVote(game, "4");

        List<SecretHitlerGame.RoundHistoryResultStep> resultTrail = game.getHistory().get(2).getResultTrail();
        assertEquals(1, resultTrail.size());
        assertEquals(SecretHitlerGame.RoundHistoryResultStep.FAILED_ELECTION_RANDOM, resultTrail.get(0));
    }

    @Test
    public void testAnarchistCascadeRecordsRepeatedRandomCardHistoryTrail() throws Exception {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(6),
                GameSetupConfig.builder(6)
                        .policies(6, 11, 5)
                        .build());
        replaceDrawDeck(game,
                Policy.Type.FASCIST,
                Policy.Type.ANARCHIST,
                Policy.Type.ANARCHIST,
                Policy.Type.ANARCHIST,
                Policy.Type.ANARCHIST,
                Policy.Type.LIBERAL,
                Policy.Type.LIBERAL,
                Policy.Type.LIBERAL);

        passVote(game, "2");
        game.presidentDiscardPolicy(0);
        game.chancellorEnactPolicy(0);

        List<SecretHitlerGame.RoundHistoryResultStep> resultTrail = game.getHistory().get(0).getResultTrail();
        assertEquals(3, resultTrail.size());
        assertEquals(SecretHitlerGame.RoundHistoryResultStep.ANARCHY_RANDOM, resultTrail.get(0));
        assertEquals(SecretHitlerGame.RoundHistoryResultStep.ANARCHY_RANDOM, resultTrail.get(1));
        assertEquals(SecretHitlerGame.RoundHistoryResultStep.ANARCHY_RANDOM, resultTrail.get(2));
        assertNotNull(game.getHistory().get(0).getResult());
    }

    @Test
    public void testCpuPresidentAndChancellorAutoRefusePolicyClaims() throws Exception {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(6));
        game.getPlayer("0").markAsCpu();
        game.getPlayer("2").markAsCpu();
        replaceDrawDeck(game, Policy.Type.FASCIST, Policy.Type.LIBERAL, Policy.Type.LIBERAL, Policy.Type.FASCIST);

        passVote(game, "2");
        game.presidentDiscardPolicy(1);
        game.chancellorEnactPolicy(0);

        assertEquals(GameState.POST_LEGISLATIVE, game.getState());
        SecretHitlerGame.RoundHistoryEntry entry = game.getHistory().get(0);
        assertTrue(entry.getPresidentPolicyClaim().isRefused());
        assertTrue(entry.getChancellorPolicyClaim().isRefused());
    }

    @Test
    public void testPolicyClaimsResolveBeforePresidentialPowers() throws Exception {
        SecretHitlerGame game = new SecretHitlerGame(makePlayers(6),
                GameSetupConfig.builder(6)
                        .powerAt(1, PresidentialPower.PEEK)
                        .build());
        replaceDrawDeck(game, Policy.Type.FASCIST, Policy.Type.LIBERAL, Policy.Type.LIBERAL, Policy.Type.FASCIST);

        passVote(game, "2");
        game.presidentDiscardPolicy(1);
        game.chancellorEnactPolicy(0);

        assertEquals(GameState.POLICY_CLAIMS, game.getState());
        game.refusePolicyClaim("0");
        assertEquals(GameState.POLICY_CLAIMS, game.getState());
        game.refusePolicyClaim("2");

        assertEquals(GameState.PRESIDENTIAL_POWER_PEEK, game.getState());
    }

}

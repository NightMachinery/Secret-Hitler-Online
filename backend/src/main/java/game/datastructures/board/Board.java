package game.datastructures.board;

import game.datastructures.Policy;

import java.io.Serializable;
import java.util.LinkedHashMap;
import java.util.Map;

public abstract class Board implements Serializable {

    private final int fascistPoliciesToWin;
    private final int liberalPoliciesToWin;

    // The minimum number of fascist policies required before
    // fascists can win by electing Hitler chancellor
    private final int minPoliciesForChancellorVictory;
    private final Map<Integer, PresidentialPower> fascistPowerSchedule;

    private int numFascistPolicies;
    private int numLiberalPolicies;

    private Policy lastEnacted;


    /** Constructs a new board.
     * @modifies this
     * @effects this is a new, empty board.
     */
    public Board() {
        this(6, 5, 3, new LinkedHashMap<>());
    }

    public Board(int fascistPoliciesToWin, int liberalPoliciesToWin, int minPoliciesForChancellorVictory,
            Map<Integer, PresidentialPower> fascistPowerSchedule) {
        this.fascistPoliciesToWin = fascistPoliciesToWin;
        this.liberalPoliciesToWin = liberalPoliciesToWin;
        this.minPoliciesForChancellorVictory = minPoliciesForChancellorVictory;
        this.fascistPowerSchedule = fascistPowerSchedule == null
                ? new LinkedHashMap<>()
                : new LinkedHashMap<>(fascistPowerSchedule);
        numFascistPolicies = 0;
        numLiberalPolicies = 0;
    }

    /**
     * Enacts the given policy.
     * @param policy the Policy to enact.
     * @throws IllegalStateException if the liberals or fascists have already won.
     *                               (isLiberalVictory() or isFascistVictory() is true)
     * @modifies this
     * @effects adds {@code policy} to the count of liberal and fascist policies.
     */
    public void enactPolicy(Policy policy) {
        if (isLiberalVictory() || isFascistVictory()) {
            throw new IllegalStateException("Cannot enact a policy when victory conditions were already reached.");
        }
        if (policy.getType() == Policy.Type.FASCIST) {
            numFascistPolicies++;
        } else if (policy.getType() == Policy.Type.LIBERAL) {
            numLiberalPolicies++;
        }
        lastEnacted = policy;
    }


    /**
     * Gets the type of the last enacted policy.
     * @throws NullPointerException if no policy has been enacted yet.
     * @return the Policy.Type of the last policy enacted.
     */
    public Policy.Type getLastEnactedType() {
        if (lastEnacted == null) {
            throw new NullPointerException("No policy has been enacted yet");
        }
        return lastEnacted.getType();
    }


    /**
     * Gets the count of fascist policies.
     * @return the number of fascist policies enacted.
     */
    public int getNumFascistPolicies() {
        return numFascistPolicies;
    }


    /**
     * Gets the count of liberal policies.
     * @return the number of liberal policies enacted.
     */
    public int getNumLiberalPolicies() {
        return numLiberalPolicies;
    }


    /**
     * Determines whether the liberal party won by policy count.
     * @return true if the number of Liberal Policies {@literal >=} {@code LIBERAL_POLICIES_TO_WIN}
     */
    public boolean isLiberalVictory() {
        return getNumLiberalPolicies() >= liberalPoliciesToWin;
    }


    /**
     * Determines whether the fascist party won by policy count.
     * @return true if the number of Fascist Policies {@literal >=} {@code FASCIST_POLICIES_TO_WIN}
     */
    public boolean isFascistVictory() {
        return getNumFascistPolicies() >= fascistPoliciesToWin;
    }


    /**
     * Gets whether the last policy activated a power.
     * @requires a policy has already been enacted.
     * @return true if the last enacted policy activated a presidential power.
     */
    public boolean hasActivatedPower() {
        return getActivatedPower() != PresidentialPower.NONE;
    }

    /**
     * Gets the presidential power (if any) that was activated by the last policy.
     * @requires a policy has already been enacted.
     * @return If no presidential power was unlocked from the last policy enacted, returns NONE. Otherwise, returns the
     *         last activated presidential power.
     */
    public PresidentialPower getActivatedPower() {
        if (getLastEnactedType() == Policy.Type.FASCIST) {
            return fascistPowerSchedule.getOrDefault(getNumFascistPolicies(), PresidentialPower.NONE);
        }
        return PresidentialPower.NONE;
    }

    public boolean fascistsCanWinByElection() {
        return (getNumFascistPolicies() >= minPoliciesForChancellorVictory);
    }

    public int getFascistPoliciesToWin() {
        return fascistPoliciesToWin;
    }

    public int getLiberalPoliciesToWin() {
        return liberalPoliciesToWin;
    }

    public int getMinPoliciesForChancellorVictory() {
        return minPoliciesForChancellorVictory;
    }

}

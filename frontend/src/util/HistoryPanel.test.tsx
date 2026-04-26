import React from "react";
import { render, screen } from "@testing-library/react";
import HistoryPanel from "./HistoryPanel";
import {
  PolicyType,
  PublicHistoryActionType,
  RoundHistoryEntry,
  RoundHistoryResult,
  RoundHistoryResultStep,
} from "../types";

const historyEntry: RoundHistoryEntry = {
  round: 1,
  president: "Alice",
  chancellor: "Bob",
  votes: { Alice: true, Bob: true },
  votePassed: true,
  result: RoundHistoryResult.FASCIST,
  publicActions: [],
  isCurrentRound: true,
  policyClaimsRequired: true,
  presidentPolicyClaim: {
    refused: false,
    policies: [PolicyType.FASCIST, PolicyType.LIBERAL, PolicyType.FASCIST],
  },
  chancellorPolicyClaim: {
    refused: true,
    policies: [],
  },
};

describe("HistoryPanel policy claims", () => {
  test("shows current-round claims with tiny cards even when past-claims option is disabled", () => {
    render(
      <HistoryPanel
        history={[historyEntry]}
        playerOrder={["Alice", "Bob"]}
        showVoteBreakdown={false}
        showPublicActions={false}
        showPolicyClaims={false}
      />
    );

    expect(screen.getByText("Claims")).toBeInTheDocument();
    expect(screen.getByText("P:")).toBeInTheDocument();
    expect(screen.getByText("C:")).toBeInTheDocument();
    expect(screen.getAllByAltText("President claimed fascist policy")).toHaveLength(2);
    expect(screen.getByAltText("President claimed liberal policy")).toBeInTheDocument();
    expect(screen.getByText("Refused")).toBeInTheDocument();
  });
});

describe("HistoryPanel private investigation results", () => {
  test("shows an investigator-only result when the action includes one", () => {
    const investigationEntry: RoundHistoryEntry = {
      ...historyEntry,
      publicActions: [
        {
          type: PublicHistoryActionType.INVESTIGATED,
          president: "Alice",
          target: "Bob",
          hitlerExecuted: null,
          investigationResult: PolicyType.FASCIST,
        },
      ],
      policyClaimsRequired: false,
      presidentPolicyClaim: null,
      chancellorPolicyClaim: null,
    };

    render(
      <HistoryPanel
        history={[investigationEntry]}
        playerOrder={["Alice", "Bob"]}
        showVoteBreakdown={false}
        showPublicActions={true}
        showPolicyClaims={false}
      />
    );

    expect(
      screen.getByText("Alice investigated Bob — result: Fascist")
    ).toBeInTheDocument();
  });

  test("keeps investigation labels public when no private result is included", () => {
    const investigationEntry: RoundHistoryEntry = {
      ...historyEntry,
      publicActions: [
        {
          type: PublicHistoryActionType.INVESTIGATED,
          president: "Alice",
          target: "Bob",
          hitlerExecuted: null,
        },
      ],
      policyClaimsRequired: false,
      presidentPolicyClaim: null,
      chancellorPolicyClaim: null,
    };

    render(
      <HistoryPanel
        history={[investigationEntry]}
        playerOrder={["Alice", "Bob"]}
        showVoteBreakdown={false}
        showPublicActions={true}
        showPolicyClaims={false}
      />
    );

    expect(screen.getByText("Alice investigated Bob")).toBeInTheDocument();
  });
});

describe("HistoryPanel result trails", () => {
  test("shows failed election random-card trail compactly", () => {
    render(
      <HistoryPanel
        history={[
          {
            ...historyEntry,
            votePassed: false,
            result: RoundHistoryResult.FASCIST,
            resultTrail: [RoundHistoryResultStep.FAILED_ELECTION_RANDOM],
            policyClaimsRequired: false,
            presidentPolicyClaim: null,
            chancellorPolicyClaim: null,
          },
        ]}
        playerOrder={["Alice", "Bob"]}
        showVoteBreakdown={false}
        showPublicActions={false}
        showPolicyClaims={false}
      />
    );

    expect(screen.getByLabelText("Failed election, random card, Fascist")).toBeInTheDocument();
  });

  test("shows repeated anarchy random-card trail compactly", () => {
    render(
      <HistoryPanel
        history={[
          {
            ...historyEntry,
            result: RoundHistoryResult.LIBERAL,
            resultTrail: [
              RoundHistoryResultStep.ANARCHY_RANDOM,
              RoundHistoryResultStep.ANARCHY_RANDOM,
            ],
            policyClaimsRequired: false,
            presidentPolicyClaim: null,
            chancellorPolicyClaim: null,
          },
        ]}
        playerOrder={["Alice", "Bob"]}
        showVoteBreakdown={false}
        showPublicActions={false}
        showPolicyClaims={false}
      />
    );

    expect(screen.getByLabelText("Anarchy, anarchy, random card, Liberal")).toBeInTheDocument();
  });
});

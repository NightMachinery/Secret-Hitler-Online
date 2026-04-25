import React from "react";
import { render, screen } from "@testing-library/react";
import HistoryPanel from "./HistoryPanel";
import { PolicyType, RoundHistoryEntry, RoundHistoryResult } from "../types";

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

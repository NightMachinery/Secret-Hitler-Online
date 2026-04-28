import React from "react";
import { render, screen } from "@testing-library/react";
import PlayerPolicyStatus from "./PlayerPolicyStatus";
import { createAnarchistSetupConfig, createStandardSetupConfig } from "../setup/GameSetupConfig";

describe("PlayerPolicyStatus", () => {
  test("hides Anarchy details for standard games", () => {
    render(
      <PlayerPolicyStatus
        numFascistPolicies={0}
        numLiberalPolicies={0}
        playerCount={7}
        setupConfig={createStandardSetupConfig(7)}
        anarchistPoliciesResolved={0}
      />
    );

    expect(screen.queryByText(/Anarchy/i)).not.toBeInTheDocument();
    expect(screen.queryByAltText("Anarchist")).not.toBeInTheDocument();
  });

  test("shows Anarchists, configured Anarchy cards, and enacted Anarchy count", () => {
    render(
      <PlayerPolicyStatus
        numFascistPolicies={0}
        numLiberalPolicies={0}
        playerCount={7}
        setupConfig={createAnarchistSetupConfig(7)}
        anarchistPoliciesResolved={2}
      />
    );

    expect(screen.getByText("Anarchists:")).toBeInTheDocument();
    expect(screen.getByText("Anarchy Cards:")).toBeInTheDocument();
    expect(screen.getByText("Anarchy Enacted: 2")).toBeInTheDocument();
    expect(screen.getAllByAltText("Anarchist")).toHaveLength(2);
  });
});

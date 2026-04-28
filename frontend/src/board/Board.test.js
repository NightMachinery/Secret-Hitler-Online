import React from "react";
import { render, screen } from "@testing-library/react";
import Board from "./Board";
import { createAnarchistSetupConfig, createStandardSetupConfig } from "../setup/GameSetupConfig";

describe("Board", () => {
  test("renders the election tracker on custom boards", () => {
    render(
      <Board
        numPlayers={7}
        numLiberalPolicies={1}
        numFascistPolicies={2}
        electionTracker={2}
        setupConfig={createAnarchistSetupConfig(7)}
      />
    );

    expect(
      screen.getByAltText("Election tracker at position 2 out of 3.")
    ).toBeInTheDocument();
  });

  test("uses the dynamic board when the Fascist power schedule is customized", () => {
    const config = {
      ...createStandardSetupConfig(7),
      preset: "MANUAL",
      fascistPowerSchedule: [
        "NONE",
        "NONE",
        "NONE",
        "NONE",
        "NONE",
        "EXECUTION",
      ],
    };

    const { container } = render(
      <Board
        numPlayers={7}
        numLiberalPolicies={0}
        numFascistPolicies={0}
        electionTracker={1}
        setupConfig={config}
      />
    );

    expect(container.querySelector(".dynamic-board-container")).toBeInTheDocument();
    expect(screen.getByText("EXECUTION")).toBeInTheDocument();
  });

  test("uses fixed board art for the default Anarchist preset without adding an Anarchist summary strip", () => {
    const { container } = render(
      <Board
        numPlayers={7}
        numLiberalPolicies={0}
        numFascistPolicies={0}
        numAnarchistPoliciesResolved={1}
        electionTracker={0}
        setupConfig={createAnarchistSetupConfig(7)}
      />
    );

    expect(container.querySelector(".dynamic-board-container")).not.toBeInTheDocument();
    expect(screen.queryByText("Anarchist policies resolved: 1")).not.toBeInTheDocument();
    expect(container.querySelector(".board-anarchist-summary")).not.toBeInTheDocument();
  });
});

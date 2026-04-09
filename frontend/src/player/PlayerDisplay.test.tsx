import React from "react";
import { render } from "@testing-library/react";
import PlayerDisplay from "./PlayerDisplay";
import {
  GameState,
  HistoryRoundsToShow,
  LobbyState,
  PlayerState,
  Role,
  UserType,
} from "../types";

jest.mock("react-textfit", () => ({
  Textfit: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const buildGameState = (playerOrder: string[]): GameState => ({
  state: LobbyState.CHANCELLOR_NOMINATION,
  lastState: LobbyState.SETUP,
  playerOrder,
  players: playerOrder.reduce<Record<string, PlayerState>>(
    (acc, playerName, index) => ({
      ...acc,
      [playerName]: {
        id:
          index === 0
            ? Role.HITLER
            : index % 2 === 0
              ? Role.FASCIST
              : Role.LIBERAL,
        alive: true,
        investigated: false,
        type: UserType.HUMAN,
      },
    }),
    {}
  ),
  chancellor: playerOrder[1],
  president: playerOrder[0],
  lastChancellor: "",
  lastPresident: "",
  electionTracker: 0,
  electionTrackerAdvanced: false,
  userVotes: {},
  liberalPolicies: 0,
  fascistPolicies: 0,
  drawSize: 17,
  discardSize: 0,
  lastPolicy: "",
  vetoOccurred: false,
  history: [],
  historyConfig: {
    showHistory: true,
    showPublicActions: true,
    showVoteBreakdown: true,
    roundsToShow: HistoryRoundsToShow.ALL,
  },
  selfType: UserType.HUMAN,
  icon: playerOrder.reduce<Record<string, string>>(
    (acc, playerName) => ({
      ...acc,
      [playerName]: "p_default",
    }),
    {}
  ),
});

describe("PlayerDisplay", () => {
  test("renders players in a single ordered wrapping list", () => {
    const playerOrder = Array.from({ length: 12 }, (_value, index) => {
      return `Player ${index + 1}`;
    });

    const { container } = render(
      <PlayerDisplay
        user={playerOrder[0]}
        gameState={buildGameState(playerOrder)}
        showLabels={false}
      />
    );

    const playerNodes = Array.from(
      container.querySelectorAll("[data-player-name]")
    );

    expect(playerNodes).toHaveLength(playerOrder.length);
    expect(
      playerNodes.map((node) => node.getAttribute("data-player-name"))
    ).toEqual(playerOrder);
    expect(container.querySelector("#player-display-container")).toBeNull();
  });
});

import React from "react";
import { render } from "@testing-library/react";
import VictoryPrompt from "./VictoryPrompt";
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

const buildGameState = (
  playerOrder: string[],
  state: LobbyState
): GameState => ({
  state,
  lastState: LobbyState.POST_LEGISLATIVE,
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
  chancellor: playerOrder[1] || "",
  president: playerOrder[0] || "",
  lastChancellor: "",
  lastPresident: "",
  electionTracker: 0,
  electionTrackerAdvanced: false,
  userVotes: {},
  liberalPolicies: 3,
  fascistPolicies: 4,
  drawSize: 17,
  discardSize: 0,
  lastPolicy: "",
  vetoOccurred: false,
  history: [],
  historyConfig: {
    showHistory: true,
    showPublicActions: true,
    showVoteBreakdown: true,
    showPolicyClaims: true,
    roundsToShow: HistoryRoundsToShow.ALL,
  },
  discussionReactions: {},
  discussionReactionConfig: {
    durationSeconds: 15,
    allowDeadPlayers: true,
  },
  selfType: UserType.HUMAN,
  creator: playerOrder[0] || "",
  moderators: [],
  connected: playerOrder.reduce<Record<string, boolean>>(
    (acc, playerName) => ({
      ...acc,
      [playerName]: true,
    }),
    {}
  ),
  botControlled: {},
  icon: playerOrder.reduce<Record<string, string>>(
    (acc, playerName) => ({
      ...acc,
      [playerName]: "p_default",
    }),
    {}
  ),
});

describe("VictoryPrompt", () => {
  test("renders players in in-game panel order and shows executed status", () => {
    const playerOrder = ["Charlie", "Alice", "Bob"];
    const gameState = buildGameState(
      playerOrder,
      LobbyState.LIBERAL_VICTORY_EXECUTION
    );
    gameState.players.Alice.alive = false;

    const { container, getByText } = render(
      <VictoryPrompt
        gameState={gameState}
        user={"Charlie"}
        onReturnToLobby={() => {}}
      />
    );

    const playerNodes = Array.from(
      container.querySelectorAll("[data-player-name]")
    );

    expect(
      playerNodes.map((node) => node.getAttribute("data-player-name"))
    ).toEqual(playerOrder);
    expect(getByText("EXECUTED")).toBeInTheDocument();
    expect(getByText("Liberals successfully executed Hitler!")).toBeInTheDocument();
  });

  test("shows fascist victory text and enacted policy totals", () => {
    const gameState = buildGameState(
      ["Alice", "Bob", "Cara"],
      LobbyState.FASCIST_VICTORY_POLICY
    );
    gameState.liberalPolicies = 2;
    gameState.fascistPolicies = 6;

    const { getByText } = render(
      <VictoryPrompt
        gameState={gameState}
        user={"Alice"}
        onReturnToLobby={() => {}}
      />
    );

    expect(
      getByText("Fascists successfully passed six policies!")
    ).toBeInTheDocument();
    expect(getByText("Policies enacted:")).toBeInTheDocument();
    expect(getByText("Liberal 2")).toBeInTheDocument();
    expect(getByText("Fascist 6")).toBeInTheDocument();
  });
});

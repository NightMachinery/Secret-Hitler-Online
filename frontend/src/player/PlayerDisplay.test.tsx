import React from "react";
import { render, screen } from "@testing-library/react";
import PlayerDisplay from "./PlayerDisplay";
import {
  GameState,
  HistoryRoundsToShow,
  LobbyState,
  ObserverAssignableTargetType,
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
  creator: playerOrder[0],
  moderators: [],
  connected: playerOrder.reduce<Record<string, boolean>>(
    (acc, playerName) => ({
      ...acc,
      [playerName]: true,
    }),
    {}
  ),
  controlledPlayer: playerOrder[0],
  canAct: true,
  observers: [],
  observerConnected: {},
  observerAssignments: {},
  observerAssignableTargets: {},
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

  test("shows offline badge and moderation action for eligible viewer", () => {
    const gameState = buildGameState(["Alice", "Bob", "Cara"]);
    gameState.connected = { Alice: true, Bob: false, Cara: true };

    render(
      <PlayerDisplay
        user={"Alice"}
        gameState={gameState}
        showLabels={false}
        onOpenModeratorPrompt={() => {}}
      />
    );

    expect(screen.getByText("OFFLINE")).toBeInTheDocument();
    expect(screen.getByTitle("Promote Bob to moderator")).toBeInTheDocument();
  });

  test("shows observer badge and observer action for assignable seats", () => {
    const gameState = buildGameState(["Alice", "Bot 1", "Cara"]);
    gameState.players["Bot 1"].type = UserType.HUMAN;
    gameState.observerAssignments = { Dana: "Bot 1" };
    gameState.observerAssignableTargets = {
      "Bot 1": ObserverAssignableTargetType.GENERATED_BOT,
    };

    render(
      <PlayerDisplay
        user={"Alice"}
        gameState={gameState}
        showLabels={false}
        onOpenObserverPrompt={() => {}}
      />
    );

    expect(screen.getAllByText("OBS")).toHaveLength(2);
    expect(
      screen.getByTitle("Manage observer control for Bot 1")
    ).toBeInTheDocument();
  });
});

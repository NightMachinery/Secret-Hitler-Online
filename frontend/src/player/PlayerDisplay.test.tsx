import React from "react";
import { render, screen } from "@testing-library/react";
import PlayerDisplay from "./PlayerDisplay";
import {
  DiscussionReactionType,
  GameState,
  HistoryRoundsToShow,
  LobbyState,
  ObserverAssignableTargetType,
  PlayerState,
  Role,
  UserType,
} from "../types";

jest.mock("react-textfit", () => ({
  Textfit: ({
    children,
    id,
    className,
    forceSingleModeWidth,
  }: {
    children: React.ReactNode;
    id?: string;
    className?: string;
    forceSingleModeWidth?: boolean;
  }) => (
    <div
      id={id}
      className={className}
      data-force-single-mode-width={String(forceSingleModeWidth)}
    >
      {children}
    </div>
  ),
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
    showPolicyClaims: true,
    roundsToShow: HistoryRoundsToShow.ALL,
  },
  discussionReactions: {},
  discussionReactionConfig: {
    durationSeconds: 15,
    allowDeadPlayers: true,
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

    const { container } = render(
      <PlayerDisplay
        user={"Alice"}
        gameState={gameState}
        showLabels={false}
        onOpenModeratorPrompt={() => {}}
      />
    );

    expect(screen.getByText("OFFLINE").closest(".player-status-badges")).not.toBeNull();
    expect(
      screen.getByTitle("Promote Bob to moderator").closest(".player-corner-actions")
    ).not.toBeNull();
    expect(container.querySelector(".player-utility-chrome")).toBeNull();
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

  test("shows active discussion reaction on the reacting player's card", () => {
    const gameState = buildGameState(["Alice", "Bob", "Cara"]);
    gameState.discussionReactions = {
      Bob: {
        type: DiscussionReactionType.LIKE,
        expiresAt: Date.now() + 5000,
      },
    };

    const { container } = render(
      <PlayerDisplay user={"Alice"} gameState={gameState} showLabels={false} />
    );

    expect(screen.getByLabelText("Like reaction")).toBeInTheDocument();
    expect(container.querySelector(".player-discussion-reaction-badge")).not.toBeNull();
    expect(container.querySelector(".player-discussion-reaction-medallion")).not.toBeNull();
    expect(screen.queryByText("LIKE")).toBeNull();
  });

  test("shows anarchist role with dedicated emblem and fitted label", () => {
    const gameState = buildGameState(["Alice", "Bob"]);
    gameState.players.Alice.id = Role.ANARCHIST;
    gameState.players.Bob.id = Role.ANARCHIST;

    const { container } = render(
      <PlayerDisplay
        user={"Alice"}
        gameState={gameState}
        showLabels={false}
        showRoles={true}
      />
    );

    expect(container.querySelector(".player-identity-label-fit")).not.toBeNull();
    expect(container.querySelector(".player-identity-anarchist")).not.toBeNull();
  });

  test("fits role identity labels to both the card slot width and height", () => {
    const gameState = buildGameState(["Alice"]);
    gameState.players.Alice.id = Role.HITLER;

    const { container } = render(
      <PlayerDisplay
        user={"Alice"}
        gameState={gameState}
        showLabels={false}
        showRoles={true}
      />
    );

    expect(
      container
        .querySelector(".player-identity-label-fit")
        ?.getAttribute("data-force-single-mode-width")
    ).toBe("false");
  });
});


test("keeps role identity art in a compact bottom slot below the name", () => {
  const fs = require("fs");
  const path = require("path");
  const css = fs.readFileSync(path.join(__dirname, "Player.css"), "utf8");

  expect(css).toMatch(/#player-name\s*\{[\s\S]*?top:\s*66%;/);
  expect(css).toMatch(/#player-name\s*\{[\s\S]*?height:\s*12%;/);
  expect(css).toMatch(/#player-identity-label\s*\{[\s\S]*?top:\s*80%;/);
  expect(css).toMatch(/#player-identity-label\s*\{[\s\S]*?height:\s*13%;/);
  expect(css).toMatch(/#player-identity-label\s*\{[\s\S]*?font-weight:\s*700;/);
  expect(css).toMatch(/#player-identity-label\s*\{[\s\S]*?display:\s*flex;/);
  expect(css).toMatch(/#player-identity-label\s*\{[\s\S]*?align-items:\s*center;/);
  expect(css).toMatch(/#player-identity-label\s*\{[\s\S]*?justify-content:\s*center;/);
  expect(css).toMatch(/#player-identity-label\s*\{[\s\S]*?text-align:\s*center;/);
  expect(css).toMatch(/#player-identity-icon\s*\{[\s\S]*?top:\s*80%;/);
});

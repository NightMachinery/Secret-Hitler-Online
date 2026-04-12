import React from "react";
import ButtonPrompt from "./ButtonPrompt";
import PlayerDisplay, {
  DISABLE_EXECUTED_PLAYERS,
} from "../player/PlayerDisplay";
import VictoryFascistHeader from "../assets/victory-fascist-header.png";
import VictoryLiberalHeader from "../assets/victory-liberal-header.png";
import { GameState, LobbyState } from "../types";
import "./VictoryPrompt.css";

type VictoryPromptProps = {
  gameState: GameState;
  user: string;
  onReturnToLobby: () => void;
};

type VictoryDetails = {
  headerImage: string;
  headerAlt: string;
  messageClass: string;
  victoryMessage: string;
};

const getVictoryDetails = (state: LobbyState): VictoryDetails => {
  switch (state) {
    case LobbyState.FASCIST_VICTORY_POLICY:
      return {
        headerImage: VictoryFascistHeader,
        headerAlt: "Fascist Victory, written in red with a skull icon.",
        messageClass: "highlight",
        victoryMessage: "Fascists successfully passed six policies!",
      };
    case LobbyState.FASCIST_VICTORY_ELECTION:
      return {
        headerImage: VictoryFascistHeader,
        headerAlt: "Fascist Victory, written in red with a skull icon.",
        messageClass: "highlight",
        victoryMessage: "Fascists successfully elected Hitler as chancellor!",
      };
    case LobbyState.LIBERAL_VICTORY_POLICY:
      return {
        headerImage: VictoryLiberalHeader,
        headerAlt: "Liberal Victory, written in blue with a dove icon.",
        messageClass: "highlight-blue",
        victoryMessage: "Liberals successfully passed five policies!",
      };
    case LobbyState.LIBERAL_VICTORY_EXECUTION:
      return {
        headerImage: VictoryLiberalHeader,
        headerAlt: "Liberal Victory, written in blue with a dove icon.",
        messageClass: "highlight-blue",
        victoryMessage: "Liberals successfully executed Hitler!",
      };
    default:
      return {
        headerImage: VictoryLiberalHeader,
        headerAlt: "Victory",
        messageClass: "highlight-blue",
        victoryMessage: "Game over!",
      };
  }
};

export default function VictoryPrompt({
  gameState,
  user,
  onReturnToLobby,
}: VictoryPromptProps) {
  const { headerImage, headerAlt, messageClass, victoryMessage } =
    getVictoryDetails(gameState.state);

  return (
    <ButtonPrompt
      renderLabel={() => {
        return (
          <>
            <img src={headerImage} alt={headerAlt} id={"victory-header"} />
            <p style={{ textAlign: "center" }} className={messageClass}>
              {victoryMessage}
            </p>
            <div className={"victory-summary"}>
              <span className={"victory-summary-label"}>Policies enacted:</span>
              <span className={"victory-summary-count highlight-blue"}>
                Liberal {gameState.liberalPolicies}
              </span>
              <span className={"victory-summary-count highlight"}>
                Fascist {gameState.fascistPolicies}
              </span>
            </div>
          </>
        );
      }}
      buttonText={"RETURN TO LOBBY"}
      buttonOnClick={onReturnToLobby}
    >
      <PlayerDisplay
        players={gameState.playerOrder}
        playerDisabledFilter={DISABLE_EXECUTED_PLAYERS}
        showRoles={true}
        showLabels={false}
        useAsButtons={false}
        user={user}
        gameState={gameState}
      />
    </ButtonPrompt>
  );
}

import { DiscussionReactionType } from "./lobby_state";
import { GameSetupConfig } from "../setup/GameSetupConfig";
import { PolicyType } from "./game";

// TODO: Change these all to camelCase
export const enum WSCommandType {
  PING = "ping",
  START_GAME = "start-game",
  GET_STATE = "get-state",
  REGISTER_CHANCELLOR_VETO = "chancellor-veto",
  REGISTER_PRESIDENT_VETO = "president-veto",
  REGISTER_PEEK = "register-peek",
  END_TERM = "end-term",
  // Select an icon
  SELECT_ICON = "select-icon",
  // Select a player
  NOMINATE_CHANCELLOR = "nominate-chancellor",
  REGISTER_EXECUTION = "register-execution",
  REGISTER_SPECIAL_ELECTION = "register-special-election",
  GET_INVESTIGATION = "get-investigation",
  // Voting action
  REGISTER_VOTE = "register-vote",
  SET_BOT_STATUS = "set-bot-status",
  SET_OBSERVER_ASSIGNMENT = "set-observer-assignment",
  SET_DISCUSSION_REACTION = "set-discussion-reaction",
  SET_DISCUSSION_REACTION_CONFIG = "set-discussion-reaction-config",
  SET_GAME_SETUP = "set-game-setup",
  LEAVE_LOBBY = "leave-lobby",
  SET_MODERATOR_STATUS = "set-moderator-status",
  KICK_USER = "kick-user",
  BAN_USER = "ban-user",
  RESET_BANS = "reset-bans",
  // Policy action
  REGISTER_CHANCELLOR_CHOICE = "register-chancellor-choice",
  REGISTER_PRESIDENT_CHOICE = "register-president-choice",
  REGISTER_POLICY_CLAIM = "register-policy-claim",
}

/** All possible commands and associated parameters. */
export type ServerRequestPayload =
  | { command: WSCommandType.PING }
  | { command: WSCommandType.START_GAME }
  | { command: WSCommandType.GET_STATE }
  | { command: WSCommandType.REGISTER_CHANCELLOR_VETO }
  | { command: WSCommandType.REGISTER_PRESIDENT_VETO; veto: boolean }
  | { command: WSCommandType.REGISTER_PEEK }
  | { command: WSCommandType.END_TERM }
  | { command: WSCommandType.SELECT_ICON; icon: string }
  | { command: WSCommandType.NOMINATE_CHANCELLOR; target: string }
  | { command: WSCommandType.REGISTER_EXECUTION; target: string }
  | { command: WSCommandType.REGISTER_SPECIAL_ELECTION; target: string }
  | { command: WSCommandType.GET_INVESTIGATION; target: string }
  | { command: WSCommandType.REGISTER_VOTE; vote: boolean }
  | { command: WSCommandType.SET_BOT_STATUS; target: string; enabled: boolean }
  | {
      command: WSCommandType.SET_DISCUSSION_REACTION;
      reaction: DiscussionReactionType;
    }
  | {
      command: WSCommandType.SET_DISCUSSION_REACTION_CONFIG;
      durationSeconds: number;
      allowDeadPlayers: boolean;
    }
  | {
      command: WSCommandType.SET_GAME_SETUP;
      setupConfig: GameSetupConfig;
    }
  | {
      command: WSCommandType.SET_OBSERVER_ASSIGNMENT;
      target: string;
      observer?: string;
    }
  | { command: WSCommandType.LEAVE_LOBBY }
  | { command: WSCommandType.SET_MODERATOR_STATUS; target: string; enabled: boolean }
  | { command: WSCommandType.KICK_USER; target: string }
  | { command: WSCommandType.BAN_USER; target: string }
  | { command: WSCommandType.RESET_BANS }
  | { command: WSCommandType.REGISTER_CHANCELLOR_CHOICE; choice: number }
  | { command: WSCommandType.REGISTER_PRESIDENT_CHOICE; choice: number }
  | {
      command: WSCommandType.REGISTER_POLICY_CLAIM;
      refused: true;
    }
  | {
      command: WSCommandType.REGISTER_POLICY_CLAIM;
      refused: false;
      cards: PolicyType[];
    };

export type SendWSCommand = (payload: ServerRequestPayload) => void;

/**
 * A WebSocket command to send to the server.
 * @param {WSCommandType} command The command type.
 * @param {string} lobby The lobby to send the command to.
 * @param {string} name The name of the player sending the command.
 *
 * Optional, depending on command:
 * @param {number} icon The icon to select.
 * @param {string} target The target of the command. Used for powers and nominations.
 * @param {boolean} vote The vote to register.
 * @param {number} choice The policy index to register.
 */
export type WSCommand = {
  name: string;
  lobby: string;
} & ServerRequestPayload;

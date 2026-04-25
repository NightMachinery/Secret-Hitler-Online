import { PolicyType, Role } from "./game";
import { GameSetupConfig } from "../setup/GameSetupConfig";

export enum LobbyState {
  SETUP = "SETUP",
  CHANCELLOR_NOMINATION = "CHANCELLOR_NOMINATION",
  CHANCELLOR_VOTING = "CHANCELLOR_VOTING", // Voting on the chancellor is taking place.
  LEGISLATIVE_PRESIDENT = "LEGISLATIVE_PRESIDENT", // In the legislative phase. The president is selecting a card to discard.
  LEGISLATIVE_CHANCELLOR = "LEGISLATIVE_CHANCELLOR", // In the legislative phase. The chancellor is selecting a card to enact.
  LEGISLATIVE_PRESIDENT_VETO = "LEGISLATIVE_PRESIDENT_VETO", // Chancellor decided to initiate veto, President chooses whether to allow.
  POLICY_CLAIMS = "POLICY_CLAIMS", // President and chancellor are reporting policy cards.
  PP_PEEK = "PRESIDENTIAL_POWER_PEEK", // President may peek at the next three cards in the deck
  PP_INVESTIGATE = "PRESIDENTIAL_POWER_INVESTIGATE", // President can investigate a party membership
  PP_EXECUTION = "PRESIDENTIAL_POWER_EXECUTION", // President may choose a player to execute
  PP_ELECTION = "PRESIDENTIAL_POWER_ELECTION", // President chooses the next president, seat continues as normal after.
  POST_LEGISLATIVE = "POST_LEGISLATIVE", // Waiting for the President to end their turn.
  LIBERAL_VICTORY_POLICY = "LIBERAL_VICTORY_POLICY", // Liberal Party won through enacting Liberal policies.
  LIBERAL_VICTORY_EXECUTION = "LIBERAL_VICTORY_EXECUTION", // Liberal Party won through executing Hitler.
  FASCIST_VICTORY_POLICY = "FASCIST_VICTORY_POLICY", // Fascist Party won through enacting Fascist policies.
  FASCIST_VICTORY_ELECTION = "FASCIST_VICTORY_ELECTION", // Fascist Party won by successfully electing Hitler chancellor.
  ANARCHIST_VICTORY_POLICY = "ANARCHIST_VICTORY_POLICY", // Anarchists won through policy chaos.
}

export enum UserType {
  HUMAN = "HUMAN",
  BOT = "BOT",
  OBSERVER = "OBSERVER",
}

export enum ObserverAssignableTargetType {
  GENERATED_BOT = "GENERATED_BOT",
  TEMPORARY_HUMAN_BOT = "TEMPORARY_HUMAN_BOT",
}

export type PlayerState = {
  id?: Role;
  alive: boolean;
  investigated: boolean;
  type: UserType;
};

export const enum RoundHistoryResult {
  VOTE_FAILED = "VOTE_FAILED",
  LIBERAL = "LIBERAL",
  FASCIST = "FASCIST",
  ANARCHIST = "ANARCHIST",
}

export const enum PublicHistoryActionType {
  PEEK_USED = "PEEK_USED",
  INVESTIGATED = "INVESTIGATED",
  EXECUTED = "EXECUTED",
  SPECIAL_ELECTION = "SPECIAL_ELECTION",
}

export type PublicHistoryAction = {
  type: PublicHistoryActionType;
  president: string;
  target: string | null;
  hitlerExecuted: boolean | null;
  investigationResult?: PolicyType | null;
};

export type PolicyClaim = {
  refused: boolean;
  policies: PolicyType[];
};

export type RoundHistoryEntry = {
  round: number;
  president: string;
  chancellor: string;
  votes: Record<string, boolean>;
  votePassed: boolean;
  result: RoundHistoryResult | null;
  publicActions: PublicHistoryAction[];
  isCurrentRound?: boolean;
  policyClaimsRequired?: boolean;
  presidentPolicyClaim?: PolicyClaim | null;
  chancellorPolicyClaim?: PolicyClaim | null;
};

export const enum HistoryRoundsToShow {
  ALL = "ALL",
  LAST_1 = "LAST_1",
  LAST_3 = "LAST_3",
}

export type HistoryConfig = {
  showHistory: boolean;
  showPublicActions: boolean;
  showVoteBreakdown: boolean;
  showPolicyClaims: boolean;
  roundsToShow: HistoryRoundsToShow;
};

export const enum DiscussionReactionType {
  LIKE = "LIKE",
  DISLIKE = "DISLIKE",
  CLEAR = "CLEAR",
}

export type DiscussionReaction = {
  type: DiscussionReactionType.LIKE | DiscussionReactionType.DISLIKE;
  expiresAt: number;
};

export type DiscussionReactionConfig = {
  durationSeconds: number;
  allowDeadPlayers: boolean;
};

export type GameState = {
  state: LobbyState;
  lastState: LobbyState;
  playerOrder: string[];
  players: Record<string, PlayerState>;
  chancellor: string;
  president: string;
  lastChancellor: string;
  lastPresident: string;
  electionTracker: number;
  electionTrackerAdvanced: boolean;
  userVotes: Record<string, boolean>;
  liberalPolicies: number;
  fascistPolicies: number;
  anarchistPoliciesResolved?: number;
  drawSize: number;
  discardSize: number;
  // TODO: Make GameState type more complex, correlating
  // these fields with certain LobbyStates.
  // This actually is a little more complicated, since GameState currently represents the
  // the full packet data sent by the server. See `Lobby.java` `updateUser()`
  // for how all of this is packaged.
  presidentChoices?: PolicyType[];
  chancellorChoices?: PolicyType[];
  targetUser?: string;
  lastPolicy: string;
  vetoOccurred: boolean;
  peek?: PolicyType[];
  history: RoundHistoryEntry[];
  historyConfig: HistoryConfig;
  presidentPolicyClaimSubmitted?: boolean;
  chancellorPolicyClaimSubmitted?: boolean;
  discussionReactions: Record<string, DiscussionReaction>;
  discussionReactionConfig: DiscussionReactionConfig;
  creator?: string;
  moderators?: string[];
  connected?: Record<string, boolean>;
  botControlled?: Record<string, boolean>;
  controlledPlayer?: string;
  canAct?: boolean;
  observers?: string[];
  observerConnected?: Record<string, boolean>;
  observerAssignments?: Record<string, string>;
  observerAssignableTargets?: Record<string, ObserverAssignableTargetType>;
  selfType: UserType;
  setupConfig?: GameSetupConfig;

  usernames?: string[];
  /** Maps from usernames to icon keys */
  icon: Record<string, string>;
};

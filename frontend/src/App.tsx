import React, { Component } from "react";
import "./App.css";
import "./Lobby.css";
import "./fonts.css";
import MaxLengthTextField from "./util/MaxLengthTextField";
import CustomAlert from "./custom-alert/CustomAlert";
import RoleAlert from "./custom-alert/RoleAlert";
import EventBar from "./event-bar/EventBar";

// TODO: replace constants with enums from types
import {
  APP_HEADER_TEXT,
  CURRENT_ORIGIN,
  PAGE,
  MAX_FAILED_CONNECTIONS,
  SERVER_ADDRESS_HTTP,
  NEW_LOBBY,
  CHECK_LOGIN,
  SERVER_ADDRESS,
  WEBSOCKET,
  PARAM_USERNAMES,
  LOBBY_CODE_LENGTH,
  PARAM_STATE,
  STATE_CHANCELLOR_NOMINATION,
  STATE_CHANCELLOR_VOTING,
  PARAM_PRESIDENT,
  STATE_LEGISLATIVE_PRESIDENT,
  STATE_LEGISLATIVE_CHANCELLOR,
  STATE_POLICY_CLAIMS,
  PARAM_PACKET_TYPE,
  PACKET_LOBBY,
  PACKET_GAME_STATE,
  PACKET_INVESTIGATION,
  PACKET_OK,
  STATE_SETUP,
  STATE_POST_LEGISLATIVE,
  STATE_LEGISLATIVE_PRESIDENT_VETO,
  STATE_PP_INVESTIGATE,
  STATE_PP_EXECUTION,
  STATE_PP_ELECTION,
  STATE_PP_PEEK,
  PLAYER_IS_ALIVE,
  PARAM_TARGET,
  STATE_FASCIST_VICTORY_ELECTION,
  STATE_FASCIST_VICTORY_POLICY,
  STATE_ANARCHIST_VICTORY_POLICY,
  STATE_LIBERAL_VICTORY_EXECUTION,
  STATE_LIBERAL_VICTORY_POLICY,
  WEBSOCKET_HEADER,
  DEBUG,
  PACKET_PONG,
  PING_INTERVAL,
  SERVER_PING,
  PARAM_ICON,
  PARAM_INVESTIGATION,
  MAX_PLAYERS,
  REPO_ISSUES_URL,
  REPO_README_URL,
} from "./constants";

import PlayerDisplay, {
  DISABLE_EXECUTED_PLAYERS,
} from "./player/PlayerDisplay";
import StatusBar from "./status-bar/StatusBar";
import Board from "./board/Board";
import VotingPrompt from "./custom-alert/VotingPrompt";
import PresidentLegislativePrompt from "./custom-alert/PresidentLegislativePrompt";
import ChancellorLegislativePrompt from "./custom-alert/ChancellorLegislativePrompt";
import PolicyClaimPrompt from "./custom-alert/PolicyClaimPrompt";
import VetoPrompt from "./custom-alert/VetoPrompt";
import ElectionTrackerAlert from "./custom-alert/ElectionTrackerAlert";
import PolicyEnactedAlert from "./custom-alert/PolicyEnactedAlert";
import {
  SelectExecutionPrompt,
  SelectInvestigationPrompt,
  SelectNominationPrompt,
  SelectSpecialElectionPrompt,
} from "./custom-alert/SelectPlayerPrompt";
import ButtonPrompt from "./custom-alert/ButtonPrompt";
import PeekPrompt from "./custom-alert/PeekPrompt";
import InvestigationAlert from "./custom-alert/InvestigationAlert";
import Deck from "./board/Deck";
import PlayerPolicyStatus from "./util/PlayerPolicyStatus";
import HistoryPanel from "./util/HistoryPanel";
import IconSelection from "./custom-alert/IconSelection";
import HelmetMetaData from "./util/HelmetMetaData";
import { defaultPortrait } from "./assets";
import Player from "./player/Player";
import LoginPageContent from "./LoginPageContent";
import Cookies from "js-cookie";
import AnnouncementBox from "./util/AnnouncementBox";
import VictoryPrompt from "./custom-alert/VictoryPrompt";
import DiscussionReactionDock from "./discussion-reaction/DiscussionReactionDock";
import {
  getReactionSoundMuted,
  playDiscussionReactionSound,
  setReactionSoundMuted,
} from "./discussion-reaction/reactionSound";
import {
  DiscussionReactionConfig,
  DiscussionReactionType,
  GameState,
  HistoryConfig,
  HistoryRoundsToShow,
  LobbyState,
  ObserverAssignableTargetType,
  PlayerState,
  PolicyType,
  ServerRequestPayload,
  UserType,
  WSCommand,
  WSCommandType,
} from "./types";
import { isVictoryState } from "./utils";
import {
  applySetupPresetAutomation,
  createStandardSetupConfig,
  DEFAULT_SETUP_AUTOMATION,
  GameSetupConfig,
  normalizeSetupConfig,
  normalizeSetupAutomation,
  parseSetupConfigJson5,
  SetupAutomationConfig,
  validateSetupConfig,
} from "./setup/GameSetupConfig";

const EVENT_BAR_FADE_OUT_DURATION = 500;
const CUSTOM_ALERT_FADE_DURATION = 1000;
const DEFAULT_HISTORY_CONFIG: HistoryConfig = {
  showHistory: true,
  showPublicActions: true,
  showVoteBreakdown: true,
  showPolicyClaims: true,
  roundsToShow: HistoryRoundsToShow.ALL,
};
const DEFAULT_DISCUSSION_REACTION_CONFIG: DiscussionReactionConfig = {
  durationSeconds: 15,
  allowDeadPlayers: true,
};

const DEFAULT_GAME_STATE: GameState = {
  liberalPolicies: 0,
  fascistPolicies: 0,
  anarchistPoliciesResolved: 0,
  discardSize: 0,
  drawSize: 17,
  players: {},
  playerOrder: [],
  state: LobbyState.SETUP,
  president: "",
  chancellor: "",
  electionTracker: 0,
  vetoOccurred: false,
  lastState: LobbyState.SETUP,
  lastChancellor: "",
  lastPresident: "",
  electionTrackerAdvanced: false,
  userVotes: {},
  presidentChoices: [],
  chancellorChoices: [],
  targetUser: "",
  lastPolicy: "",
  peek: [],
  history: [],
  historyConfig: DEFAULT_HISTORY_CONFIG,
  presidentPolicyClaimSubmitted: false,
  chancellorPolicyClaimSubmitted: false,
  discussionReactions: {},
  discussionReactionConfig: DEFAULT_DISCUSSION_REACTION_CONFIG,
  creator: "",
  moderators: [],
  connected: {},
  botControlled: {},
  controlledPlayer: "",
  canAct: false,
  observers: [],
  observerConnected: {},
  observerAssignments: {},
  observerAssignableTargets: {},
  icon: {},
  selfType: UserType.OBSERVER,
  setupConfig: createStandardSetupConfig(5),
};

const COOKIE_NAME = "name";
const COOKIE_LOBBY = "lobby";
const AUTH_TOKEN_STORAGE_KEY = "sho_auth_token_v1";

const generateAuthToken = (): string => {
  if (typeof window !== "undefined") {
    const cryptoObj = window.crypto;
    const randomUUID = (cryptoObj as any)?.randomUUID;
    if (typeof randomUUID === "function") {
      return randomUUID.call(cryptoObj);
    }
    if (cryptoObj && cryptoObj.getRandomValues) {
      const bytes = new Uint8Array(16);
      cryptoObj.getRandomValues(bytes);
      return Array.from(bytes)
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
    }
  }
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  );
};

if (DEBUG) {
  console.warn("Running in debug mode.");
}

// TODO: Turn App into a functional component
// TODO: Refactor out pages into separate components
// TODO: Refactor out AnimationQueue

// TODO: Remove this type and replace with actual state variables.
type AppState = {
  page: PAGE;
  joinName: string;
  joinLobby: string;
  joinError: string;
  createLobbyName: string;
  createLobbyError: string;
  createLobbyShowHistory: boolean;
  createLobbyShowPublicActions: boolean;
  createLobbyShowVoteBreakdown: boolean;
  createLobbyShowPolicyClaims: boolean;
  createLobbyRoundsToShow: HistoryRoundsToShow;
  name: string;
  lobby: string;
  lobbyFromURL: boolean;
  usernames: string[];
  icons: { [key: string]: string };
  lobbyCreator: string;
  lobbyModerators: string[];
  lobbyConnected: Record<string, boolean>;
  lobbySetupConfig: GameSetupConfig;
  lobbySetupAutomation: SetupAutomationConfig;
  lobbyHistoryConfig: HistoryConfig;
  lobbySetupExpanded: boolean;
  lobbySetupImportText: string;
  lobbySetupError: string;
  gameState: GameState;
  /* Stores the last gameState[PARAM_STATE] value to check for changes. */
  lastState: any;
  liberalPolicies: number;
  fascistPolicies: number;
  /*The position of the election tracker, ranging from 0 to 3.*/
  electionTracker: number;
  showVotes: boolean;
  drawDeckSize: number;
  discardDeckSize: number;
  snackbarMessage: string;
  showAlert: boolean;
  alertContent: JSX.Element;
  alertMinimized: boolean;
  showEventBar: boolean;
  eventBarMessage: string;
  statusBarText: string;
  reactionSoundsMuted: boolean;
  allAnimationsFinished: boolean;
};

const defaultAppState: AppState = {
  page: PAGE.LOGIN,
  joinName: "",
  joinLobby: "",
  joinError: "",
  createLobbyName: "",
  createLobbyError: "",
  createLobbyShowHistory: true,
  createLobbyShowPublicActions: true,
  createLobbyShowVoteBreakdown: true,
  createLobbyShowPolicyClaims: true,
  createLobbyRoundsToShow: HistoryRoundsToShow.ALL,
  name: "P1",
  lobby: "AAAAAA",
  lobbyFromURL: false,
  usernames: [],
  icons: {},
  lobbyCreator: "",
  lobbyModerators: [],
  lobbyConnected: {},
  lobbySetupConfig: createStandardSetupConfig(5),
  lobbySetupAutomation: DEFAULT_SETUP_AUTOMATION,
  lobbyHistoryConfig: DEFAULT_HISTORY_CONFIG,
  lobbySetupExpanded: true,
  lobbySetupImportText: "",
  lobbySetupError: "",
  gameState: DEFAULT_GAME_STATE,
  lastState: {},
  liberalPolicies: 0,
  fascistPolicies: 0,
  electionTracker: 0,
  showVotes: false,
  drawDeckSize: 17,
  discardDeckSize: 0,
  snackbarMessage: "",
  showAlert: false,
  alertContent: <div />,
  alertMinimized: false,
  showEventBar: false,
  eventBarMessage: "",
  statusBarText: "---",
  reactionSoundsMuted: false,
  allAnimationsFinished: true,
};

class App extends Component<{}, AppState> {
  websocket?: WebSocket = undefined;
  failedConnections: number = 0;
  pingInterval?: NodeJS.Timeout = undefined;
  reconnectOnConnectionClosed: boolean = true;
  snackbarMessages: number = 0;
  animationQueue: (() => void)[] = [];
  okMessageListeners: (() => void)[] = [];
  allAnimationsFinished: boolean = true;
  gameOver: boolean = false;
  authToken: string = "";
  hasHydratedDiscussionReactions: boolean = false;

  getOrCreateAuthToken(): string {
    if (this.authToken) {
      return this.authToken;
    }
    try {
      const storedToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      if (storedToken && storedToken.trim() !== "") {
        this.authToken = storedToken;
        return this.authToken;
      }
      const newToken = generateAuthToken();
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, newToken);
      this.authToken = newToken;
      return this.authToken;
    } catch {
      // Fallback for environments where localStorage is unavailable.
      this.authToken = generateAuthToken();
      return this.authToken;
    }
  }

  updateBrowserLobbyURL(lobby: string) {
    if (typeof window === "undefined") {
      return;
    }
    const normalizedLobby = lobby.toUpperCase().substr(0, LOBBY_CODE_LENGTH);
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get("lobby") === normalizedLobby) {
      return;
    }
    currentUrl.searchParams.set("lobby", normalizedLobby);
    const query = currentUrl.searchParams.toString();
    const nextPath = query
      ? `${currentUrl.pathname}?${query}${currentUrl.hash}`
      : `${currentUrl.pathname}${currentUrl.hash}`;
    window.history.replaceState({}, "", nextPath);
  }

  // noinspection DuplicatedCode
  constructor(props: any) {
    super(props);

    let name = Cookies.get(COOKIE_NAME) ? Cookies.get(COOKIE_NAME) : "";
    let lobby = Cookies.get(COOKIE_LOBBY) ? Cookies.get(COOKIE_LOBBY) : "";

    this.state = {
      ...defaultAppState,
      joinName: name || "",
      joinLobby: lobby || "",
      createLobbyName: name || "",
      reactionSoundsMuted: getReactionSoundMuted(name || ""),
    };
    this.getOrCreateAuthToken();

    // These are necessary for handling class fields safely (ex: websocket)
    this.onWebSocketClose = this.onWebSocketClose.bind(this);
    this.tryOpenWebSocket = this.tryOpenWebSocket.bind(this);
    this.onClickLeaveLobby = this.onClickLeaveLobby.bind(this);
    this.onClickCopy = this.onClickCopy.bind(this);
    this.onClickStartGame = this.onClickStartGame.bind(this);
    this.sendWSCommand = this.sendWSCommand.bind(this);
    this.showSnackBar = this.showSnackBar.bind(this);
    this.onAnimationFinish = this.onAnimationFinish.bind(this);
    this.onGameStateChanged = this.onGameStateChanged.bind(this);
    this.hideAlertAndFinish = this.hideAlertAndFinish.bind(this);
    this.minimizeAlert = this.minimizeAlert.bind(this);
    this.restoreAlert = this.restoreAlert.bind(this);
    this.addAnimationToQueue = this.addAnimationToQueue.bind(this);
    this.clearAnimationQueue = this.clearAnimationQueue.bind(this);
    this.queueAlert = this.queueAlert.bind(this);
    this.showChangeIconAlert = this.showChangeIconAlert.bind(this);
    this.updateChangeIconAlert = this.updateChangeIconAlert.bind(this);
    this.onClickChangeIcon = this.onClickChangeIcon.bind(this);

    // Ping the server to wake it up if it's not currently being used
    // This reduces the delay users experience when starting lobbies
    fetch(SERVER_ADDRESS_HTTP + SERVER_PING);
  }

  /////////// Server Communication
  // <editor-fold desc="Server Communication">

  /**
   * Attempts to request the server to create a new lobby and returns the response.
   * @return {Promise<Response>}
   */
  async tryCreateLobby() {
    return fetch(SERVER_ADDRESS_HTTP + NEW_LOBBY);
  }

  /**
   * Checks if the login is valid.
   * @param name the name of the user.
   * @param lobby the lobby code.
   * @return {Promise<Response>} The response from the server.
   */
  async tryLogin(name: string, lobby: string) {
    const token = this.getOrCreateAuthToken();
    return await fetch(
      SERVER_ADDRESS_HTTP +
        CHECK_LOGIN +
        "?name=" +
        encodeURI(name) +
        "&lobby=" +
        encodeURI(lobby) +
        "&token=" +
        encodeURIComponent(token)
    );
  }

  /**
   * Attempts to open a WebSocket with the server.
   * @param name the name of the user to connect with.
   * @param lobby the lobby to connect with.
   * @effects If a connection was successfully established, sets the state with the {@code name}, {@code lobby},
   *          and {@code ws} parameters. The WebSocket has a message callback to this.onWebSocketMessage().
   * @return {boolean} true if the connection was opened successfully. Otherwise, returns false.
   */
  tryOpenWebSocket(name: string, lobby: string) {
    if (DEBUG) {
      console.log("Opening connection with lobby: " + lobby);
      console.log("Failed connections: " + this.failedConnections);
    }
    const token = this.getOrCreateAuthToken();
    let url =
      WEBSOCKET_HEADER +
      SERVER_ADDRESS +
      WEBSOCKET +
      "?name=" +
      encodeURIComponent(name) +
      "&lobby=" +
      encodeURIComponent(lobby) +
      "&token=" +
      encodeURIComponent(token);
    if (DEBUG) {
      console.trace("TryOpenWebsocket URL: " + url);
    }

    // Close existing websocket
    if (this.websocket) {
      // Clear onClose event to prevent reconnection
      this.websocket.onclose = () => {};
      this.websocket.close();
      this.websocket = undefined;
    }

    let ws = new WebSocket(url);
    if (ws.OPEN) {
      console.log("Websocket opened successfully to " + url);
      this.updateBrowserLobbyURL(lobby);
      this.websocket = ws;
      this.reconnectOnConnectionClosed = true;
      // Only move the player to the lobby page if they were logging in.
      // This is to prevent the bug where players flash in/out of the lobby page
      // at random points in the game.
      if (this.state.page === PAGE.LOGIN) {
        this.setState({ page: PAGE.LOBBY });
      }
      this.setState({
        name: name,
        lobby: lobby,
        usernames: [],
        lobbyCreator: "",
        lobbyModerators: [],
        lobbyConnected: {},
        joinName: "",
        joinLobby: "",
        joinError: "",
        createLobbyName: "",
        createLobbyError: "",
        reactionSoundsMuted: getReactionSoundMuted(name),
      });
      ws.onmessage = (msg) => this.onWebSocketMessage(msg);
      ws.onclose = (event) => this.onWebSocketClose(event);

      // Ping the web server at a set interval.
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
      }
      this.pingInterval = setInterval(() => {
        this.sendWSCommand({ command: WSCommandType.PING });
      }, PING_INTERVAL);

      return true;
    } else {
      return false;
    }
  }

  /**
   * Called when the websocket closes.
   * @effects attempts to reopen the websocket connection.
   *          If the user pressed the "Leave Lobby" button or a maximum number of attempts has been reached
   *          ({@code MAX_FAILED_CONNECTIONS}), does not reopen the websocket connection and returns the user to the
   *          login screen with a relevant error message.
   */
  onWebSocketClose(event?: CloseEvent) {
    // Clear the server ping interval when the socket is closed.
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    const closeReason = event?.reason || "";
    const closedBecauseLobbyRemoval =
      closeReason === "Kicked from the lobby." ||
      closeReason === "Banned from the lobby." ||
      closeReason === "Left lobby." ||
      closeReason === "Replaced by a newer session.";

    if (closedBecauseLobbyRemoval) {
      this.reconnectOnConnectionClosed = false;
      this.setState({
        page: PAGE.LOGIN,
        joinName: this.state.name,
        joinLobby: this.state.lobby,
        joinError:
          closeReason === "Banned from the lobby."
            ? "You have been banned from this lobby."
            : closeReason === "Kicked from the lobby."
              ? "You were kicked from this lobby."
              : closeReason === "Replaced by a newer session."
                ? "This tab was replaced by a newer session."
                : "",
      });
      this.clearAnimationQueue();
      return;
    }

    console.log(
      "A websocket closed: " +
        this.websocket?.url +
        ". Reopening to current lobby " +
        this.state.lobby
    );
    //

    if (
      this.reconnectOnConnectionClosed &&
      this.failedConnections < MAX_FAILED_CONNECTIONS
    ) {
      if (this.failedConnections >= 1) {
        // Only show the error bar if the first attempt has failed.
        this.showSnackBar("Lost connection to the server: retrying...");
      }
      this.failedConnections += 1;
      this.tryOpenWebSocket(this.state.name, this.state.lobby);
    } else if (this.reconnectOnConnectionClosed) {
      if (DEBUG) {
        console.log("Disconnecting from lobby.");
      }
      this.setState({
        joinName: this.state.name,
        joinLobby: this.state.lobby,
        joinError:
          closeReason === "Banned from the lobby."
            ? "You have been banned from this lobby."
            : closeReason === "Kicked from the lobby."
              ? "You were kicked from this lobby."
              : closeReason === "Replaced by a newer session."
                ? "This tab was replaced by a newer session."
                : "Disconnected from the lobby.",
        page: PAGE.LOGIN,
      });
      this.clearAnimationQueue();
    } else {
      // User purposefully closed the connection.
      if (this.gameOver) {
        // Do not reopen if the game is over, since disconnecting is intentional.
      } else {
        this.setState({
          page: PAGE.LOGIN,
          joinName: this.state.name,
          joinLobby: this.state.lobby,
          joinError: "",
        });
        this.clearAnimationQueue();
      }
    }
  }

  async onWebSocketMessage(msg: MessageEvent) {
    this.failedConnections = 0;
    let message = JSON.parse(msg.data);
    // Decode message contents as communication is encoded
    if (DEBUG) {
      console.log(message);
    }
    switch (message[PARAM_PACKET_TYPE]) {
      case PACKET_LOBBY:
        if (typeof message.creator !== "string") {
          message.creator = "";
        }
        if (!Array.isArray(message.moderators)) {
          message.moderators = [];
        }
        if (!message.connected || typeof message.connected !== "object") {
          message.connected = {};
        }
        if (!message.setupConfig || typeof message.setupConfig !== "object") {
          message.setupConfig = createStandardSetupConfig(
            Math.max(5, Array.isArray(message[PARAM_USERNAMES]) ? message[PARAM_USERNAMES].length : 5)
          );
        } else {
          message.setupConfig = normalizeSetupConfig(message.setupConfig);
        }
        if (!message.historyConfig || typeof message.historyConfig !== "object") {
          message.historyConfig = { ...DEFAULT_HISTORY_CONFIG };
        } else {
          message.historyConfig = {
            ...DEFAULT_HISTORY_CONFIG,
            ...message.historyConfig,
          };
        }
        message.setupAutomation = normalizeSetupAutomation(
          message.setupAutomation || {
            preset: message.setupConfig.preset === "ANARCHIST" ? "ANARCHIST" : "STANDARD",
          }
        );
        this.setState({
          usernames: message[PARAM_USERNAMES],
          icons: message[PARAM_ICON],
          lobbyCreator: message.creator,
          lobbyModerators: message.moderators,
          lobbyConnected: message.connected,
          lobbySetupConfig: message.setupConfig,
          lobbySetupAutomation: message.setupAutomation,
          lobbyHistoryConfig: message.historyConfig,
          lobbySetupImportText: JSON.stringify(message.setupConfig, null, 2),
          lobbySetupError: "",
          page: PAGE.LOBBY,
        });
        if (message[PARAM_ICON][this.state.name] === defaultPortrait) {
          this.showChangeIconAlert();
        }
        this.updateChangeIconAlert();
        break;

      case PACKET_GAME_STATE:
        if (!Array.isArray(message.history)) {
          message.history = [];
        }
        if (!message.historyConfig) {
          message.historyConfig = { ...DEFAULT_HISTORY_CONFIG };
        } else {
          message.historyConfig = {
            ...DEFAULT_HISTORY_CONFIG,
            ...message.historyConfig,
          };
        }
        if (typeof message.presidentPolicyClaimSubmitted !== "boolean") {
          message.presidentPolicyClaimSubmitted = false;
        }
        if (typeof message.chancellorPolicyClaimSubmitted !== "boolean") {
          message.chancellorPolicyClaimSubmitted = false;
        }
        if (
          !message.discussionReactions ||
          typeof message.discussionReactions !== "object"
        ) {
          message.discussionReactions = {};
        }
        if (
          !message.discussionReactionConfig ||
          typeof message.discussionReactionConfig !== "object"
        ) {
          message.discussionReactionConfig = {
            ...DEFAULT_DISCUSSION_REACTION_CONFIG,
          };
        }
        if (
          typeof message.discussionReactionConfig.durationSeconds !== "number"
        ) {
          message.discussionReactionConfig.durationSeconds =
            DEFAULT_DISCUSSION_REACTION_CONFIG.durationSeconds;
        }
        if (
          typeof message.discussionReactionConfig.allowDeadPlayers !== "boolean"
        ) {
          message.discussionReactionConfig.allowDeadPlayers =
            DEFAULT_DISCUSSION_REACTION_CONFIG.allowDeadPlayers;
        }
        if (!message.botControlled || typeof message.botControlled !== "object") {
          message.botControlled = {};
        }
        if (typeof message.controlledPlayer !== "string") {
          message.controlledPlayer = "";
        }
        if (typeof message.canAct !== "boolean") {
          message.canAct = false;
        }
        if (!Array.isArray(message.observers)) {
          message.observers = [];
        }
        if (
          !message.observerConnected ||
          typeof message.observerConnected !== "object"
        ) {
          message.observerConnected = {};
        }
        if (
          !message.observerAssignments ||
          typeof message.observerAssignments !== "object"
        ) {
          message.observerAssignments = {};
        }
        if (
          !message.observerAssignableTargets ||
          typeof message.observerAssignableTargets !== "object"
        ) {
          message.observerAssignableTargets = {};
        }
        if (typeof message.creator !== "string") {
          message.creator = "";
        }
        if (!Array.isArray(message.moderators)) {
          message.moderators = [];
        }
        if (!message.connected || typeof message.connected !== "object") {
          message.connected = {};
        }
        if (!message.setupConfig || typeof message.setupConfig !== "object") {
          message.setupConfig = createStandardSetupConfig(
            Math.max(5, Array.isArray(message.playerOrder) ? message.playerOrder.length : 5)
          );
        } else {
          message.setupConfig = normalizeSetupConfig(message.setupConfig);
        }
        message.setupAutomation = normalizeSetupAutomation(
          message.setupAutomation || {
            preset: message.setupConfig.preset === "ANARCHIST" ? "ANARCHIST" : "STANDARD",
          }
        );
        if (typeof message.anarchistPoliciesResolved !== "number") {
          message.anarchistPoliciesResolved = 0;
        }
        this.handleDiscussionReactionUpdates(message);
        if (message !== this.state.gameState) {
          this.onGameStateChanged(message);
        }
        this.setState({ gameState: message, page: PAGE.GAME });
        break;

      case PACKET_OK: // Traverse all listeners and call the functions.
        let i = 0;
        for (i; i < this.okMessageListeners.length && i < 1; i++) {
          this.okMessageListeners[i]();
        }
        this.okMessageListeners = []; // clear all listeners.
        break;

      case PACKET_INVESTIGATION:
        // Trigger investigation screen when the server responds.
        console.log(
          "Investigated player role: " + message[PARAM_INVESTIGATION]
        );
        // Set party to liberal/fascist using sent packet
        const party = message[PARAM_INVESTIGATION];

        this.queueAlert(
          <InvestigationAlert
            party={party}
            target={message[PARAM_TARGET]}
            hideAlert={this.hideAlertAndFinish}
          />,
          false
        );
        break;
      case PACKET_PONG:
      default:
      // No action
    }
  }

  /**
   * Sends a specified command to the server.
   * @param command the String command label.
   * @param params a dictionary of any parameters that need to be provided with the command.
   * @effects sends a message to the server with the following parameters:
   *          {@code PARAM_COMMAND}: {@code command}
   *          {@code PARAM_LOBBY}: {@code this.state.lobby}
   *          {@code PARAM_NAME}: {@code this.state.name}
   *          and each (key, value) pair in {@code params}.
   */
  sendWSCommand(request: ServerRequestPayload) {
    // Do not need to encode name + lobby because this is sent through websocket
    const data: WSCommand = {
      ...request,
      name: this.state.name,
      lobby: this.state.lobby,
    };

    if (DEBUG) {
      console.log(JSON.stringify(data));
    }
    if (this.websocket !== undefined) {
      this.websocket.send(JSON.stringify(data));
    } else {
      this.showSnackBar(
        "Could not connect to the server. Try refreshing the page if this happens again."
      );
    }
  }

  //</editor-fold>

  /////////////////// Login Page
  // <editor-fold desc="Login Page">

  /**
   * Updates the "Name" field under Join Game.
   * @param text the text to update the text field to.
   */
  updateJoinName = (text: string) => {
    this.setState({
      joinName: text,
    });
  };

  /**
   * Updates the Lobby field under Join Game.
   * @param text the text to update the text field to.
   */
  updateJoinLobby = (text: string) => {
    this.setState({
      joinLobby: text,
    });
  };

  /**
   * Updates the Name field under Create Lobby.
   * @param text the text to update the text field to.
   */
  updateCreateLobbyName = (text: string) => {
    this.setState({
      createLobbyName: text,
    });
  };

  updateCreateLobbyShowHistory = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({
      createLobbyShowHistory: event.target.checked,
    });
  };

  updateCreateLobbyShowPublicActions = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    this.setState({
      createLobbyShowPublicActions: event.target.checked,
    });
  };

  updateCreateLobbyShowVoteBreakdown = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    this.setState({
      createLobbyShowVoteBreakdown: event.target.checked,
    });
  };

  updateCreateLobbyShowPolicyClaims = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    this.setState({
      createLobbyShowPolicyClaims: event.target.checked,
    });
  };

  updateCreateLobbyRoundsToShow = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    this.setState({
      createLobbyRoundsToShow: event.target.value as HistoryRoundsToShow,
    });
  };

  shouldJoinButtonBeEnabled() {
    return (
      this.state.joinLobby.length === LOBBY_CODE_LENGTH &&
      this.state.joinName.length !== 0
    );
  }

  shouldCreateLobbyButtonBeEnabled() {
    return this.state.createLobbyName.length !== 0;
  }

  /**
   * Attempts to connect to the lobby via websocket.
   */
  onClickJoin = () => {
    this.setState({ joinError: "Connecting..." });
    this.tryLogin(this.state.joinName, this.state.joinLobby)
      .then((response) => {
        if (!response.ok) {
          if (DEBUG) {
            console.log("Response is not ok");
          }
          if (response.status === 404) {
            this.setState({ joinError: "The lobby could not be found." });
          } else if (response.status === 403) {
            this.setState({
              joinError:
                "This name is already in use or protected in this lobby.",
            });
          } else if (response.status === 488) {
            this.setState({ joinError: "The lobby is currently in a game." });
          } else if (response.status === 489) {
            this.setState({ joinError: "The lobby is currently full." });
          } else if (response.status === 490) {
            this.setState({
              joinError: "You have been banned from this lobby.",
            });
          } else {
            this.setState({
              joinError:
                "There was an error connecting to the server. Please try again.",
            });
          }
        } else {
          // Username and lobby were verified. Try to open websocket.
          if (
            !this.tryOpenWebSocket(this.state.joinName, this.state.joinLobby)
          ) {
            this.setState({
              joinError:
                "There was an error connecting to the server. Please try again.",
            });
          } else {
            // Save the username and lobby login
            Cookies.set(COOKIE_NAME, this.state.name, { expires: 7 });
            Cookies.set(COOKIE_LOBBY, this.state.joinLobby);
          }
        }
      })
      .catch(() => {
        this.setState({
          joinError:
            "There was an error contacting the server. Please wait and try again.",
        });
      });
  };

  /**
   * Attempts to connect to the server and create a new lobby, and then opens a connection to the lobby.
   */
  onClickCreateLobby = () => {
    this.setState({ createLobbyError: "Connecting..." });
    this.tryCreateLobby()
      .then((response) => {
        if (response.ok) {
          response.text().then((lobbyCode) => {
            if (!this.tryOpenWebSocket(this.state.createLobbyName, lobbyCode)) {
              // if the connection failed
              this.setState({
                createLobbyError:
                  "There was an error connecting to the server. Please try again.",
              });
            } else {
              // Save the username and lobby login
              Cookies.set(COOKIE_NAME, this.state.name, { expires: 7 });
              Cookies.set(COOKIE_LOBBY, lobbyCode);
            }
          });
        } else {
          this.setState({
            createLobbyError:
              "There was an error connecting to the server. Please try again.",
          });
        }
      })
      .catch(() => {
        this.setState({
          createLobbyError:
            "There was an error connecting to the server. Please try again.",
        });
      });
  };

  renderLoginPage() {
    return (
      <div className="App">
        <header className="App-header">{APP_HEADER_TEXT}</header>
        <br />
        <div style={{ textAlign: "center" }}>
          {/** TODO: Add reusable announcement component. 
                    <div style={{backgroundColor: "#222222", width: "50vmin", margin: "0 auto", padding: "20px"}}>
                        <p>
                            Hello! Secret Hitler Online is currently undergoing some maintenance.
                            Sorry for the interruption and please check back in in a few hours.
                        </p>
                        <p style={{fontStyle: "italic", fontSize: "calc(8px + 1vmin)"}}>(DATE TIME PM PT)</p>

                    </div>
                    */}
          <h2>JOIN A GAME</h2>
          <MaxLengthTextField
            label={"Lobby"}
            onChange={this.updateJoinLobby}
            value={this.state.joinLobby}
            maxLength={LOBBY_CODE_LENGTH}
            showCharCount={false}
            forceUpperCase={true}
          />

          <MaxLengthTextField
            label={"Your Name"}
            onChange={this.updateJoinName}
            value={this.state.joinName}
            maxLength={12}
          />
          <p id={"errormessage"}>{this.state.joinError}</p>
          <button
            onClick={this.onClickJoin}
            disabled={!this.shouldJoinButtonBeEnabled()}
          >
            JOIN
          </button>
        </div>
        <br />
        <div>
          <h2>CREATE A LOBBY</h2>
          <MaxLengthTextField
            label={"Your Name"}
            onChange={this.updateCreateLobbyName}
            value={this.state.createLobbyName}
            maxLength={12}
          />
          <p id={"errormessage"}>{this.state.createLobbyError}</p>
          <button
            onClick={this.onClickCreateLobby}
            disabled={!this.shouldCreateLobbyButtonBeEnabled()}
          >
            CREATE LOBBY
          </button>
        </div>
        <AnnouncementBox>
          <h2>Announcing: BOTS!</h2>
          <p>
            You can now start games with only 1-4 players; extra spots will be
            filled by bots.
          </p>
          <p>
            Bots are still in beta, so expect a few rough edges while they
            continue to improve.
          </p>
          <p style={{ fontStyle: "italic", fontSize: "calc(8px + 1vmin)" }}>
            (Please be nice, they are trying their best.)
          </p>
        </AnnouncementBox>
        <br />
        <LoginPageContent />
      </div>
    );
  }

  //</editor-fold>

  /////////////////// Lobby Page
  //<editor-fold desc="Lobby Page">

  /**
   * Returns whether the supplied user is a moderator in the setup lobby.
   */
  isLobbyModerator(name: string) {
    return this.state.lobbyModerators.includes(name);
  }

  isLobbyManager(name: string) {
    return name === this.state.lobbyCreator || this.isLobbyModerator(name);
  }

  getOfflineLobbyPlayers() {
    return this.state.usernames.filter(
      (name) => this.state.lobbyConnected[name] === false
    );
  }

  showConfirmStartOfflinePrompt(offlinePlayers: string[]) {
    this.queueAlert(
      <ButtonPrompt
        label={"START WITH OFFLINE PLAYERS?"}
        headerText={
          offlinePlayers.length === 1
            ? "This player is offline and will start disconnected:"
            : "These players are offline and will start disconnected:"
        }
        footerText={"They can reconnect during the game with the same session."}
        renderButton={() => (
          <div className="prompt-button-row">
            <button
              id={"prompt-button"}
              onClick={() => {
                this.hideAlertAndFinish();
              }}
            >
              CANCEL
            </button>
            <button
              id={"prompt-button"}
              onClick={() => {
                this.hideAlertAndFinish();
                this.startGame();
              }}
            >
              START ANYWAY
            </button>
          </div>
        )}
      >
        <PlayerDisplay
          user={this.state.name}
          gameState={{
            ...DEFAULT_GAME_STATE,
            state: LobbyState.SETUP,
            playerOrder: offlinePlayers,
            icon: offlinePlayers.reduce<Record<string, string>>((acc, player) => {
              acc[player] = this.state.icons[player] || defaultPortrait;
              return acc;
            }, {}),
            players: offlinePlayers.reduce((acc, player) => {
              acc[player] = {
                alive: true,
                investigated: false,
                type: UserType.HUMAN,
              };
              return acc;
            }, {} as Record<string, PlayerState>),
            connected: offlinePlayers.reduce<Record<string, boolean>>(
              (acc, player) => {
                acc[player] = false;
                return acc;
              },
              {}
            ),
            creator: this.state.lobbyCreator,
            moderators: this.state.lobbyModerators,
          }}
          showLabels={false}
          players={offlinePlayers}
        />
      </ButtonPrompt>,
      false
    );
  }

  renderLobbyPlayerList() {
    const userIsManager = this.isLobbyManager(this.state.name);
    return this.state.usernames.map((name: string) => {
      const isCreator = name === this.state.lobbyCreator;
      const isModerator = this.isLobbyModerator(name);
      const isOffline = this.state.lobbyConnected[name] === false;
      const canManage =
        userIsManager &&
        name !== this.state.name &&
        (!isCreator || this.state.name === this.state.lobbyCreator);

      const statusBadges = [
        isCreator ? { label: "CREATOR", variant: "creator" } : null,
        !isCreator && isModerator ? { label: "MOD", variant: "moderator" } : null,
        isOffline ? { label: "OFFLINE", variant: "offline" } : null,
      ].filter(Boolean) as { label: string; variant?: string }[];

      const actionButtons = canManage
        ? [
            {
              label: "MANAGE",
              title: `Manage ${name}`,
              onClick: () => this.showLobbyManageUserPrompt(name),
              variant: "secondary",
            },
          ]
        : [];

      return (
        <Player
          key={name}
          name={name}
          showRole={false}
          icon={this.state.icons[name]}
          isBusy={this.state.icons[name] === defaultPortrait}
          highlight={name === this.state.name}
          statusBadges={statusBadges}
          actionButtons={actionButtons}
        />
      );
    });
  }

  onClickChangeIcon() {
    this.showChangeIconAlert();
  }

  updateChangeIconAlert() {
    this.setState({
      alertContent: (
        <IconSelection
          onConfirm={() => {
            this.clearAnimationQueue();
            this.hideAlertAndFinish();
          }}
          sendWSCommand={this.sendWSCommand}
          playerToIcon={this.state.icons}
          players={this.state.usernames}
          user={this.state.name}
        />
      ),
    });
  }

  showChangeIconAlert() {
    this.queueAlert(<div />, false); // false here prevents dialog from closing when server confirms selection
    this.updateChangeIconAlert();
  }

  /**
   * Determines whether the 'Start Game' button in the lobby should be enabled.
   */
  shouldStartGameBeEnabled() {
    if (!this.isLobbyManager(this.state.name)) {
      return false;
    }
    // Verify that all players have icons
    for (let i = 0; i < this.state.usernames.length; i++) {
      if (this.state.icons[this.state.usernames[i]] === defaultPortrait) {
        return false;
      }
    }
    return true;
  }

  /**
   * Contacts the server and requests to start the game.
   */
  onClickStartGame() {
    const offlinePlayers = this.getOfflineLobbyPlayers();
    if (offlinePlayers.length > 0) {
      this.showConfirmStartOfflinePrompt(offlinePlayers);
      return;
    }
    this.startGame();
  }

  startGame() {
    this.sendWSCommand({ command: WSCommandType.START_GAME });
  }

  sendLobbySetupConfig(
    config: GameSetupConfig,
    setupAutomation: SetupAutomationConfig = this.state.lobbySetupAutomation
  ) {
    const normalizedConfig = normalizeSetupConfig(config);
    const normalizedAutomation = normalizeSetupAutomation(setupAutomation);
    const validation = validateSetupConfig(normalizedConfig);
    if (!validation.valid) {
      this.setState({ lobbySetupError: validation.error });
      return;
    }
    this.setState({
      lobbySetupConfig: normalizedConfig,
      lobbySetupAutomation: normalizedAutomation,
      lobbySetupImportText: JSON.stringify(normalizedConfig, null, 2),
      lobbySetupError: "",
    });
    this.sendWSCommand({
      command: WSCommandType.SET_GAME_SETUP,
      setupConfig: normalizedConfig,
      setupAutomation: normalizedAutomation,
    });
  }

  sendLobbyHistoryConfig(historyConfig: HistoryConfig) {
    const normalizedHistoryConfig = {
      ...DEFAULT_HISTORY_CONFIG,
      ...historyConfig,
    };
    this.setState({ lobbyHistoryConfig: normalizedHistoryConfig });
    this.sendWSCommand({
      command: WSCommandType.SET_HISTORY_CONFIG,
      historyConfig: normalizedHistoryConfig,
    });
  }

  getSetupFieldAutomationGroup(
    keyName: keyof GameSetupConfig
  ): "autoRoles" | "autoPolicies" | "autoPowers" | null {
    if (
      keyName === "liberalRoles" ||
      keyName === "fascistRoles" ||
      keyName === "hitlerRoles" ||
      keyName === "anarchistRoles"
    ) {
      return "autoRoles";
    }
    if (
      keyName === "liberalPolicies" ||
      keyName === "fascistPolicies" ||
      keyName === "anarchistPolicies" ||
      keyName === "liberalPoliciesToWin" ||
      keyName === "fascistPoliciesToWin"
    ) {
      return "autoPolicies";
    }
    if (
      keyName === "hitlerElectionFascistThreshold" ||
      keyName === "requiredExecutedHitlersForLiberalVictory"
    ) {
      return "autoPowers";
    }
    return null;
  }

  renderSetupNumberField(
    label: string,
    keyName: keyof GameSetupConfig,
    disabled: boolean
  ) {
    const value = this.state.lobbySetupConfig[keyName];
    if (typeof value !== "number") {
      return null;
    }
    return (
      <label className="setup-field" key={String(keyName)}>
        <span>{label}</span>
        <input
          type="number"
          min={0}
          disabled={disabled}
          value={value}
          onChange={(event) => {
            const automationGroup = this.getSetupFieldAutomationGroup(keyName);
            const nextAutomation = automationGroup
              ? {
                  ...this.state.lobbySetupAutomation,
                  [automationGroup]: false,
                }
              : this.state.lobbySetupAutomation;
            this.sendLobbySetupConfig({
              ...this.state.lobbySetupConfig,
              preset: "MANUAL",
              [keyName]: Number(event.target.value),
            } as GameSetupConfig, nextAutomation);
          }}
        />
      </label>
    );
  }

  renderSetupAutomationToggle(
    label: string,
    keyName: keyof Pick<SetupAutomationConfig, "autoRoles" | "autoPolicies" | "autoPowers">,
    disabled: boolean
  ) {
    const automation = this.state.lobbySetupAutomation;
    return (
      <label className="setup-automation-option">
        <input
          type="checkbox"
          aria-label={label}
          disabled={disabled}
          checked={Boolean(automation[keyName])}
          onChange={(event) => {
            const nextAutomation = {
              ...automation,
              [keyName]: event.target.checked,
            };
            const nextConfig = event.target.checked
              ? applySetupPresetAutomation(this.state.lobbySetupConfig, nextAutomation)
              : {
                  ...this.state.lobbySetupConfig,
                  preset: "MANUAL" as const,
                };
            this.sendLobbySetupConfig(nextConfig, nextAutomation);
          }}
        />
        {label}
      </label>
    );
  }

  renderHistorySetupControls(canEdit: boolean) {
    const historyConfig = this.state.lobbyHistoryConfig;
    const updateHistory = (patch: Partial<HistoryConfig>) => {
      this.sendLobbyHistoryConfig({
        ...historyConfig,
        ...patch,
      });
    };
    return (
      <section className="setup-history-section" aria-label="History settings">
        <h3>HISTORY</h3>
        <div className="setup-history-toggle-row">
          <label>
            <input
              type="checkbox"
              aria-label="Show history panel"
              disabled={!canEdit}
              checked={historyConfig.showHistory}
              onChange={(event) => updateHistory({ showHistory: event.target.checked })}
            />
            Show history panel
          </label>
          <label>
            <input
              type="checkbox"
              disabled={!canEdit || !historyConfig.showHistory}
              checked={historyConfig.showPublicActions}
              onChange={(event) => updateHistory({ showPublicActions: event.target.checked })}
            />
            Show presidential actions
          </label>
          <label>
            <input
              type="checkbox"
              disabled={!canEdit || !historyConfig.showHistory}
              checked={historyConfig.showVoteBreakdown}
              onChange={(event) => updateHistory({ showVoteBreakdown: event.target.checked })}
            />
            Show vote breakdown
          </label>
          <label>
            <input
              type="checkbox"
              disabled={!canEdit || !historyConfig.showHistory}
              checked={historyConfig.showPolicyClaims}
              onChange={(event) => updateHistory({ showPolicyClaims: event.target.checked })}
            />
            Show policy claims
          </label>
        </div>
        <label className="setup-history-rounds">
          <span>Rounds to show:</span>
          <select
            aria-label="Rounds to show"
            value={historyConfig.roundsToShow}
            disabled={!canEdit || !historyConfig.showHistory}
            onChange={(event) =>
              updateHistory({
                roundsToShow: event.target.value as HistoryRoundsToShow,
              })
            }
          >
            <option value={HistoryRoundsToShow.ALL}>All rounds</option>
            <option value={HistoryRoundsToShow.LAST_1}>Last round</option>
            <option value={HistoryRoundsToShow.LAST_3}>Last 3 rounds</option>
          </select>
        </label>
      </section>
    );
  }

  renderModeratorGameSetup() {
    const isManager = this.isLobbyManager(this.state.name);
    const config = this.state.lobbySetupConfig;
    const canEdit = isManager;
    return (
      <section className="moderator-setup-panel">
        <button
          className="setup-collapse-button"
          onClick={() =>
            this.setState({ lobbySetupExpanded: !this.state.lobbySetupExpanded })
          }
        >
          {this.state.lobbySetupExpanded ? "▼" : "▶"} MODERATOR GAME SETUP
        </button>
        {this.state.lobbySetupExpanded && (
          <div className="setup-panel-body">
            <p className="setup-help-text">
              Visible to everyone. Editable by the creator and moderators. Standard games remain the default.
            </p>
            <div className="setup-preset-row">
              <label className="setup-preset-select-label">
                <span>Preset</span>
                <select
                  aria-label="Setup preset"
                  disabled={!canEdit}
                  value={this.state.lobbySetupAutomation.preset}
                  onChange={(event) => {
                    const nextAutomation = normalizeSetupAutomation({
                      ...this.state.lobbySetupAutomation,
                      preset: event.target.value === "ANARCHIST" ? "ANARCHIST" : "STANDARD",
                    });
                    this.sendLobbySetupConfig(
                      applySetupPresetAutomation(config, nextAutomation),
                      nextAutomation
                    );
                  }}
                >
                  <option value="STANDARD">Standard</option>
                  <option value="ANARCHIST">Anarchist</option>
                </select>
              </label>
              <div className="setup-automation-row">
                {this.renderSetupAutomationToggle("Auto roles", "autoRoles", !canEdit)}
                {this.renderSetupAutomationToggle("Auto policies", "autoPolicies", !canEdit)}
                {this.renderSetupAutomationToggle("Auto powers", "autoPowers", !canEdit)}
              </div>
            </div>
            <div className="setup-grid">
              {this.renderSetupNumberField("Liberal roles", "liberalRoles", !canEdit)}
              {this.renderSetupNumberField("Fascist roles", "fascistRoles", !canEdit)}
              {this.renderSetupNumberField("Hitler roles", "hitlerRoles", !canEdit)}
              {this.renderSetupNumberField("Anarchist roles", "anarchistRoles", !canEdit)}
              {this.renderSetupNumberField("Liberal policies", "liberalPolicies", !canEdit)}
              {this.renderSetupNumberField("Fascist policies", "fascistPolicies", !canEdit)}
              {this.renderSetupNumberField("Anarchist policies", "anarchistPolicies", !canEdit)}
              {this.renderSetupNumberField("Liberal win threshold", "liberalPoliciesToWin", !canEdit)}
              {this.renderSetupNumberField("Fascist win threshold", "fascistPoliciesToWin", !canEdit)}
              {this.renderSetupNumberField("Hitler election slot", "hitlerElectionFascistThreshold", !canEdit)}
              {this.renderSetupNumberField("Hitlers to execute", "requiredExecutedHitlersForLiberalVictory", !canEdit)}
            </div>
            <div className="setup-toggle-row">
              {[
                ["Anarchists know each other", "anarchistsKnowEachOther"],
                ["Investigations reveal Anarchist", "anarchistInvestigationsRevealAnarchist"],
                ["Anarchist cascades activate powers", "anarchistPowersEnabled"],
                ["Anarchist tracker resets", "anarchistTrackerResets"],
              ].map(([label, keyName]) => (
                <label key={keyName}>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={Boolean((config as any)[keyName])}
                    onChange={(event) => {
                      const nextAutomation = {
                        ...this.state.lobbySetupAutomation,
                        autoPowers: false,
                      };
                      this.sendLobbySetupConfig({
                        ...config,
                        preset: "MANUAL",
                        [keyName]: event.target.checked,
                      } as GameSetupConfig, nextAutomation);
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
            {this.renderHistorySetupControls(canEdit)}
            <div className="setup-json-row">
              <textarea
                aria-label="Setup JSON5 import export"
                readOnly={!canEdit}
                value={this.state.lobbySetupImportText || JSON.stringify(config, null, 2)}
                onChange={(event) => this.setState({ lobbySetupImportText: event.target.value })}
              />
              <div>
                <button
                  disabled={!canEdit}
                  onClick={() => {
                    const result = parseSetupConfigJson5(
                      this.state.lobbySetupImportText,
                      this.state.lobbySetupConfig
                    );
                    if (result.error) {
                      this.setState({ lobbySetupError: result.error });
                    } else {
                      this.sendLobbySetupConfig(result.config, {
                        ...this.state.lobbySetupAutomation,
                        autoRoles: false,
                        autoPolicies: false,
                        autoPowers: false,
                      });
                    }
                  }}
                >
                  IMPORT JSON5
                </button>
                <button
                  onClick={() =>
                    this.setState({
                      lobbySetupImportText: JSON.stringify(this.state.lobbySetupConfig, null, 2),
                      lobbySetupError: "",
                    })
                  }
                >
                  EXPORT
                </button>
              </div>
            </div>
            <div className="setup-power-summary">
              Fascist powers: {(config.fascistPowerSchedule || []).join(", ")}
            </div>
            {this.state.lobbySetupError && (
              <p className="setup-error">{this.state.lobbySetupError}</p>
            )}
          </div>
        )}
      </section>
    );
  }

  onClickLeaveLobby() {
    this.reconnectOnConnectionClosed = false;
    if (this.websocket) {
      this.sendWSCommand({ command: WSCommandType.LEAVE_LOBBY });
    } else {
      this.setState({
        page: PAGE.LOGIN,
        joinName: this.state.name,
        joinLobby: this.state.lobby,
      });
    }
  }

  onClickSetModeratorStatus(target: string, enabled: boolean) {
    this.sendWSCommand({
      command: WSCommandType.SET_MODERATOR_STATUS,
      target,
      enabled,
    });
  }

  onClickKickUser(target: string) {
    this.sendWSCommand({ command: WSCommandType.KICK_USER, target });
  }

  onClickBanUser(target: string) {
    this.sendWSCommand({ command: WSCommandType.BAN_USER, target });
  }

  onClickResetBans() {
    this.sendWSCommand({ command: WSCommandType.RESET_BANS });
  }

  onClickSetDiscussionReaction(reaction: DiscussionReactionType) {
    this.sendWSCommand({
      command: WSCommandType.SET_DISCUSSION_REACTION,
      reaction,
    });
  }

  onClickUpdateDiscussionReactionConfig(
    durationSeconds: number,
    allowDeadPlayers: boolean
  ) {
    this.sendWSCommand({
      command: WSCommandType.SET_DISCUSSION_REACTION_CONFIG,
      durationSeconds,
      allowDeadPlayers,
    });
  }

  onClickSetReactionSoundsMuted(muted: boolean) {
    setReactionSoundMuted(this.state.name, muted);
    this.setState({ reactionSoundsMuted: muted });
  }

  handleDiscussionReactionUpdates(nextGameState: GameState) {
    const previousReactions = this.state.gameState.discussionReactions || {};
    const nextReactions = nextGameState.discussionReactions || {};
    const now = Date.now();

    if (!this.hasHydratedDiscussionReactions) {
      this.hasHydratedDiscussionReactions = true;
      return;
    }

    Object.entries(nextReactions).forEach(([playerName, reaction]) => {
      if (!reaction || reaction.expiresAt <= now) {
        return;
      }
      const previousReaction = previousReactions[playerName];
      const isNewReaction =
        !previousReaction ||
        previousReaction.type !== reaction.type ||
        previousReaction.expiresAt !== reaction.expiresAt;
      if (!isNewReaction) {
        return;
      }

      const message =
        reaction.type === DiscussionReactionType.LIKE
          ? `${playerName} liked the discussion cue.`
          : `${playerName} disliked the discussion cue.`;
      this.setState({ statusBarText: message });
      playDiscussionReactionSound(reaction.type, this.state.reactionSoundsMuted);
    });
  }

  showLobbyManageUserPrompt(target: string) {
    const isCreator = target === this.state.lobbyCreator;
    const isModerator = this.isLobbyModerator(target);
    const viewerIsCreator = this.state.name === this.state.lobbyCreator;
    const canDemote = isModerator && viewerIsCreator && !isCreator;
    const canPromote = !isModerator && !isCreator && this.isLobbyManager(this.state.name);
    const canKickOrBan = !isCreator;

    this.queueAlert(
      <ButtonPrompt
        label={`MANAGE ${target.toUpperCase()}`}
        footerText={"Changes apply immediately to this lobby."}
        renderButton={() => (
          <div className="prompt-button-grid">
            {canPromote && (
              <button
                id={"prompt-button"}
                onClick={() => {
                  this.hideAlertAndFinish();
                  this.onClickSetModeratorStatus(target, true);
                }}
              >
                PROMOTE TO MOD
              </button>
            )}
            {canDemote && (
              <button
                id={"prompt-button"}
                onClick={() => {
                  this.hideAlertAndFinish();
                  this.onClickSetModeratorStatus(target, false);
                }}
              >
                DEMOTE MOD
              </button>
            )}
            {canKickOrBan && (
              <button
                id={"prompt-button"}
                onClick={() => {
                  this.hideAlertAndFinish();
                  this.onClickKickUser(target);
                }}
              >
                KICK
              </button>
            )}
            {canKickOrBan && (
              <button
                id={"prompt-button"}
                onClick={() => {
                  this.hideAlertAndFinish();
                  this.onClickBanUser(target);
                }}
              >
                BAN
              </button>
            )}
            <button
              id={"prompt-button"}
              onClick={() => {
                this.hideAlertAndFinish();
              }}
            >
              CLOSE
            </button>
          </div>
        )}
      >
        <Player
          name={target}
          showRole={false}
          icon={this.state.icons[target]}
          highlight={target === this.state.name}
          statusBadges={[
            isCreator ? { label: "CREATOR", variant: "creator" } : null,
            !isCreator && isModerator
              ? { label: "MOD", variant: "moderator" }
              : null,
            this.state.lobbyConnected[target] === false
              ? { label: "OFFLINE", variant: "offline" }
              : null,
          ].filter(Boolean) as { label: string; variant?: string }[]}
        />
      </ButtonPrompt>,
      false
    );
  }

  showGameModeratorPrompt(target: string) {
    const isCreator = target === this.state.gameState.creator;
    const moderators = this.state.gameState.moderators || [];
    const isModerator = moderators.includes(target);
    const viewerIsCreator = this.state.name === this.state.gameState.creator;
    const canPromote =
      !isCreator &&
      !isModerator &&
      (viewerIsCreator || moderators.includes(this.state.name));
    const canDemote = !isCreator && isModerator && viewerIsCreator;

    if (!canPromote && !canDemote) {
      return;
    }

    this.queueAlert(
      <ButtonPrompt
        label={`MODERATION: ${target.toUpperCase()}`}
        footerText={"Moderator changes apply immediately."}
        renderButton={() => (
          <div className="prompt-button-grid">
            {canPromote && (
              <button
                id={"prompt-button"}
                onClick={() => {
                  this.hideAlertAndFinish();
                  this.onClickSetModeratorStatus(target, true);
                }}
              >
                PROMOTE TO MOD
              </button>
            )}
            {canDemote && (
              <button
                id={"prompt-button"}
                onClick={() => {
                  this.hideAlertAndFinish();
                  this.onClickSetModeratorStatus(target, false);
                }}
              >
                DEMOTE MOD
              </button>
            )}
            <button
              id={"prompt-button"}
              onClick={() => {
                this.hideAlertAndFinish();
              }}
            >
              CLOSE
            </button>
          </div>
        )}
      >
        <PlayerDisplay
          user={this.state.name}
          gameState={this.state.gameState}
          players={[target]}
          showLabels={false}
        />
      </ButtonPrompt>,
      false
    );
  }

  showObserverAssignmentPrompt(target: string) {
    const assignmentByPlayer = this.getSeatObserverAssignmentsByPlayer();
    const assignedObserver = assignmentByPlayer[target];
    const targetType = this.state.gameState.observerAssignableTargets?.[target];
    if (!targetType) {
      return;
    }

    const availableObservers = (this.state.gameState.observers || []).filter(
      (observer) =>
        this.state.gameState.observerConnected?.[observer] !== false &&
        (assignedObserver === observer ||
          !this.state.gameState.observerAssignments?.[observer])
    );

    const clearLabel =
      targetType === ObserverAssignableTargetType.GENERATED_BOT
        ? "RETURN TO AI"
        : "RETURN TO PLAYER";

    this.queueAlert(
      <ButtonPrompt
        label={`ASSIGN OBSERVER: ${target.toUpperCase()}`}
        headerText={
          assignedObserver
            ? `${assignedObserver} is currently controlling this seat.`
            : "Choose a connected observer to control this seat."
        }
        footerText={
          availableObservers.length === 0
            ? "No connected unassigned observers are available right now."
            : "Assignments apply immediately."
        }
        renderButton={() => (
          <div className="prompt-button-grid">
            {availableObservers.map((observer) => (
              <button
                id={"prompt-button"}
                key={observer}
                onClick={() => {
                  this.hideAlertAndFinish();
                  this.onClickSetObserverAssignment(target, observer);
                }}
              >
                {assignedObserver === observer
                  ? `KEEP ${observer.toUpperCase()}`
                  : observer.toUpperCase()}
              </button>
            ))}
            <button
              id={"prompt-button"}
              onClick={() => {
                this.hideAlertAndFinish();
                this.onClickSetObserverAssignment(target);
              }}
            >
              {clearLabel}
            </button>
            <button
              id={"prompt-button"}
              onClick={() => {
                this.hideAlertAndFinish();
              }}
            >
              CLOSE
            </button>
          </div>
        )}
      >
        <PlayerDisplay
          user={this.state.name}
          gameState={this.state.gameState}
          players={[target]}
          showLabels={false}
        />
      </ButtonPrompt>,
      false
    );
  }

  renderObserversPanel() {
    const observers = this.state.gameState.observers || [];
    if (observers.length === 0) {
      return null;
    }

    return (
      <div
        style={{
          margin: "12px auto 0",
          padding: "12px",
          width: "min(90vw, 720px)",
          backgroundColor: "var(--backgroundDark)",
          textAlign: "left",
        }}
      >
        <h3 style={{ margin: "0 0 8px 0" }}>Observers</h3>
        {observers.map((observer) => {
          const seat = this.state.gameState.observerAssignments?.[observer];
          const isOffline =
            this.state.gameState.observerConnected?.[observer] === false;
          return (
            <div
              key={observer}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                padding: "4px 0",
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span>
                {observer}
                {seat ? ` → ${seat}` : ""}
              </span>
              <span style={{ opacity: 0.8 }}>
                {isOffline ? "OFFLINE" : "ONLINE"}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  showResetBansPrompt() {
    this.queueAlert(
      <ButtonPrompt
        label={"RESET BAN LIST?"}
        headerText={"This will clear all lobby bans for the current lobby."}
        renderButton={() => (
          <div className="prompt-button-row">
            <button
              id={"prompt-button"}
              onClick={() => {
                this.hideAlertAndFinish();
              }}
            >
              CANCEL
            </button>
            <button
              id={"prompt-button"}
              onClick={() => {
                this.hideAlertAndFinish();
                this.onClickResetBans();
              }}
            >
              RESET BANS
            </button>
          </div>
        )}
      />,
      false
    );
  }

  onClickCopy() {
    const text = document.getElementById("linkText");
    if (text === null) {
      return;
    }
    (text as HTMLTextAreaElement).select();
    (text as HTMLTextAreaElement).setSelectionRange(0, 999999);
    document.execCommand("copy");
    this.showSnackBar("Copied!");
  }

  showSnackBar(message: string) {
    this.setState({ snackbarMessage: message });
    let snackbar = document.getElementById("snackbar");
    if (snackbar === null) {
      return;
    }
    snackbar.className = "show";
    this.snackbarMessages++;
    setTimeout(() => {
      this.snackbarMessages--;
      if (this.snackbarMessages === 0) {
        snackbar!.className = snackbar!.className.replace("show", "");
      }
    }, 3000);
  }

  renderLobbyPage() {
    const isManager = this.isLobbyManager(this.state.name);
    return (
      <div className="App">
        <header className="App-header">{APP_HEADER_TEXT}</header>

        <CustomAlert show={this.state.showAlert}>
          {this.state.alertContent}
        </CustomAlert>

        <div
          style={{ textAlign: "left", marginLeft: "20px", marginRight: "20px" }}
        >
          <div style={{ display: "flex", flexDirection: "row" }}>
            <h2>LOBBY CODE: </h2>
            <h2
              style={{ marginLeft: "5px", color: "var(--textColorHighlight)" }}
            >
              {this.state.lobby}
            </h2>
          </div>

          <p style={{ marginBottom: "2px" }}>
            Copy and share this link to invite other players.
          </p>
          <div
            style={{
              textAlign: "left",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <textarea
              id="linkText"
              readOnly={true}
              value={(CURRENT_ORIGIN || SERVER_ADDRESS_HTTP) + "/?lobby=" + this.state.lobby}
            />
            <button onClick={this.onClickCopy}>COPY</button>
          </div>

          <div id={"lobby-lower-container"}>
            <div id={"lobby-player-area-container"}>
              <div id={"lobby-player-text-choose-container"}>
                <p id={"lobby-player-count-text"}>
                  Players ({this.state.usernames.length}/{MAX_PLAYERS})
                </p>
                <button
                  id={"lobby-change-icon-button"}
                  onClick={this.onClickChangeIcon}
                >
                  CHANGE ICON
                </button>
              </div>
              <div id={"lobby-player-container"}>
                {this.renderLobbyPlayerList()}
              </div>
              {this.renderModeratorGameSetup()}
            </div>

            <div id={"lobby-button-container"}>
              {!isManager && (
                <p id={"lobby-vip-text"}>
                  Only the creator or a moderator can start the game.
                </p>
              )}
              <button
                onClick={this.onClickStartGame}
                disabled={!this.shouldStartGameBeEnabled()}
              >
                START GAME
              </button>
              {isManager && (
                <button onClick={() => this.showResetBansPrompt()}>
                  RESET BAN LIST
                </button>
              )}
              <button onClick={this.onClickLeaveLobby}>LEAVE LOBBY</button>
            </div>
            <div id={"lobby-text-container"}>
              <p id={"lobby-about-text"}>
                <a
                  href={REPO_README_URL}
                  target={"_blank"}
                  rel="noopener noreferrer"
                >
                  About this project
                </a>
              </p>
              <br />
              <p id={"lobby-warning-text"}>
                You can report bugs on the{" "}
                <a
                  href={REPO_ISSUES_URL}
                  rel="noopener noreferrer"
                  target={"_blank"}
                >
                  Issues page.
                </a>
              </p>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div id="snackbar">{this.state.snackbarMessage}</div>
        </div>
      </div>
    );
  }

  //</editor-fold>

  /////////////////// Game Page
  //<editor-fold desc="Game Page">

  showExecutionResults(name: string, newState: GameState): void {
    if (name === newState.targetUser) {
      this.queueAlert(
        <ButtonPrompt
          label={"YOU HAVE BEEN EXECUTED"}
          headerText={
            "Executed players may not speak, vote, or run for office. You should not reveal your identity to the group."
          }
          buttonOnClick={this.hideAlertAndFinish}
        />,
        false
      );
    } else {
      this.queueAlert(
        <ButtonPrompt
          label={"EXECUTION RESULTS"}
          footerText={
            newState.targetUser +
            " has been executed. They may no longer speak, vote, or run for office."
          }
          buttonOnClick={this.hideAlertAndFinish}
          buttonText={"OKAY"}
        >
          <PlayerDisplay
            user={name}
            gameState={newState}
            showRoles={false}
            playerDisabledFilter={DISABLE_EXECUTED_PLAYERS}
            players={[newState.targetUser!]}
          />
        </ButtonPrompt>,
        false
      );
    }
  }

  /**
   * Queues animations for when the game state has changed.
   * @param newState {Object} the new game state sent from the server.
   */
  onGameStateChanged(newState: GameState) {
    let oldState = this.state.gameState;
    let name = this.state.name;
    const viewerSeat = this.getViewerSeat(newState);
    const isObserver = newState.selfType === UserType.OBSERVER;
    const myPlayer = viewerSeat ? newState.players[viewerSeat] : undefined;
    let isPresident = viewerSeat === newState.president;
    let isChancellor = viewerSeat === newState.chancellor;
    const canAct = this.canViewerAct(newState);
    const wasSelfBotControlled = Boolean(oldState.botControlled?.[name]);
    const isSelfBotControlled = Boolean(newState.botControlled?.[name]);
    let state = newState.state;

    this.handleBotControlTransition(
      wasSelfBotControlled,
      isSelfBotControlled
    );

    // If last state was setup, which indicates that the client is re-entering the game or starting the game, then
    // we set the card count, liberal/fascist policy count, and the tracker.
    if (
      oldState.hasOwnProperty(PARAM_STATE) &&
      oldState[PARAM_STATE] === STATE_SETUP
    ) {
      this.setState({
        liberalPolicies: newState.liberalPolicies,
        fascistPolicies: newState.fascistPolicies,
        electionTracker: newState.electionTracker,
        drawDeckSize: newState.drawSize,
        discardDeckSize: newState.discardSize,
      });
    }

    // Check for changes in enacted policies and election tracker.
    const statesToShowPolicyFor = [
      LobbyState.POST_LEGISLATIVE,
      LobbyState.POLICY_CLAIMS,
      LobbyState.PP_INVESTIGATE,
      LobbyState.PP_EXECUTION,
      LobbyState.PP_ELECTION,
      LobbyState.PP_PEEK,
      LobbyState.FASCIST_VICTORY_POLICY,
      LobbyState.ANARCHIST_VICTORY_POLICY,
      LobbyState.LIBERAL_VICTORY_POLICY,
    ];
    if (statesToShowPolicyFor.includes(state)) {
      // Check if the election tracker changed positions.
      if (newState.electionTracker !== this.state.gameState.electionTracker) {
        let newPos = newState.electionTracker;
        let advancedToThree = newPos === 0 && newState.electionTrackerAdvanced;
        // We ignore all resets to 0, unless that reset was caused by the election tracker reaching 3.
        if (newPos !== 0 || advancedToThree) {
          // If the last phase was voting, we failed due to voting. Therefore, show votes.
          if (oldState[PARAM_STATE] === STATE_CHANCELLOR_VOTING) {
            //this.queueAlert(<RoleAlert onClick={this.hideAlertAndFinish} />);
            this.addAnimationToQueue(() => this.showVotes(newState));
          }

          let trackerPosition = newPos;
          if (advancedToThree) {
            // If the tracker was reset because it advanced to 3, show it moving to 3 in the dialog box.
            trackerPosition = 3;
          }
          this.queueAlert(
            <ElectionTrackerAlert
              trackerPosition={trackerPosition}
              closeAlert={this.hideAlertAndFinish}
            />
          );
        }
      }

      let liberalChanged =
        newState.liberalPolicies !== oldState.liberalPolicies;
      let fascistChanged =
        newState.fascistPolicies !== oldState.fascistPolicies;

      if (liberalChanged || fascistChanged) {
        // Show an alert with the new policy
        this.queueAlert(
          <PolicyEnactedAlert
            hideAlert={this.hideAlertAndFinish}
            policyType={newState.lastPolicy}
          />
        );
      }

      // Update the decks, board with the new policies / election tracker.
      this.addAnimationToQueue(() => {
        this.setState({
          liberalPolicies: newState.liberalPolicies,
          fascistPolicies: newState.fascistPolicies,
          electionTracker: newState.electionTracker,
        });
        setTimeout(() => this.onAnimationFinish(), 500);
      });
    }

    // Check for state change
    if (newState[PARAM_STATE] !== this.state.gameState[PARAM_STATE]) {
      // state has changed
      switch (newState[PARAM_STATE]) {
        case STATE_CHANCELLOR_NOMINATION:
          if (
            newState.electionTracker === 0 &&
            newState.liberalPolicies === 0 &&
            newState.fascistPolicies === 0 &&
            !isObserver &&
            myPlayer !== undefined
          ) {
            // If the game has just started (everything in default state), show the player's role.
            this.queueAlert(
              <RoleAlert
                role={myPlayer!.id}
                gameState={newState}
                name={viewerSeat}
                onClick={() => {
                  this.hideAlertAndFinish();
                }}
              />,
              false
            );
          }

          this.queueEventUpdate("CHANCELLOR NOMINATION");
          this.queueStatusMessage(
            "Waiting for president to nominate a chancellor."
          );

          if (isPresident && canAct) {
            //Show the chancellor nomination window.
            this.queueAlert(
              SelectNominationPrompt(name, newState, this.sendWSCommand)
            );
          }

          break;

        case STATE_CHANCELLOR_VOTING:
          this.queueEventUpdate("VOTING");
          this.queueStatusMessage("Waiting for all players to vote.");
          // Check if the player is dead or has already voted-- if so, do not show the voting prompt.
          if (
            !isObserver &&
            canAct &&
            myPlayer![PLAYER_IS_ALIVE] &&
            !Object.keys(newState.userVotes).includes(viewerSeat)
          ) {
            this.queueAlert(
              <VotingPrompt
                gameState={newState}
                sendWSCommand={this.sendWSCommand}
                user={this.state.name}
              />,
              true
            );
          }

          break;

        case STATE_LEGISLATIVE_PRESIDENT:
          // The vote completed, so show the votes.
          this.addAnimationToQueue(() => this.showVotes(newState));
          this.queueEventUpdate("LEGISLATIVE SESSION");

          // TODO: Animate cards being pulled from the draw deck for all users.

          this.queueStatusMessage(
            "Waiting for the president to choose a policy to discard."
          );

          if (isPresident && canAct) {
            if (!newState.presidentChoices) {
              throw new Error("President choices not found.");
            }
            this.queueAlert(
              <PresidentLegislativePrompt
                policyOptions={newState.presidentChoices}
                sendWSCommand={this.sendWSCommand}
              />
            );
          }

          break;

        case STATE_LEGISLATIVE_CHANCELLOR:
          this.queueStatusMessage(
            "Waiting for the chancellor to choose a policy to enact."
          );
          if (isChancellor && canAct) {
            if (!newState.chancellorChoices) {
              throw new Error("Chancellor choices not found.");
            }
            const fascistPoliciesToWin = newState.setupConfig?.fascistPoliciesToWin || 6;
            this.queueAlert(
              <ChancellorLegislativePrompt
                fascistPolicies={newState.fascistPolicies}
                fascistPoliciesToWin={fascistPoliciesToWin}
                showError={(message: string) =>
                  this.setState({ snackbarMessage: message })
                }
                policyOptions={newState.chancellorChoices}
                sendWSCommand={this.sendWSCommand}
                // Disable if veto has already happened
                enableVeto={
                  newState.fascistPolicies >= fascistPoliciesToWin - 1 && !newState.vetoOccurred
                }
              />
            );
          }
          break;

        case STATE_LEGISLATIVE_PRESIDENT_VETO:
          this.queueStatusMessage(
            "Chancellor has motioned to veto the agenda. Waiting for the president to decide."
          );
          if (isPresident && canAct) {
            this.queueAlert(
              <VetoPrompt
                sendWSCommand={this.sendWSCommand}
                electionTracker={newState.electionTracker}
              />,
              true
            );
          }
          break;

        case STATE_POLICY_CLAIMS:
          this.queueEventUpdate("POLICY CLAIMS");
          this.queueStatusMessage(
            "Waiting for the president and chancellor to report or refuse policy cards."
          );
          if (isPresident && canAct && !newState.presidentPolicyClaimSubmitted) {
            this.queueAlert(
              <PolicyClaimPrompt
                roleLabel={"President"}
                cardCount={3}
                allowedPolicyTypes={this.getAllowedPolicyClaimTypes(newState)}
                sendWSCommand={this.sendWSCommand}
              />
            );
          } else if (
            isChancellor &&
            canAct &&
            !newState.chancellorPolicyClaimSubmitted
          ) {
            this.queueAlert(
              <PolicyClaimPrompt
                roleLabel={"Chancellor"}
                cardCount={2}
                allowedPolicyTypes={this.getAllowedPolicyClaimTypes(newState)}
                sendWSCommand={this.sendWSCommand}
              />
            );
          }
          break;

        case STATE_PP_PEEK:
          this.queueEventUpdate("PRESIDENTIAL POWER");
          if (isPresident && canAct) {
            if (!newState.peek) {
              throw new Error("Peek policies not found.");
            }
            this.queueAlert(
              <PeekPrompt
                policies={newState.peek}
                sendWSCommand={this.sendWSCommand}
              />,
              true
            );
          } else {
            this.queueStatusMessage(
              "Peek: President is previewing the next 3 policies."
            );
          }
          break;

        case STATE_PP_ELECTION:
          this.queueEventUpdate("PRESIDENTIAL POWER");
          if (isPresident && canAct) {
            this.queueAlert(
              SelectSpecialElectionPrompt(name, newState, this.sendWSCommand)
            );
          } else {
            this.queueStatusMessage(
              "Special Election: President is choosing the next president."
            );
          }
          break;

        case STATE_PP_EXECUTION:
          this.queueEventUpdate("PRESIDENTIAL POWER");
          if (isPresident && canAct) {
            this.queueAlert(
              SelectExecutionPrompt(name, newState, this.sendWSCommand),
              true
            );
          } else {
            this.queueStatusMessage(
              "Execution: President is choosing a player to execute."
            );
          }
          break;

        case STATE_PP_INVESTIGATE:
          this.queueEventUpdate("PRESIDENTIAL POWER");
          if (isPresident && canAct) {
            this.queueAlert(
              SelectInvestigationPrompt(name, newState, this.sendWSCommand)
            );
          } else {
            this.queueStatusMessage(
              "Investigation: President is choosing a player to investigate."
            );
          }
          break;

        case STATE_POST_LEGISLATIVE:
          // Show results of any special elections, executions, or investigations.
          switch (newState.lastState) {
            case STATE_PP_ELECTION:
              if (!isPresident) {
                console.log("Special Election Alert: " + newState.targetUser);
                this.queueAlert(
                  <ButtonPrompt
                    label={"SPECIAL ELECTION"}
                    footerText={
                      newState[PARAM_PRESIDENT] +
                      " has chosen " +
                      newState.targetUser +
                      " to be the next president." +
                      "\nThe normal presidential order will resume after the next round."
                    }
                    buttonText={"OKAY"}
                    buttonOnClick={this.hideAlertAndFinish}
                  >
                    <PlayerDisplay
                      user={name}
                      gameState={newState}
                      showLabels={false}
                      players={[newState.targetUser!]}
                    />
                  </ButtonPrompt>,
                  false
                );
              }
              break;
            case STATE_PP_EXECUTION:
              // If player was executed
              this.showExecutionResults(name, newState);
              break;
            case STATE_PP_INVESTIGATE:
              if (!isPresident) {
                let isTarget = newState.targetUser === name;
                let footerText = isTarget
                  ? `You have been investigated by ${newState[PARAM_PRESIDENT]}. The president now knows your party affiliation.`
                  : `${newState.targetUser} has been investigated by ${newState[PARAM_PRESIDENT]}. The president now knows their party affiliation.`;
                this.queueAlert(
                  <ButtonPrompt
                    label={"INVESTIGATION RESULTS"}
                    // If target: You have been investigated by [President Name].
                    //            The president now knows your party affiliation.
                    // If not target: [Target Name] has been investigated by [President Name].
                    //                The president now knows their party affiliation.
                    footerText={footerText}
                    buttonOnClick={this.hideAlertAndFinish}
                    buttonText={"OKAY"}
                  >
                    <PlayerDisplay
                      user={name}
                      gameState={newState}
                      showLabels={false}
                      players={[newState.targetUser!]}
                    />
                  </ButtonPrompt>,
                  true
                );
              } else {
                // Is President; do nothing because we handle the
                // response directly from the server.
              }
              break;
            case STATE_PP_PEEK: // No additional case is necessary for peeking.
            default:
          }

          this.queueStatusMessage(
            "Waiting for the president to end their term."
          );
          break;

        case STATE_LIBERAL_VICTORY_EXECUTION:
        case STATE_FASCIST_VICTORY_ELECTION:
        case STATE_FASCIST_VICTORY_POLICY:
        case STATE_ANARCHIST_VICTORY_POLICY:
        case STATE_LIBERAL_VICTORY_POLICY:
          // Show normal enactments when victory events happen.
          if (newState.state === STATE_LIBERAL_VICTORY_EXECUTION) {
            this.showExecutionResults(name, newState);
          }
          if (newState.state === STATE_FASCIST_VICTORY_ELECTION) {
            this.addAnimationToQueue(() => this.showVotes(newState));
          }
          // Policies will already be shown for policy-based victories.
          // If the game was won via election, show the votes.

          this.addAnimationToQueue(() => {
            this.setState({
              alertContent: (
                <VictoryPrompt
                  gameState={newState}
                  user={this.state.name}
                  onReturnToLobby={() => {
                    this.gameOver = false;
                    this.reconnectOnConnectionClosed = true;
                    this.tryOpenWebSocket(this.state.name, this.state.lobby);
                    this.hideAlertAndFinish();
                    this.setState({
                      page: PAGE.LOBBY,
                      gameState: DEFAULT_GAME_STATE,
                      liberalPolicies: 0,
                      fascistPolicies: 0,
                      electionTracker: 0,
                      drawDeckSize: 17,
                      discardDeckSize: 0,
                    });
                  }}
                />
              ),
              showAlert: true,
              alertMinimized: false,
            });
          });
          this.gameOver = true;
          this.reconnectOnConnectionClosed = false;
          this.websocket?.close();
          break;

        default:
        // Do nothing
      }
    }

    // Update the draw decks
    this.addAnimationToQueue(() => {
      this.setState({
        drawDeckSize: newState.drawSize,
        discardDeckSize: newState.discardSize,
      });
      this.onAnimationFinish();
    });
  }

  isPlayerBotControlled(playerName: string): boolean {
    return Boolean(this.state.gameState.botControlled?.[playerName]);
  }

  getViewerSeat(gameState: GameState = this.state.gameState): string {
    return gameState.controlledPlayer || this.state.name;
  }

  canViewerAct(gameState: GameState = this.state.gameState): boolean {
    return Boolean(gameState.canAct);
  }

  isViewerGameModerator(gameState: GameState = this.state.gameState): boolean {
    return (
      gameState.creator === this.state.name ||
      Boolean(gameState.moderators?.includes(this.state.name))
    );
  }

  getAllowedPolicyClaimTypes(gameState: GameState): PolicyType[] {
    const setupConfig = gameState.setupConfig;
    const allowedPolicyTypes: PolicyType[] = [];

    if (!setupConfig || setupConfig.fascistPolicies > 0) {
      allowedPolicyTypes.push(PolicyType.FASCIST);
    }
    if (!setupConfig || setupConfig.liberalPolicies > 0) {
      allowedPolicyTypes.push(PolicyType.LIBERAL);
    }
    if (setupConfig && setupConfig.anarchistPolicies > 0) {
      allowedPolicyTypes.push(PolicyType.ANARCHIST);
    }

    return allowedPolicyTypes.length > 0
      ? allowedPolicyTypes
      : [PolicyType.FASCIST, PolicyType.LIBERAL];
  }

  getViewerDiscussionReaction(
    gameState: GameState = this.state.gameState
  ) {
    const viewerSeat = this.getViewerSeat(gameState);
    const reaction = gameState.discussionReactions?.[viewerSeat];
    if (!reaction || reaction.expiresAt <= Date.now()) {
      return undefined;
    }
    return reaction;
  }

  canViewerUseDiscussionReactions(
    gameState: GameState = this.state.gameState
  ): boolean {
    if (!this.canViewerAct(gameState)) {
      return false;
    }
    const viewerSeat = this.getViewerSeat(gameState);
    if (!viewerSeat || !gameState.players?.[viewerSeat]) {
      return false;
    }
    if (gameState.players[viewerSeat].alive) {
      return true;
    }
    return gameState.discussionReactionConfig.allowDeadPlayers;
  }

  shouldShowDiscussionReactionDock(
    gameState: GameState = this.state.gameState
  ): boolean {
    const viewerSeat = this.getViewerSeat(gameState);
    const viewerHasSeat = Boolean(viewerSeat) && Boolean(gameState.players?.[viewerSeat]);
    return (
      this.state.page === PAGE.GAME &&
      gameState.state !== LobbyState.SETUP &&
      !isVictoryState(gameState.state) &&
      (!this.state.showAlert || this.state.alertMinimized) &&
      ((viewerHasSeat && this.canViewerAct(gameState)) ||
        this.isViewerGameModerator(gameState))
    );
  }

  isViewerReadOnlySeatOwner(gameState: GameState = this.state.gameState): boolean {
    return (
      gameState.selfType === UserType.HUMAN &&
      gameState.controlledPlayer === this.state.name &&
      !this.canViewerAct(gameState)
    );
  }

  getSeatObserverAssignmentsByPlayer(
    gameState: GameState = this.state.gameState
  ): Record<string, string> {
    const byPlayer: Record<string, string> = {};
    Object.entries(gameState.observerAssignments || {}).forEach(
      ([observer, player]) => {
        if (typeof player === "string" && player !== "") {
          byPlayer[player] = observer;
        }
      }
    );
    return byPlayer;
  }

  handleBotControlTransition(
    wasSelfBotControlled: boolean,
    isSelfBotControlled: boolean
  ) {
    if (!wasSelfBotControlled && isSelfBotControlled) {
      // Clear any stale in-flight prompt/actions. The server now owns actions via bot.
      this.clearAnimationQueue();
      this.okMessageListeners = [];
      this.setState({
        showAlert: false,
        alertContent: <div />,
        alertMinimized: false,
        showVotes: false,
      });
      this.showSnackBar("Bot control was enabled for you. Reclaim to act.");
    } else if (wasSelfBotControlled && !isSelfBotControlled) {
      this.showSnackBar("You reclaimed manual control.");
    }
  }

  onClickSetBotStatus(target: string, enabled: boolean) {
    this.sendWSCommand({
      command: WSCommandType.SET_BOT_STATUS,
      target,
      enabled,
    });
  }

  onClickSetObserverAssignment(target: string, observer?: string) {
    this.sendWSCommand({
      command: WSCommandType.SET_OBSERVER_ASSIGNMENT,
      target,
      observer,
    });
  }

  //// Animation Handling
  // <editor-fold desc="Animation Handling">

  /**
   * Plays the next animation in the queue if it exists.
   * @effects If {@code this.animationQueue} is not empty,
   *          removes the function at the front of the animation queue and calls it.
   */
  onAnimationFinish() {
    if (this.animationQueue.length > 0) {
      let func = this.animationQueue.shift();
      if (func !== undefined) {
        func(); //call the function.
      }
    } else {
      // the animation queue is empty, so we set a flag.
      this.allAnimationsFinished = true;
      this.setState({ allAnimationsFinished: true });
    }
  }

  /**
   * Clears the animation queue and ends any currently playing animations.
   */
  clearAnimationQueue() {
    this.allAnimationsFinished = true;
    this.setState({ allAnimationsFinished: true });
    this.animationQueue = [];
  }

  /**
   * Adds the specified animation to the end of the queue.
   * @param func {function} the function to add to the animation queue.
   * @effects Adds the function to the back of the animation queue. If no animations are currently playing,
   *          starts the specified animation.
   */
  addAnimationToQueue(func: () => void) {
    this.animationQueue.push(func);
    if (this.allAnimationsFinished) {
      this.allAnimationsFinished = false;
      this.setState({ allAnimationsFinished: false });
      let func = this.animationQueue.shift();
      if (func !== undefined) {
        func(); //call the function.
      }
    }
  }

  showVotes(newState: GameState) {
    this.setState({ statusBarText: "Tallying votes..." });
    setTimeout(() => {
      this.setState({ showVotes: true });
    }, 1000);
    // Calculate final result:

    let noVotes = 0;
    let yesVotes = 0;
    Object.values(newState.userVotes).forEach((value) => {
      if (value) {
        yesVotes++;
      } else {
        noVotes++;
      }
    });
    setTimeout(() => {
      if (yesVotes > noVotes) {
        this.setState({
          statusBarText: yesVotes + " - " + noVotes + ": Vote passed",
        });
      } else {
        this.setState({
          statusBarText: yesVotes + " - " + noVotes + ": Vote failed",
        });
      }
    }, 2000);
    setTimeout(() => this.setState({ showVotes: false }), 6000);
    setTimeout(() => {
      this.onAnimationFinish();
    }, 6500);
  }

  /**
   * Adds a listener to be called when the server returns an 'OK' status.
   * @param func The function to be called.
   * @effects adds the listener to the queue of functions. When the server returns an 'OK' status, all of the
   *          listeners will be called and then cleared from the queue.
   */
  addServerOKListener(func: () => void) {
    this.okMessageListeners.push(func);
  }

  /**
   * Hides the CustomAlert and marks this animation as finished.
   * @param delayExit {boolean} When true, delays advancing the animation queue until after the alert is hidden.
   * @effects: Sets {@code this.state.showAlert} to false and hides the CustomAlert.
   *           If delayExit is true, waits until the CustomAlert is done hiding before advancing the animation queue.
   *           Otherwise, immediately queues the next animation.
   */
  hideAlertAndFinish(delayExit = true) {
    this.setState({ showAlert: false, alertMinimized: false });
    if (delayExit) {
      setTimeout(() => {
        this.setState({ alertContent: <div />, alertMinimized: false }); // reset the alert box contents
        this.onAnimationFinish();
      }, CUSTOM_ALERT_FADE_DURATION);
    } else {
      this.setState({ alertContent: <div />, alertMinimized: false });
      this.onAnimationFinish();
    }
  }

  minimizeAlert() {
    if (this.state.showAlert) {
      this.setState({ alertMinimized: true });
    }
  }

  restoreAlert() {
    if (this.state.showAlert) {
      this.setState({ alertMinimized: false });
    }
  }

  /**
   * Shows the eventBar for a set period of time.
   * @param message {String} the message for the Event Bar to be fully visible.
   * @param duration {Number} the duration (in ms) for the Event Bar to be visible. (default is 3000 ms).
   * @effects Adds a function to the animation queue that, when called, shows the EventBar with the given message
   *          for {@code duration} ms, then advances to the next animation when finished.
   */
  queueEventUpdate(message: string, duration = 2000) {
    this.addAnimationToQueue(() => {
      this.setState({
        showEventBar: true,
        eventBarMessage: message,
      });
      setTimeout(() => {
        this.setState({ showEventBar: false });
      }, duration);
      setTimeout(() => {
        this.onAnimationFinish();
      }, duration + EVENT_BAR_FADE_OUT_DURATION);
    });
  }

  /**
   * Adds a CustomAlert to the animation queue.
   * @param content {html} the contents to be shown in the AlertBox.
   * @param closeOnOK {boolean} whether to close the alert when the server responds with an ok message. (default = true)
   * @effects Adds a new function to the animation queue that, when called, causes a CustomAlert with the
   *          given {@code content} to appear. If {@code closeOnOK} is true, once shown, the alert box will
   *          be closed when the server responds with an 'ok' to any command. (There will be a short delay before the
   *          animation queue advances if not waiting for a server response.)
   */
  queueAlert(content: React.JSX.Element, closeOnOK = true) {
    this.addAnimationToQueue(() => {
      this.setState({
        alertContent: content,
        showAlert: true,
        alertMinimized: false,
      });
      if (closeOnOK) {
        // Remove the exit delay if waiting for the server response, because otherwise the player will lag
        // behind everyone else.
        this.addServerOKListener(() => this.hideAlertAndFinish(false));
      }
    });
  }

  /**
   * Adds an update to the status message to the animation queue.
   * @param message {String} the text for the status bar to display.
   * @effects Adds a new function to the animation queue that, when called, updates {@code this.state.statusBarText} to
   *          the message provided then instantly advances the animation queue.
   */
  queueStatusMessage(message: string) {
    this.addAnimationToQueue(() => {
      this.setState({ statusBarText: message });
      this.onAnimationFinish();
    });
  }

  // </editor-fold>

  /**
   * Renders the game page.
   */
  renderGamePage() {
    return (
      <div className="App" style={{ textAlign: "center" }}>
        <header className="App-header">{APP_HEADER_TEXT}</header>

        <StatusBar>{this.state.statusBarText}</StatusBar>

        <CustomAlert
          show={this.state.showAlert}
          allowMinimize={true}
          isMinimized={this.state.alertMinimized}
          onMinimize={this.minimizeAlert}
          onRestore={this.restoreAlert}
        >
          {this.state.alertContent}
        </CustomAlert>

        <EventBar
          show={this.state.showEventBar}
          message={this.state.eventBarMessage}
        />

        <div style={{ backgroundColor: "var(--backgroundDark)" }}>
          <PlayerDisplay
            gameState={this.state.gameState}
            user={this.state.name}
            showVotes={this.state.showVotes}
            showBusy={this.state.allAnimationsFinished} // Only show busy when there isn't an active animation.
            playerDisabledFilter={DISABLE_EXECUTED_PLAYERS}
            onBotControlToggle={(playerName, enabled) =>
              this.onClickSetBotStatus(playerName, enabled)
            }
            onOpenModeratorPrompt={(playerName) =>
              this.showGameModeratorPrompt(playerName)
            }
            onOpenObserverPrompt={(playerName) =>
              this.showObserverAssignmentPrompt(playerName)
            }
          />
        </div>

        {this.shouldShowDiscussionReactionDock() && (
          <DiscussionReactionDock
            activeReaction={this.getViewerDiscussionReaction()}
            config={this.state.gameState.discussionReactionConfig}
            canReact={this.canViewerUseDiscussionReactions()}
            isModerator={this.isViewerGameModerator()}
            isViewerDead={
              Boolean(
                this.state.gameState.players?.[this.getViewerSeat()] &&
                  !this.state.gameState.players[this.getViewerSeat()].alive
              )
            }
            soundMuted={this.state.reactionSoundsMuted}
            onReact={(reaction) => this.onClickSetDiscussionReaction(reaction)}
            onSaveConfig={(durationSeconds, allowDeadPlayers) =>
              this.onClickUpdateDiscussionReactionConfig(
                durationSeconds,
                allowDeadPlayers
              )
            }
            onSoundMutedChange={(muted) =>
              this.onClickSetReactionSoundsMuted(muted)
            }
          />
        )}

        {this.isViewerReadOnlySeatOwner() && (
          <div
            style={{
              margin: "12px auto 0",
              padding: "10px 12px",
              width: "min(90vw, 720px)",
              backgroundColor: "var(--backgroundDark)",
              textAlign: "left",
            }}
          >
            An observer is currently controlling your seat. You are in read-only
            mode until a moderator returns control.
          </div>
        )}

        {this.renderObserversPanel()}

        <div style={{ display: "inline-block" }}>
          <div
            id={"Board Layout"}
            style={{
              alignItems: "center",
              display: "flex",
              flexDirection: "column",
              margin: "10px auto",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                marginTop: "15px",
              }}
            >
              <Deck cardCount={this.state.drawDeckSize} deckType={"DRAW"} />

              <div style={{ margin: "auto auto" }}>
                <button
                  disabled={
                    this.state.gameState[PARAM_STATE] !==
                      STATE_POST_LEGISLATIVE ||
                    this.getViewerSeat() !== this.state.gameState[PARAM_PRESIDENT] ||
                    !this.canViewerAct()
                  }
                  onClick={() => {
                    this.sendWSCommand({ command: WSCommandType.END_TERM });
                  }}
                >
                  {" "}
                  END TERM
                </button>

                <PlayerPolicyStatus
                  numFascistPolicies={this.state.fascistPolicies}
                  numLiberalPolicies={this.state.liberalPolicies}
                  playerCount={this.state.gameState.playerOrder.length}
                />
              </div>

              <Deck
                cardCount={this.state.discardDeckSize}
                deckType={"DISCARD"}
              />
            </div>

            <Board
              numPlayers={this.state.gameState.playerOrder.length}
              numFascistPolicies={this.state.fascistPolicies}
              numLiberalPolicies={this.state.liberalPolicies}
              numAnarchistPoliciesResolved={this.state.gameState.anarchistPoliciesResolved || 0}
              setupConfig={this.state.gameState.setupConfig}
              electionTracker={this.state.electionTracker}
            />
          </div>
        </div>

        {this.state.gameState.historyConfig.showHistory && (
          <HistoryPanel
            history={this.state.gameState.history || []}
            playerOrder={this.state.gameState.playerOrder}
            showVoteBreakdown={this.state.gameState.historyConfig.showVoteBreakdown}
            showPublicActions={this.state.gameState.historyConfig.showPublicActions}
            showPolicyClaims={this.state.gameState.historyConfig.showPolicyClaims}
          />
        )}

        <div style={{ textAlign: "center" }}>
          <div id="snackbar">{this.state.snackbarMessage}</div>
        </div>
      </div>
    );
  }

  //</editor-fold>

  render() {
    // Check URL params. If joining from a lobby link, open the lobby with the given code.
    let url = window.location.search;
    let lobby = new URLSearchParams(url).get("lobby");
    if (lobby !== null && !this.state.lobbyFromURL) {
      this.setState({
        joinLobby: lobby.toUpperCase().substr(0, 4),
        lobbyFromURL: true,
      });
    }

    let page_render;
    switch (this.state.page) {
      case PAGE.LOBBY:
        page_render = this.renderLobbyPage();
        break;
      case PAGE.GAME:
        page_render = this.renderGamePage();
        break;
      case PAGE.LOGIN: // login is default
      default:
        page_render = this.renderLoginPage();
    }
    return (
      <>
        <HelmetMetaData />
        {page_render}
      </>
    );
  }
}

export default App;

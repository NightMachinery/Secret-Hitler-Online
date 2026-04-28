import React from 'react';
import { render, screen } from '@testing-library/react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import App from './App';
import { PAGE } from './constants';
import { createAnarchistSetupConfig } from './setup/GameSetupConfig';
import {
  DiscussionReactionType,
  HistoryRoundsToShow,
  LobbyState,
  Role,
  UserType,
} from './types';

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: async () => ({}),
    })
  );
});

afterEach(() => {
  jest.clearAllMocks();
});

test('renders the login header', () => {
  render(<App />);
  expect(screen.getByText(window.location.host.toUpperCase())).toBeInTheDocument();
});

test('create lobby screen no longer renders history settings', () => {
  render(<App />);
  expect(screen.queryByText(/history settings/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/show history panel/i)).not.toBeInTheDocument();
});

test('lobby setup panel renders preset dropdown automation and history controls', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let app;

  act(() => {
    app = ReactDOM.render(<App />, container);
  });

  act(() => {
    app.setState({
      page: PAGE.LOBBY,
      name: 'Alice',
      lobby: 'TEST',
      usernames: [],
      icons: {},
      lobbyCreator: 'Alice',
      lobbyModerators: [],
      lobbyConnected: {},
      lobbySetupConfig: createAnarchistSetupConfig(5),
      lobbySetupAutomation: {
        preset: 'ANARCHIST',
        autoRoles: true,
        autoPolicies: true,
        autoPowers: true,
      },
      lobbyHistoryConfig: {
        showHistory: true,
        showPublicActions: true,
        showVoteBreakdown: true,
        showPolicyClaims: true,
        roundsToShow: HistoryRoundsToShow.ALL,
      },
    });
  });

  expect(screen.getByLabelText('Setup preset')).toBeInTheDocument();
  expect(screen.getByLabelText('Auto roles')).toBeChecked();
  expect(screen.getByLabelText('Auto policies')).toBeChecked();
  expect(screen.getByLabelText('Auto powers')).toBeChecked();
  expect(screen.getByLabelText('Show history panel')).toBeChecked();
  expect(screen.getByLabelText('Rounds to show')).toBeInTheDocument();

  ReactDOM.unmountComponentAtNode(container);
  container.remove();
});

test('game page renders sticky status ticker and reaction side rail', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let app;

  act(() => {
    app = ReactDOM.render(<App />, container);
  });

  act(() => {
    app.setState({
      page: PAGE.GAME,
      name: 'Alice',
      lobby: 'TEST',
      gameState: {
        ...app.state.gameState,
        state: LobbyState.CHANCELLOR_NOMINATION,
        playerOrder: ['Alice', 'Bob'],
        players: {
          Alice: { id: Role.LIBERAL, alive: true, investigated: false, type: UserType.HUMAN },
          Bob: { id: Role.FASCIST, alive: true, investigated: false, type: UserType.HUMAN },
        },
        president: 'Alice',
        chancellor: '',
        controlledPlayer: 'Alice',
        canAct: true,
        selfType: UserType.HUMAN,
        discussionReactions: {
          Bob: { type: DiscussionReactionType.DISLIKE, expiresAt: Date.now() + 5000 },
        },
        discussionReactionConfig: { durationSeconds: 15, allowDeadPlayers: true },
        connected: { Alice: true, Bob: true },
        icon: { Alice: 'p_default', Bob: 'p_default' },
      },
      statusBarText: 'Bob disliked the discussion cue.',
    });
  });

  const statusBar = container.querySelector('#status-bar');
  expect(statusBar).toHaveClass('status-bar-sticky-ticker');
  expect(statusBar.previousElementSibling).toHaveClass('App-header');
  expect(screen.getByText('Bob disliked the discussion cue.')).toBeInTheDocument();
  expect(container.querySelector('#discussion-reaction-dock-wrap')).toHaveClass('discussion-reaction-dock-fixed-overlay');

  ReactDOM.unmountComponentAtNode(container);
  container.remove();
});

test('reaction dock is hidden only while popup is expanded, not minimized', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let app;

  act(() => {
    app = ReactDOM.render(<App />, container);
  });

  const baseGameState = {
    ...app.state.gameState,
    state: LobbyState.CHANCELLOR_NOMINATION,
    playerOrder: ['Alice', 'Bob'],
    players: {
      Alice: { id: Role.LIBERAL, alive: true, investigated: false, type: UserType.HUMAN },
      Bob: { id: Role.FASCIST, alive: true, investigated: false, type: UserType.HUMAN },
    },
    president: 'Alice',
    chancellor: '',
    controlledPlayer: 'Alice',
    canAct: true,
    selfType: UserType.HUMAN,
    discussionReactions: {},
    discussionReactionConfig: { durationSeconds: 15, allowDeadPlayers: true },
    connected: { Alice: true, Bob: true },
    icon: { Alice: 'p_default', Bob: 'p_default' },
  };

  act(() => {
    app.setState({
      page: PAGE.GAME,
      name: 'Alice',
      lobby: 'TEST',
      gameState: baseGameState,
      showAlert: true,
      alertMinimized: false,
      alertContent: <div>Prompt content</div>,
    });
  });

  expect(container.querySelector('#discussion-reaction-dock-wrap')).toBeNull();

  act(() => {
    app.setState({ alertMinimized: true });
  });

  expect(container.querySelector('#discussion-reaction-dock-wrap')).toBeInTheDocument();
  expect(screen.getByText('RETURN TO POPUP')).toBeInTheDocument();

  ReactDOM.unmountComponentAtNode(container);
  container.remove();
});


test('discussion reaction OK does not consume minimized action popup listener', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let app;

  act(() => {
    app = ReactDOM.render(<App />, container);
  });

  const closeActionPrompt = jest.fn();
  app.websocket = { send: jest.fn() };

  act(() => {
    app.setState({
      page: PAGE.GAME,
      name: 'Alice',
      lobby: 'TEST',
      showAlert: true,
      alertMinimized: true,
      alertContent: <div>Choose a chancellor</div>,
    });
    app.addServerOKListener(closeActionPrompt);
  });

  act(() => {
    app.onClickSetDiscussionReaction(DiscussionReactionType.LIKE);
  });

  await act(async () => {
    await app.onWebSocketMessage({ data: JSON.stringify({ type: 'ok' }) });
  });

  expect(closeActionPrompt).not.toHaveBeenCalled();
  expect(app.state.showAlert).toBe(true);
  expect(app.state.alertMinimized).toBe(true);
  expect(screen.getByText('RETURN TO POPUP')).toBeInTheDocument();

  ReactDOM.unmountComponentAtNode(container);
  container.remove();
});

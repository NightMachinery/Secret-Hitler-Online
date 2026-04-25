import React from 'react';
import { render, screen } from '@testing-library/react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import App from './App';
import { PAGE } from './constants';
import { createAnarchistSetupConfig } from './setup/GameSetupConfig';
import { HistoryRoundsToShow } from './types';

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

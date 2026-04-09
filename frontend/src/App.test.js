import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('react-ga', () => ({
  initialize: jest.fn(),
  pageview: jest.fn(),
  event: jest.fn(),
}));

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
  expect(screen.getAllByText(/SECRET-HITLER.ONLINE/i)[0]).toBeInTheDocument();
});

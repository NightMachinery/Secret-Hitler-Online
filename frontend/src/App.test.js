import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

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

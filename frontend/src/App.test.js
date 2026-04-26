import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './index.jsx';

jest.mock('./api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('App', () => {
  test('renders login copy by default', () => {
    const html = renderToString(<App />);
    expect(html).toContain('Welcome back');
    expect(html).toContain('Sign In');
  });
});

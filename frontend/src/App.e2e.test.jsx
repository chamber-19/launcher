import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import App from './App';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('launcher activation flow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    globalThis.__ENFORCE_PIN_ACTIVATION__ = true;
  });

  it('activates, accesses backend, and forces re-activation on 401', async () => {
    invoke.mockImplementation(async (command) => {
      if (command === 'get_hardware_fingerprint') {
        return { hash: 'hw-test-001' };
      }
      if (command === 'activate_machine') {
        return 'signed-token-abc';
      }
      if (command === 'validate_activation_token') {
        return true;
      }
      if (command === 'request_activation_pin') {
        return '123456';
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    let protectedCallCount = 0;
    global.fetch = vi.fn(async (url, init) => {
      const authHeader = init?.headers?.get?.('Authorization');

      if (String(url).includes('/api/health')) {
        expect(authHeader).toBe('Bearer signed-token-abc');
        return { ok: true, status: 200 };
      }

      if (String(url).includes('/api/scan-projects')) {
        expect(authHeader).toBe('Bearer signed-token-abc');
        protectedCallCount += 1;

        if (protectedCallCount === 1) {
          return { ok: true, status: 200 };
        }

        return { ok: false, status: 401 };
      }

      return { ok: false, status: 404 };
    });

    render(<App />);

    expect(await screen.findByText('Activate App')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Enter PIN'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByText('Activate'));

    expect(await screen.findByText('Available Apps')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Check protected backend access'));

    await waitFor(() => {
      expect(screen.getByText('Activate App')).toBeInTheDocument();
    });
  });
});

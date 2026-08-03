import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatWindow from './ChatWindow.jsx';

describe('ChatWindow', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { reply: 'AI reply' } }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends chat messages to the backend AI endpoint', async () => {
    localStorage.setItem('access_token', 'access-token');

    render(<ChatWindow onClose={vi.fn()} />);

    await userEvent.type(screen.getByRole('textbox'), 'hello{enter}');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/ai/chat'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer access-token',
          }),
        })
      );
    });
  });
});

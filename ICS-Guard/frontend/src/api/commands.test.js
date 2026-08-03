import { describe, expect, it, vi } from 'vitest';
import {
  CommandPollingTimeoutError,
  extractCommand,
  pollCommandStatus,
} from './commands';


describe('command API helpers', () => {
  it('extracts the backend success envelope without inventing state', () => {
    expect(extractCommand({
      status: 'success',
      data: {
        command: {
          command_id: 'cmd-1',
          command_type: 'ISOLATE',
          status: 'accepted',
        },
      },
    })).toMatchObject({
      command_id: 'cmd-1',
      command_type: 'isolate',
      status: 'accepted',
    });
    expect(extractCommand({ status: 'success', data: {} })).toBeNull();
  });

  it('polls until the server reports a terminal state', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ data: { command: { command_id: 'cmd-2', status: 'pending' } } })
      .mockResolvedValueOnce({ data: { command: { command_id: 'cmd-2', status: 'succeeded' } } });
    const onUpdate = vi.fn();

    const result = await pollCommandStatus('cmd-2', {
      request,
      onUpdate,
      wait: () => Promise.resolve(),
    });

    expect(result.status).toBe('succeeded');
    expect(request).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it('returns a typed timeout while preserving the last server command', async () => {
    const request = vi.fn().mockResolvedValue({
      data: { command: { command_id: 'cmd-3', status: 'pending' } },
    });

    await expect(pollCommandStatus('cmd-3', {
      request,
      timeoutMs: 0,
      wait: () => Promise.resolve(),
    })).rejects.toEqual(expect.objectContaining({
      name: CommandPollingTimeoutError.name,
      lastCommand: expect.objectContaining({ status: 'pending' }),
    }));
  });
});

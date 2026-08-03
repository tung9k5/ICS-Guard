import http from '@/api/httpClient';

export const TERMINAL_COMMAND_STATUSES = new Set([
  'succeeded',
  'failed',
  'expired',
  'cancelled',
]);

export class CommandPollingTimeoutError extends Error {
  constructor(commandId, lastCommand) {
    super(`Timed out while waiting for command ${commandId}`);
    this.name = 'CommandPollingTimeoutError';
    this.commandId = commandId;
    this.lastCommand = lastCommand;
  }
}

const asObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : null
);

export const extractCommand = (payload) => {
  const root = asObject(payload);
  const candidates = [
    root?.data?.command,
    root?.command,
    root?.data?.data?.command,
    root?.data,
    root,
  ];
  const command = candidates.find((candidate) => {
    const object = asObject(candidate);
    return object && (object.command_id || object.id || object._id) && object.status;
  });
  if (!command) return null;

  return {
    ...command,
    command_id: String(command.command_id || command.id || command._id),
    status: String(command.status).toLowerCase(),
    command_type: String(command.command_type || command.type || command.action || '').toLowerCase(),
  };
};

export const getCommandById = (commandId, options = {}) => http({
  url: `/commands/${encodeURIComponent(commandId)}`,
  method: 'GET',
  ...options,
});

const waitFor = (delayMs, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(signal.reason || new DOMException('Polling aborted', 'AbortError'));
    return;
  }
  const handleAbort = () => {
    clearTimeout(timeout);
    reject(signal.reason || new DOMException('Polling aborted', 'AbortError'));
  };
  const timeout = setTimeout(() => {
    signal?.removeEventListener('abort', handleAbort);
    resolve();
  }, delayMs);
  signal?.addEventListener('abort', handleAbort, { once: true });
});

export const pollCommandStatus = async (
  commandId,
  {
    intervalMs = 1000,
    timeoutMs = 35_000,
    signal,
    onUpdate,
    request = getCommandById,
    wait = waitFor,
  } = {},
) => {
  if (!commandId) throw new Error('commandId is required');
  const startedAt = Date.now();
  let lastCommand = null;

  while (Date.now() - startedAt <= timeoutMs) {
    if (signal?.aborted) {
      throw signal.reason || new DOMException('Polling aborted', 'AbortError');
    }
    const response = await request(commandId, { skipLoading: true, signal });
    const command = extractCommand(response);
    if (!command) {
      throw new Error(`Command status response for ${commandId} is missing a command`);
    }
    lastCommand = command;
    onUpdate?.(command);
    if (TERMINAL_COMMAND_STATUSES.has(command.status)) {
      return command;
    }
    await wait(intervalMs, signal);
  }

  throw new CommandPollingTimeoutError(commandId, lastCommand);
};

export default {
  getById: getCommandById,
  poll: pollCommandStatus,
};

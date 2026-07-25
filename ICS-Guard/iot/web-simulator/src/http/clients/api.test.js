describe('web simulator api client', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    window.history.pushState({}, '', '/attacker');
  });

  it('adds attacker auth and simulator API keys for attacker routes', async () => {
    const client = {
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };

    vi.doMock('axios', () => ({
      default: {
        create: vi.fn(() => client),
        post: vi.fn(),
      },
    }));

    vi.doMock('@/utils/loadingEvent', () => ({
      showGlobalLoading: vi.fn(),
      hideGlobalLoading: vi.fn(),
    }));

    await import('./api.js');
    localStorage.setItem('attacker_access_token', 'attacker-token');
    localStorage.setItem('attacker_authenticated', 'true');

    const requestHandler = client.interceptors.request.use.mock.calls[0][0];
    const config = requestHandler({ headers: {} });

    expect(config.headers.Authorization).toBe('Bearer attacker-token');
    expect(config.headers['x-simulator-api-key']).toBeTruthy();
    expect(config.headers['x-attack-simulator-api-key']).toBeTruthy();
  });

  it('adds demo API keys without a login for the public attacks route', async () => {
    window.history.pushState({}, '', '/attacks');
    const client = {
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };

    vi.doMock('axios', () => ({
      default: {
        create: vi.fn(() => client),
        post: vi.fn(),
      },
    }));
    vi.doMock('@/utils/loadingEvent', () => ({
      showGlobalLoading: vi.fn(),
      hideGlobalLoading: vi.fn(),
    }));

    await import('./api.js');
    const requestHandler = client.interceptors.request.use.mock.calls[0][0];
    const config = requestHandler({ headers: {} });

    expect(config.headers.Authorization).toBeUndefined();
    expect(config.headers['x-simulator-api-key']).toBeTruthy();
    expect(config.headers['x-attack-simulator-api-key']).toBeTruthy();
  });
});

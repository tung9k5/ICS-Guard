describe('web simulator API authentication', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    window.history.pushState({}, '', '/attacks');
  });

  function mockAxios() {
    const clients = [];
    vi.doMock('axios', () => ({
      default: {
        create: vi.fn(() => {
          const client = {
            interceptors: {
              request: { use: vi.fn() },
              response: { use: vi.fn() },
            },
          };
          clients.push(client);
          return client;
        }),
        post: vi.fn(),
      },
    }));
    vi.doMock('@/utils/loadingEvent', () => ({
      showGlobalLoading: vi.fn(),
      hideGlobalLoading: vi.fn(),
    }));
    return clients;
  }

  it('uses the scoped attacker bearer token and never adds machine credentials', async () => {
    const clients = mockAxios();
    localStorage.setItem('attacker_access_token', 'attacker-user-token');
    await import('./trustEdges.js');

    const attackClient = clients[1];
    const requestHandler = attackClient.interceptors.request.use.mock.calls[0][0];
    const config = requestHandler({ headers: {} });

    expect(config.headers).toEqual({ Authorization: 'Bearer attacker-user-token' });
  });

  it('does not invent credentials when the user has no session', async () => {
    const clients = mockAxios();
    await import('./trustEdges.js');

    const hardwareClient = clients[0];
    const requestHandler = hardwareClient.interceptors.request.use.mock.calls[0][0];
    const config = requestHandler({ headers: {} });

    expect(config.headers.Authorization).toBeUndefined();
    expect(Object.keys(config.headers)).toEqual([]);
  });
});

describe('frontend httpClient', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('adds bearer token to authenticated requests', async () => {
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

    await import('./httpClient.js');
    localStorage.setItem('access_token', 'access-token');

    const requestHandler = client.interceptors.request.use.mock.calls[0][0];
    const config = requestHandler({ headers: {} });

    expect(config.headers.Authorization).toBe('Bearer access-token');
  });
});

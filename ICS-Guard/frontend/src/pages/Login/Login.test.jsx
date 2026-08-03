import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import Login from './index.jsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ login: vi.fn(), loading: false }),
}));

vi.mock('@/api/auth', () => ({
  default: { login: vi.fn() },
}));

vi.mock('@/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('Login page', () => {
  it('renders the login form fields and submit button', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/auth\.login\.password/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'auth.login.submit' })).toBeInTheDocument();
  });
});

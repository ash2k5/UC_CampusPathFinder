// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const signIn = vi.fn().mockResolvedValue({});
const signUp = vi.fn().mockResolvedValue({});

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  signInWithEmailAndPassword: (...args) => signIn(...args),
  createUserWithEmailAndPassword: (...args) => signUp(...args),
}));

import LoginScreen from '../../app/components/LoginScreen';

describe('LoginScreen', () => {
  beforeEach(() => {
    signIn.mockClear();
    signUp.mockClear();
  });

  it('gives the email and password fields accessible names', () => {
    render(<LoginScreen />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('signs in with the entered credentials', async () => {
    const { container } = render(<LoginScreen />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret1' } });
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    const [, email, password] = signIn.mock.calls[0];
    expect(email).toBe('a@b.com');
    expect(password).toBe('secret1');
  });

  it('switches to account creation mode', () => {
    render(<LoginScreen />);
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByPlaceholderText(/min 6 characters/i)).toBeInTheDocument();
  });

  it('shows a generic signup fallback without leaking the raw error code', async () => {
    signUp.mockRejectedValueOnce({ code: 'auth/internal-error' });
    const { container } = render(<LoginScreen />);
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret1' } });
    fireEvent.submit(container.querySelector('form'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not create account');
    expect(alert).not.toHaveTextContent('auth/');
  });

  it('maps a known signup error code to a friendly message', async () => {
    signUp.mockRejectedValueOnce({ code: 'auth/email-already-in-use' });
    const { container } = render(<LoginScreen />);
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret1' } });
    fireEvent.submit(container.querySelector('form'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('already exists');
  });
});

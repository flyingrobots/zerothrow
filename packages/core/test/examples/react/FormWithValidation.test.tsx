import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { RegistrationForm } from './FormWithValidation.js';

describe('RegistrationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset registration attempts counter for consistent test results
    // Note: In real app, you'd reset this through a proper API or module reset
  });

  it('should render form fields', () => {
    render(<RegistrationForm />);

    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
  });

  it('should validate username field', async () => {
    render(<RegistrationForm />);

    const usernameInput = screen.getByLabelText('Username');
    const submitButton = screen.getByRole('button', { name: 'Register' });

    // Test too short username
    await userEvent.type(usernameInput, 'ab');
    await userEvent.click(submitButton);

    expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument();

    // Test invalid characters
    await userEvent.clear(usernameInput);
    await userEvent.type(usernameInput, 'test@user');
    await userEvent.click(submitButton);

    expect(screen.getByText('Username can only contain letters, numbers, and underscores')).toBeInTheDocument();
  });

  it('should validate email field', async () => {
    render(<RegistrationForm />);

    const emailInput = screen.getByLabelText('Email');
    const submitButton = screen.getByRole('button', { name: 'Register' });

    await userEvent.type(emailInput, 'invalid-email');
    await userEvent.click(submitButton);

    expect(screen.getByText('Invalid email format')).toBeInTheDocument();
  });

  it('should validate password field', async () => {
    render(<RegistrationForm />);

    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Register' });

    // Test too short password
    await userEvent.type(passwordInput, 'short');
    await userEvent.click(submitButton);

    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();

    // Test password without required complexity
    await userEvent.clear(passwordInput);
    await userEvent.type(passwordInput, 'simplepassword');
    await userEvent.click(submitButton);

    expect(screen.getByText('Password must contain uppercase, lowercase, and number')).toBeInTheDocument();
  });

  it('should submit form successfully with valid data', async () => {
    render(<RegistrationForm />);

    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Register' });

    // Fill valid data with username that will succeed
    await userEvent.type(usernameInput, 'newuser');
    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'Password123');

    await userEvent.click(submitButton);

    // Should show submitting state
    expect(screen.getByText('Registering...')).toBeInTheDocument();

    // Wait for submission to complete
    await waitFor(() => {
      expect(screen.getByText(/Success:/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Registration successful/)).toBeInTheDocument();
  });

  it('should handle submission failure for existing username', async () => {
    render(<RegistrationForm />);

    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Register' });

    // Fill data with username that will fail
    await userEvent.type(usernameInput, 'existinguser');
    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'Password123');

    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Registration failed: Username already exists/)).toBeInTheDocument();
  });

  it('should clear error when user starts typing', async () => {
    render(<RegistrationForm />);

    const usernameInput = screen.getByLabelText('Username');
    const submitButton = screen.getByRole('button', { name: 'Register' });

    // Trigger validation error
    await userEvent.type(usernameInput, 'ab');
    await userEvent.click(submitButton);

    expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument();

    // Start typing to clear error
    await userEvent.type(usernameInput, 'c');

    expect(screen.queryByText('Username must be at least 3 characters')).not.toBeInTheDocument();
  });
});
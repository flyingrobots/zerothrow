import React, { useState } from 'react';
import { Result, ZeroThrow } from '@zerothrow/core';
const { ok, err } = ZeroThrow;

// Validation types
type ValidationError = {
  field: string;
  message: string;
};

type FormData = {
  username: string;
  email: string;
  password: string;
};

// Validation functions using Result type
const validateUsername = (username: string): Result<string, ValidationError> => {
  if (username.length < 3) {
    return err({ field: 'username', message: 'Username must be at least 3 characters' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return err({ field: 'username', message: 'Username can only contain letters, numbers, and underscores' });
  }
  return ok(username);
};

const validateEmail = (email: string): Result<string, ValidationError> => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return err({ field: 'email', message: 'Invalid email format' });
  }
  return ok(email);
};

const validatePassword = (password: string): Result<string, ValidationError> => {
  if (password.length < 8) {
    return err({ field: 'password', message: 'Password must be at least 8 characters' });
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return err({ field: 'password', message: 'Password must contain uppercase, lowercase, and number' });
  }
  return ok(password);
};

// Main form component
export function RegistrationForm() {
  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
    password: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<Result<string, string> | null>(null);

  const validateForm = (): { ok: true; value: FormData } | { ok: false; errors: ValidationError[] } => {
    const validationErrors: ValidationError[] = [];
    
    const usernameResult = validateUsername(formData.username);
    if (!usernameResult.ok) {
      // Extract the ValidationError from the ZeroError.code
      const validationError = usernameResult.error.code as ValidationError;
      validationErrors.push(validationError);
    }
    
    const emailResult = validateEmail(formData.email);
    if (!emailResult.ok) {
      // Extract the ValidationError from the ZeroError.code
      const validationError = emailResult.error.code as ValidationError;
      validationErrors.push(validationError);
    }
    
    const passwordResult = validatePassword(formData.password);
    if (!passwordResult.ok) {
      // Extract the ValidationError from the ZeroError.code
      const validationError = passwordResult.error.code as ValidationError;
      validationErrors.push(validationError);
    }
    
    if (validationErrors.length > 0) {
      return { ok: false, errors: validationErrors };
    }
    
    return { ok: true, value: formData };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitResult(null);
    
    const validation = validateForm();
    
    if (!validation.ok) {
      const errorMap: Record<string, string> = {};
      validation.errors.forEach((error: ValidationError) => {
        errorMap[error.field] = error.message;
      });
      setErrors(errorMap);
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Simulate API call
      const result = await submitRegistration(validation.value);
      setSubmitResult(result);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="registration-form">
      <div className="form-group">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={formData.username}
          onChange={handleChange('username')}
          className={errors.username ? 'error' : ''}
          disabled={submitting}
        />
        {errors.username && <span className="error-message">{errors.username}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={handleChange('email')}
          className={errors.email ? 'error' : ''}
          disabled={submitting}
        />
        {errors.email && <span className="error-message">{errors.email}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={formData.password}
          onChange={handleChange('password')}
          className={errors.password ? 'error' : ''}
          disabled={submitting}
        />
        {errors.password && <span className="error-message">{errors.password}</span>}
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Registering...' : 'Register'}
      </button>

      {submitResult && (
        <div className={`submit-result ${submitResult.ok ? 'success' : 'error'}`}>
          {submitResult.ok 
            ? `Success: ${submitResult.value}`
            : `Error: ${submitResult.error}`}
        </div>
      )}
    </form>
  );
}

// Simulated API function
// For testing, use specific usernames to control behavior
async function submitRegistration(data: FormData): Promise<Result<string, string>> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Deterministic behavior based on username
  if (data.username === 'existinguser' || data.username === 'testfail') {
    return err('Registration failed: Username already exists');
  }
  
  return ok('Registration successful! Check your email for verification.');
}
/**
 * Example: React Form with ZeroThrow
 * 
 * This example demonstrates form handling, validation, and submission
 * with proper error handling using ZeroThrow in a React application.
 */

import React, { useState, FormEvent } from 'react';
import { 
  Result, 
  ok, 
  err, 
  tryR, 
  ZeroError, 
  andThen,
  collect 
} from '@flyingrobots/zerothrow';
import { useResult } from '@flyingrobots/zerothrow/react';

// Types
interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
}

interface FieldError {
  field: keyof FormData;
  message: string;
}

// Validation rules
const ValidationRules = {
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address'
  },
  password: {
    required: true,
    minLength: 8,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
    message: 'Password must contain uppercase, lowercase, number and special character'
  },
  name: {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z\s'-]+$/,
    message: 'Name must contain only letters, spaces, hyphens and apostrophes'
  }
} as const;

// Validation functions
function validateEmail(email: string): Result<string, FieldError> {
  if (!email) {
    return err({ field: 'email', message: 'Email is required' });
  }
  
  if (!ValidationRules.email.pattern.test(email)) {
    return err({ field: 'email', message: ValidationRules.email.message });
  }
  
  return ok(email.toLowerCase());
}

function validatePassword(password: string): Result<string, FieldError> {
  if (!password) {
    return err({ field: 'password', message: 'Password is required' });
  }
  
  if (password.length < ValidationRules.password.minLength) {
    return err({ 
      field: 'password', 
      message: `Password must be at least ${ValidationRules.password.minLength} characters` 
    });
  }
  
  if (!ValidationRules.password.pattern.test(password)) {
    return err({ field: 'password', message: ValidationRules.password.message });
  }
  
  return ok(password);
}

function validatePasswordMatch(
  password: string, 
  confirmPassword: string
): Result<void, FieldError> {
  if (password !== confirmPassword) {
    return err({ field: 'confirmPassword', message: 'Passwords do not match' });
  }
  return ok(undefined);
}

function validateName(name: string, field: 'firstName' | 'lastName'): Result<string, FieldError> {
  if (!name) {
    return err({ field, message: `${field === 'firstName' ? 'First' : 'Last'} name is required` });
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < ValidationRules.name.minLength) {
    return err({ 
      field, 
      message: `Name must be at least ${ValidationRules.name.minLength} characters` 
    });
  }
  
  if (trimmed.length > ValidationRules.name.maxLength) {
    return err({ 
      field, 
      message: `Name must be at most ${ValidationRules.name.maxLength} characters` 
    });
  }
  
  if (!ValidationRules.name.pattern.test(trimmed)) {
    return err({ field, message: ValidationRules.name.message });
  }
  
  return ok(trimmed);
}

function validateTerms(accepted: boolean): Result<void, FieldError> {
  if (!accepted) {
    return err({ field: 'acceptTerms', message: 'You must accept the terms and conditions' });
  }
  return ok(undefined);
}

// Form validation
function validateForm(data: FormData): Result<FormData, FieldError[]> {
  const results = [
    validateEmail(data.email),
    validatePassword(data.password),
    validatePasswordMatch(data.password, data.confirmPassword),
    validateName(data.firstName, 'firstName'),
    validateName(data.lastName, 'lastName'),
    validateTerms(data.acceptTerms)
  ];
  
  const errors = results
    .filter(r => r.isErr)
    .map(r => (r as { error: FieldError }).error);
  
  if (errors.length > 0) {
    return err(errors);
  }
  
  return ok(data);
}

// API functions
async function checkEmailAvailability(email: string): Promise<Result<boolean, ZeroError>> {
  return tryR(
    async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Simulate some emails being taken
      const takenEmails = ['admin@example.com', 'test@example.com'];
      return !takenEmails.includes(email.toLowerCase());
    },
    (error) => new ZeroError('API_ERROR', 'Failed to check email availability', error)
  );
}

async function createAccount(data: FormData): Promise<Result<User, ZeroError>> {
  return tryR(
    async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate occasional failures
      if (Math.random() < 0.1) {
        throw new Error('Network error');
      }
      
      return {
        id: Math.random().toString(36).substr(2, 9),
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        createdAt: new Date()
      };
    },
    (error) => new ZeroError(
      'REGISTRATION_FAILED',
      'Failed to create account',
      error,
      { email: data.email }
    )
  );
}

// React Components
interface FormFieldProps {
  label: string;
  name: keyof FormData;
  type?: string;
  value: string | boolean;
  error?: string;
  onChange: (name: keyof FormData, value: string | boolean) => void;
  onBlur?: (name: keyof FormData) => void;
}

function FormField({ 
  label, 
  name, 
  type = 'text', 
  value, 
  error, 
  onChange, 
  onBlur 
}: FormFieldProps) {
  if (type === 'checkbox') {
    return (
      <div className="form-field">
        <label className="checkbox-label">
          <input
            type="checkbox"
            name={name}
            checked={value as boolean}
            onChange={(e) => onChange(name, e.target.checked)}
          />
          {label}
        </label>
        {error && <span className="error">{error}</span>}
      </div>
    );
  }
  
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        value={value as string}
        onChange={(e) => onChange(name, e.target.value)}
        onBlur={() => onBlur?.(name)}
        className={error ? 'error' : ''}
      />
      {error && <span className="error">{error}</span>}
    </div>
  );
}

function RegistrationForm() {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    acceptTerms: false
  });
  
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [touched, setTouched] = useState<Set<keyof FormData>>(new Set());
  
  // Email availability check
  const { 
    data: emailAvailable, 
    loading: checkingEmail,
    refetch: checkEmail 
  } = useResult(
    async () => {
      if (!formData.email || !validateEmail(formData.email).isOk) {
        return ok(undefined);
      }
      return checkEmailAvailability(formData.email);
    },
    [formData.email]
  );
  
  // Form submission
  const {
    data: user,
    error: submitError,
    loading: submitting,
    refetch: submit
  } = useResult(
    async () => {
      const validationResult = validateForm(formData);
      if (validationResult.isErr) {
        // Update field errors
        const errors: Partial<Record<keyof FormData, string>> = {};
        validationResult.error.forEach(err => {
          errors[err.field] = err.message;
        });
        setFieldErrors(errors);
        return err(new ZeroError('VALIDATION_FAILED', 'Please fix the errors below'));
      }
      
      // Check email availability
      if (emailAvailable === false) {
        setFieldErrors({ email: 'This email is already registered' });
        return err(new ZeroError('EMAIL_TAKEN', 'Email is already registered'));
      }
      
      // Create account
      return createAccount(formData);
    },
    [] // Manual trigger only
  );
  
  const handleChange = (name: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };
  
  const handleBlur = (name: keyof FormData) => {
    setTouched(prev => new Set(prev).add(name));
    
    // Validate field on blur
    let result: Result<any, FieldError>;
    switch (name) {
      case 'email':
        result = validateEmail(formData.email);
        break;
      case 'password':
        result = validatePassword(formData.password);
        break;
      case 'confirmPassword':
        result = validatePasswordMatch(formData.password, formData.confirmPassword);
        break;
      case 'firstName':
        result = validateName(formData.firstName, 'firstName');
        break;
      case 'lastName':
        result = validateName(formData.lastName, 'lastName');
        break;
      case 'acceptTerms':
        result = validateTerms(formData.acceptTerms);
        break;
      default:
        return;
    }
    
    if (result.isErr) {
      setFieldErrors(prev => ({ ...prev, [name]: result.error.message }));
    }
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched(new Set(Object.keys(formData) as Array<keyof FormData>));
    
    // Submit form
    await submit();
  };
  
  if (user) {
    return (
      <div className="success-message">
        <h2>Welcome, {user.firstName}!</h2>
        <p>Your account has been created successfully.</p>
        <p>We've sent a confirmation email to {user.email}</p>
      </div>
    );
  }
  
  return (
    <form onSubmit={handleSubmit} className="registration-form">
      <h2>Create Your Account</h2>
      
      <FormField
        label="Email"
        name="email"
        type="email"
        value={formData.email}
        error={touched.has('email') ? fieldErrors.email : undefined}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      {checkingEmail && <span className="checking">Checking availability...</span>}
      {emailAvailable === false && (
        <span className="error">This email is already registered</span>
      )}
      
      <FormField
        label="Password"
        name="password"
        type="password"
        value={formData.password}
        error={touched.has('password') ? fieldErrors.password : undefined}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      
      <FormField
        label="Confirm Password"
        name="confirmPassword"
        type="password"
        value={formData.confirmPassword}
        error={touched.has('confirmPassword') ? fieldErrors.confirmPassword : undefined}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      
      <FormField
        label="First Name"
        name="firstName"
        value={formData.firstName}
        error={touched.has('firstName') ? fieldErrors.firstName : undefined}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      
      <FormField
        label="Last Name"
        name="lastName"
        value={formData.lastName}
        error={touched.has('lastName') ? fieldErrors.lastName : undefined}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      
      <FormField
        label="I accept the terms and conditions"
        name="acceptTerms"
        type="checkbox"
        value={formData.acceptTerms}
        error={touched.has('acceptTerms') ? fieldErrors.acceptTerms : undefined}
        onChange={handleChange}
      />
      
      {submitError && (
        <div className="error-message">
          {submitError.message}
          {submitError.code === 'REGISTRATION_FAILED' && (
            <button type="button" onClick={() => submit()}>Try Again</button>
          )}
        </div>
      )}
      
      <button 
        type="submit" 
        disabled={submitting || checkingEmail}
        className="submit-button"
      >
        {submitting ? 'Creating Account...' : 'Create Account'}
      </button>
    </form>
  );
}

// CSS styles (in a real app, use CSS modules or styled-components)
const styles = `
.registration-form {
  max-width: 400px;
  margin: 0 auto;
  padding: 20px;
}

.form-field {
  margin-bottom: 20px;
}

.form-field label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-field input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-field input.error {
  border-color: #f00;
}

.error {
  color: #f00;
  font-size: 14px;
  margin-top: 5px;
  display: block;
}

.checkbox-label {
  display: flex;
  align-items: center;
}

.checkbox-label input {
  width: auto;
  margin-right: 8px;
}

.checking {
  font-size: 14px;
  color: #666;
  font-style: italic;
}

.submit-button {
  width: 100%;
  padding: 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}

.submit-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.error-message {
  background: #fee;
  border: 1px solid #fcc;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.success-message {
  background: #efe;
  border: 1px solid #cfc;
  padding: 20px;
  border-radius: 4px;
  text-align: center;
}
`;

export default RegistrationForm;
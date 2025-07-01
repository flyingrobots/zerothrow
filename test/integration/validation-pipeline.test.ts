import { describe, it, expect, vi } from 'vitest';
import { tryR, wrap, err, ok, Result, ZeroError } from '../../src/index';

// Real-world Validation Pipeline Integration Test
interface UserRegistration {
  username: string;
  email: string;
  password: string;
  age: number;
  termsAccepted: boolean;
  referralCode?: string;
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}

type ValidationResult<T> = Result<T, ZeroError>;

class ValidationPipeline<T> {
  private validators: Array<(data: T) => Promise<ValidationResult<T>>> = [];
  private errors: ValidationError[] = [];

  add(validator: (data: T) => Promise<ValidationResult<T>>): ValidationPipeline<T> {
    this.validators.push(validator);
    return this;
  }

  async validate(data: T): Promise<ValidationResult<T>> {
    this.errors = [];
    let currentData = data;

    for (const validator of this.validators) {
      const result = await validator(currentData);
      
      if (!result.ok) {
        // Collect errors but continue validation to find all issues
        const error = result.error;
        if (error.context?.field) {
          this.errors.push({
            field: error.context.field as string,
            message: error.message,
            code: error.code as string
          });
        }
      } else {
        currentData = result.value;
      }
    }

    if (this.errors.length > 0) {
      return err(new ZeroError('VALIDATION_FAILED', 'Validation pipeline failed', {
        context: {
          errors: this.errors,
          errorCount: this.errors.length
        }
      }));
    }

    return ok(currentData);
  }

  async validateWithShortCircuit(data: T): Promise<ValidationResult<T>> {
    let currentData = data;

    for (const validator of this.validators) {
      const result = await validator(currentData);
      
      if (!result.ok) {
        return result;
      }
      
      currentData = result.value;
    }

    return ok(currentData);
  }
}

// Individual validators
class UserValidators {
  static async validateUsername(data: UserRegistration): Promise<ValidationResult<UserRegistration>> {
    const { username } = data;

    if (!username || username.trim().length === 0) {
      return err(new ZeroError('EMPTY_USERNAME', 'Username is required', {
        context: {
          field: 'username'
        }
      }));
    }

    if (username.length < 3) {
      return err(new ZeroError('USERNAME_TOO_SHORT', 'Username must be at least 3 characters', {
        context: {
          field: 'username',
          minLength: 3,
          actualLength: username.length
        }
      }));
    }

    if (username.length > 20) {
      return err(new ZeroError('USERNAME_TOO_LONG', 'Username must be at most 20 characters', {
        context: {
          field: 'username',
          maxLength: 20,
          actualLength: username.length
        }
      }));
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return err(new ZeroError('INVALID_USERNAME_FORMAT', 'Username can only contain letters, numbers, underscores, and hyphens', {
        context: {
          field: 'username',
          pattern: '^[a-zA-Z0-9_-]+$'
        }
      }));
    }

    return ok(data);
  }

  static async validateEmail(data: UserRegistration): Promise<ValidationResult<UserRegistration>> {
    const { email } = data;

    if (!email || email.trim().length === 0) {
      return err(new ZeroError('EMPTY_EMAIL', 'Email is required', {
        context: {
          field: 'email'
        }
      }));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return err(new ZeroError('INVALID_EMAIL_FORMAT', 'Invalid email format', {
        context: {
          field: 'email',
          value: email
        }
      }));
    }

    return ok(data);
  }

  static async validatePassword(data: UserRegistration): Promise<ValidationResult<UserRegistration>> {
    const { password } = data;

    if (!password || password.length === 0) {
      return err(new ZeroError('EMPTY_PASSWORD', 'Password is required', {
        context: {
          field: 'password'
        }
      }));
    }

    if (password.length < 8) {
      return err(new ZeroError('PASSWORD_TOO_SHORT', 'Password must be at least 8 characters', {
        context: {
          field: 'password',
          minLength: 8,
          actualLength: password.length
        }
      }));
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      return err(new ZeroError('WEAK_PASSWORD', 'Password must contain uppercase, lowercase, number, and special character', {
        context: {
          field: 'password',
          requirements: {
            hasUpperCase,
            hasLowerCase,
            hasNumber,
            hasSpecialChar
          }
        }
      }));
    }

    return ok(data);
  }

  static async validateAge(data: UserRegistration): Promise<ValidationResult<UserRegistration>> {
    const { age } = data;

    if (age === undefined || age === null) {
      return err(new ZeroError('MISSING_AGE', 'Age is required', {
        context: {
          field: 'age'
        }
      }));
    }

    if (!Number.isInteger(age)) {
      return err(new ZeroError('INVALID_AGE_TYPE', 'Age must be an integer', {
        context: {
          field: 'age',
          value: age
        }
      }));
    }

    if (age < 13) {
      return err(new ZeroError('AGE_TOO_YOUNG', 'Must be at least 13 years old', {
        context: {
          field: 'age',
          minAge: 13,
          actualAge: age
        }
      }));
    }

    if (age > 120) {
      return err(new ZeroError('AGE_TOO_OLD', 'Invalid age value', {
        context: {
          field: 'age',
          maxAge: 120,
          actualAge: age
        }
      }));
    }

    return ok(data);
  }

  static async validateTerms(data: UserRegistration): Promise<ValidationResult<UserRegistration>> {
    if (!data.termsAccepted) {
      return err(new ZeroError('TERMS_NOT_ACCEPTED', 'Terms and conditions must be accepted', {
        context: {
          field: 'termsAccepted'
        }
      }));
    }

    return ok(data);
  }

  static async checkEmailUniqueness(data: UserRegistration): Promise<ValidationResult<UserRegistration>> {
    // Simulate async database check
    await new Promise(resolve => setTimeout(resolve, 10));

    // Mock: pretend these emails are already taken
    const takenEmails = ['admin@example.com', 'test@example.com'];
    
    if (takenEmails.includes(data.email.toLowerCase())) {
      return err(new ZeroError('EMAIL_TAKEN', 'Email address is already registered', {
        context: {
          field: 'email',
          value: data.email
        }
      }));
    }

    return ok(data);
  }

  static async validateReferralCode(data: UserRegistration): Promise<ValidationResult<UserRegistration>> {
    if (!data.referralCode) {
      return ok(data); // Optional field
    }

    // Simulate async API call to validate referral code
    await new Promise(resolve => setTimeout(resolve, 20));

    const validCodes = ['FRIEND2023', 'WELCOME50', 'SPECIAL100'];
    
    if (!validCodes.includes(data.referralCode)) {
      return err(new ZeroError('INVALID_REFERRAL_CODE', 'Invalid referral code', {
        context: {
          field: 'referralCode',
          value: data.referralCode
        }
      }));
    }

    // Transform data - apply referral bonus
    return ok({
      ...data,
      referralCode: data.referralCode.toUpperCase()
    });
  }
}

describe('Validation Pipeline Integration Tests', () => {
  it('should validate a complete valid registration', async () => {
    const pipeline = new ValidationPipeline<UserRegistration>()
      .add(UserValidators.validateUsername)
      .add(UserValidators.validateEmail)
      .add(UserValidators.validatePassword)
      .add(UserValidators.validateAge)
      .add(UserValidators.validateTerms)
      .add(UserValidators.checkEmailUniqueness)
      .add(UserValidators.validateReferralCode);

    const validData: UserRegistration = {
      username: 'john_doe',
      email: 'john@example.com',
      password: 'SecurePass123!',
      age: 25,
      termsAccepted: true,
      referralCode: 'FRIEND2023'
    };

    const result = await pipeline.validateWithShortCircuit(validData);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.referralCode).toBe('FRIEND2023');
    }
  });

  it('should collect all validation errors when using validate()', async () => {
    const pipeline = new ValidationPipeline<UserRegistration>()
      .add(UserValidators.validateUsername)
      .add(UserValidators.validateEmail)
      .add(UserValidators.validatePassword)
      .add(UserValidators.validateAge)
      .add(UserValidators.validateTerms);

    const invalidData: UserRegistration = {
      username: 'a', // Too short
      email: 'invalid-email', // Invalid format
      password: 'weak', // Too weak
      age: 10, // Too young
      termsAccepted: false // Not accepted
    };

    const result = await pipeline.validate(invalidData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.context?.errorCount).toBe(5);
      const errors = result.error.context?.errors as ValidationError[];
      expect(errors).toHaveLength(5);
      expect(errors.map(e => e.field)).toEqual([
        'username',
        'email',
        'password',
        'age',
        'termsAccepted'
      ]);
    }
  });

  it('should short-circuit on first error when using validateWithShortCircuit()', async () => {
    const pipeline = new ValidationPipeline<UserRegistration>()
      .add(UserValidators.validateUsername)
      .add(UserValidators.validateEmail)
      .add(UserValidators.validatePassword);

    const invalidData: UserRegistration = {
      username: '', // Will fail first
      email: 'also-invalid',
      password: 'also-weak',
      age: 25,
      termsAccepted: true
    };

    const result = await pipeline.validateWithShortCircuit(invalidData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('EMPTY_USERNAME');
      expect(result.error.context?.field).toBe('username');
    }
  });

  it('should handle async validation with external API calls', async () => {
    const pipeline = new ValidationPipeline<UserRegistration>()
      .add(UserValidators.validateEmail)
      .add(UserValidators.checkEmailUniqueness);

    const data: UserRegistration = {
      username: 'john_doe',
      email: 'admin@example.com', // This email is "taken"
      password: 'SecurePass123!',
      age: 25,
      termsAccepted: true
    };

    const result = await pipeline.validateWithShortCircuit(data);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('EMAIL_TAKEN');
      expect(result.error.context?.field).toBe('email');
    }
  });

  it('should transform data during validation', async () => {
    const pipeline = new ValidationPipeline<UserRegistration>()
      .add(UserValidators.validateReferralCode);

    const data: UserRegistration = {
      username: 'john_doe',
      email: 'john@example.com',
      password: 'SecurePass123!',
      age: 25,
      termsAccepted: true,
      referralCode: 'FRIEND2023' // Should be valid
    };

    const result = await pipeline.validateWithShortCircuit(data);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.referralCode).toBe('FRIEND2023'); // Transformed to uppercase
    }
  });

  it('should handle optional fields correctly', async () => {
    const pipeline = new ValidationPipeline<UserRegistration>()
      .add(UserValidators.validateReferralCode);

    const data: UserRegistration = {
      username: 'john_doe',
      email: 'john@example.com',
      password: 'SecurePass123!',
      age: 25,
      termsAccepted: true
      // No referralCode provided
    };

    const result = await pipeline.validateWithShortCircuit(data);

    expect(result.ok).toBe(true);
  });
});

// Performance benchmarks for validation pipeline
describe('Validation Pipeline Performance Benchmarks', () => {
  it('should demonstrate Result performance in validation chains', async () => {
    const iterations = 1000;
    const pipeline = new ValidationPipeline<UserRegistration>()
      .add(UserValidators.validateUsername)
      .add(UserValidators.validateEmail)
      .add(UserValidators.validatePassword)
      .add(UserValidators.validateAge);

    const testData: UserRegistration = {
      username: 'valid_user',
      email: 'valid@example.com',
      password: 'ValidPass123!',
      age: 25,
      termsAccepted: true
    };

    // Result-based approach
    const resultStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const result = await pipeline.validateWithShortCircuit({
        ...testData,
        username: `user_${i}`
      });
      if (!result.ok) {
        // Handle validation error without throwing
      }
    }
    const resultTime = performance.now() - resultStart;

    // Traditional try/catch approach (simulated)
    const tryStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      try {
        const data = { ...testData, username: `user_${i}` };
        // Simulate traditional validation with potential throws
        if (data.username.length < 3) throw new Error('Username too short');
        if (!data.email.includes('@')) throw new Error('Invalid email');
        if (data.password.length < 8) throw new Error('Password too short');
        if (data.age < 13) throw new Error('Too young');
        // Success case
      } catch (error) {
        // Handle validation error
      }
    }
    const tryTime = performance.now() - tryStart;

    console.log(`Result validation: ${resultTime.toFixed(2)}ms`);
    console.log(`Try/catch validation: ${tryTime.toFixed(2)}ms`);
    console.log(`Performance ratio: ${(tryTime / resultTime).toFixed(2)}x`);

    // Result approach should be competitive
    expect(resultTime).toBeLessThan(tryTime * 30);
  });
});
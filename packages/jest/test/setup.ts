import { expect } from 'vitest';
import { 
  toBeOk, 
  toBeOkWith, 
  toBeErr, 
  toBeErrWith, 
  toHaveErrorCode, 
  toHaveErrorMessage 
} from '../src/index.js';

// Register matchers with Vitest
expect.extend({
  toBeOk,
  toBeOkWith,
  toBeErr,
  toBeErrWith,
  toHaveErrorCode,
  toHaveErrorMessage,
});
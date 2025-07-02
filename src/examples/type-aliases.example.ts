/**
 * Examples showing how ZeroThrow type aliases reduce boilerplate
 */

import { ZTResult, ZTPromise, ztOk, ztErr, ztPromise } from '../index';

// Before: Verbose type signatures
function parseNumberVerbose(str: string): Result<number, ZeroError> {
  const num = parseInt(str, 10);
  if (isNaN(num)) {
    return err(new ZeroError('PARSE_ERROR', 'Invalid number'));
  }
  return ok(num);
}

// After: Clean type signatures with ZTResult
function parseNumber(str: string): ZTResult<number> {
  const num = parseInt(str, 10);
  if (isNaN(num)) {
    return ztErr('Invalid number');
  }
  return ztOk(num);
}

// Before: Verbose async signatures
async function fetchUserVerbose(id: string): Promise<Result<User, ZeroError>> {
  // ... implementation
}

// After: Clean async signatures with ZTPromise
async function fetchUser(id: string): ZTPromise<User> {
  // ... implementation
}

// Using ztPromise for chainable async operations
async function processUserData(userId: string): ZTPromise<ProcessedData> {
  return ztPromise(fetchUser(userId))
    .andThen(user => validateUser(user))
    .map(user => ({ ...user, processed: true }))
    .andThen(data => saveToDatabase(data))
    .mapErr(error => {
      console.error(`Failed to process user ${userId}:`, error);
      return error;
    });
}

// The enhanced promise type allows chaining without await
const pipeline = ztPromise(fetchUser('123'))
  .map(user => console.log(`Processing ${user.name}`))
  .andThen(user => updateLastSeen(user))
  .andThen(user => notifyFriends(user))
  .unwrapOr(null); // Returns Promise<User | null>
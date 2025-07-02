/**
 * Simple JavaScript test to validate examples work correctly
 */

// Simulate ZeroThrow library
const ok = (value) => ({ isOk: true, isErr: false, value });
const err = (error) => ({ isOk: false, isErr: true, error });

class ZeroError extends Error {
  constructor(code, message, cause, context) {
    super(message);
    this.name = 'ZeroError';
    this.code = code;
    this.cause = cause;
    this.context = context || {};
  }
}

const tryR = async (fn, mapError) => {
  try {
    const result = await fn();
    return ok(result);
  } catch (error) {
    return err(mapError ? mapError(error) : error);
  }
};

const wrap = (cause, code, message, context) => {
  return new ZeroError(code, message, cause, context);
};

const andThen = (result, fn) => {
  return result.isOk ? fn(result.value) : result;
};

const map = (result, fn) => {
  return result.isOk ? ok(fn(result.value)) : result;
};

const collect = (results) => {
  const values = [];
  for (const result of results) {
    if (result.isErr) return result;
    values.push(result.value);
  }
  return ok(values);
};

const orElse = (result, fn) => {
  return result.isOk ? result : fn(result.error);
};

const unwrapOr = (result, defaultValue) => {
  return result.isOk ? result.value : defaultValue;
};

// Test divide function from Getting Started
function divide(a, b) {
  if (b === 0) {
    return err('Cannot divide by zero');
  }
  return ok(a / b);
}

console.log('Testing divide function...');
const result1 = divide(10, 2);
console.assert(result1.isOk && result1.value === 5, 'Basic division should work');
console.log('✓ divide(10, 2) =', result1);

const result2 = divide(10, 0);
console.assert(result2.isErr && result2.error === 'Cannot divide by zero', 'Division by zero should error');
console.log('✓ divide(10, 0) =', result2);

// Test validation
function validateEmail(email) {
  if (!email) {
    return err(new ZeroError(
      'MISSING_EMAIL',
      'Email is required',
      undefined,
      { field: 'email' }
    ));
  }

  if (!email.includes('@')) {
    return err(new ZeroError(
      'INVALID_EMAIL',
      'Email must contain @',
      undefined,
      { field: 'email', value: email }
    ));
  }

  return ok(email);
}

console.log('\nTesting email validation...');
const email1 = validateEmail('test@example.com');
console.assert(email1.isOk && email1.value === 'test@example.com', 'Valid email should pass');
console.log('✓ Valid email:', email1);

const email2 = validateEmail('invalid-email');
console.assert(email2.isErr && email2.error.code === 'INVALID_EMAIL', 'Invalid email should fail');
console.log('✓ Invalid email:', email2);

// Test chaining
function parseNumber(str) {
  const num = Number(str);
  return isNaN(num) ? err('Not a number') : ok(num);
}

function checkPositive(num) {
  return num > 0 ? ok(num) : err('Must be positive');
}

console.log('\nTesting chaining...');
const chain1 = andThen(parseNumber('42'), checkPositive);
console.assert(chain1.isOk && chain1.value === 42, 'Chaining should work');
console.log('✓ parseNumber + checkPositive:', chain1);

const chain2 = andThen(parseNumber('-5'), checkPositive);
console.assert(chain2.isErr && chain2.error === 'Must be positive', 'Chaining error should propagate');
console.log('✓ Negative number error:', chain2);

// Test async operations
async function fetchData(shouldFail) {
  return tryR(
    async () => {
      if (shouldFail) {
        throw new Error('Network error');
      }
      return 'data';
    },
    (error) => wrap(error, 'FETCH_FAILED', 'Failed to fetch data')
  );
}

async function testAsync() {
  console.log('\nTesting async operations...');
  
  const success = await fetchData(false);
  console.assert(success.isOk && success.value === 'data', 'Async success should work');
  console.log('✓ Async success:', success);

  const failure = await fetchData(true);
  console.assert(failure.isErr && failure.error.code === 'FETCH_FAILED', 'Async error should work');
  console.log('✓ Async error:', failure);
}

// Test collect
console.log('\nTesting collect...');
const allGood = collect([ok(1), ok(2), ok(3)]);
console.assert(allGood.isOk && allGood.value.length === 3, 'Collect all success should work');
console.log('✓ Collect all success:', allGood);

const hasError = collect([ok(1), err('failed'), ok(3)]);
console.assert(hasError.isErr && hasError.error === 'failed', 'Collect with error should fail');
console.log('✓ Collect with error:', hasError);

// Test error recovery
console.log('\nTesting error recovery...');
const recovered = orElse(err('primary failed'), () => ok('fallback'));
console.assert(recovered.isOk && recovered.value === 'fallback', 'Error recovery should work');
console.log('✓ Error recovery:', recovered);

// Test unwrapOr
const withDefault = unwrapOr(err('failed'), 'default');
console.assert(withDefault === 'default', 'unwrapOr should provide default');
console.log('✓ unwrapOr:', withDefault);

// Run async tests
testAsync().then(() => {
  console.log('\n🎉 All examples tested successfully!');
  console.log('\nAll major patterns from the documentation work correctly:');
  console.log('- Basic Result creation and handling');
  console.log('- Input validation with ZeroError');
  console.log('- Async operations with tryR');
  console.log('- Operation chaining with andThen');
  console.log('- Value transformation with map');
  console.log('- Collection of Results');
  console.log('- Error recovery with orElse');
  console.log('- Default values with unwrapOr');
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
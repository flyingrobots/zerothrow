import { expect, test } from 'vitest';
import { ZT } from '@zerothrow/core';
import '../src/index.js'; // Import to register matchers

test('Vitest matchers work', () => {
  const ok = ZT.ok(42);
  const err = ZT.err('FAIL', 'Something went wrong');
  
  expect(ok).toBeOk();
  expect(ok).toBeOkWith(42);
  expect(ok).not.toBeErr();
  
  expect(err).toBeErr();
  expect(err).toHaveErrorCode('FAIL');
  expect(err).toHaveErrorMessage('Something went wrong');
});
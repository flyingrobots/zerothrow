# @zerothrow/vitest

Vitest matchers for ZeroThrow Result types.

## Installation

```bash
npm install --save-dev @zerothrow/vitest @zerothrow/core
```

## Usage

Import the package in your test setup file or at the top of your test files:

```typescript
import '@zerothrow/vitest';
```

Or manually setup in your Vitest config:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { setup } from '@zerothrow/vitest';

export default defineConfig({
  test: {
    setupFiles: ['./test-setup.ts']
  }
});

// test-setup.ts
import { setup } from '@zerothrow/vitest';
setup();
```

## Available Matchers

```typescript
import { expect } from 'vitest';
import { ZT } from '@zerothrow/core';

const ok = ZT.ok(42);
const err = ZT.err('FAIL', 'Something went wrong');

// Result state matchers
expect(ok).toBeOk();
expect(err).toBeErr();

// Result value matchers  
expect(ok).toBeOkWith(42);
expect(err).toBeErrWith({ code: 'FAIL', message: 'Something went wrong' });

// Error property matchers
expect(err).toHaveErrorCode('FAIL');
expect(err).toHaveErrorMessage('Something went wrong');
expect(err).toHaveErrorMessage(/went wrong/);

// Negation
expect(ok).not.toBeErr();
expect(err).not.toBeOk();
```

## License

MIT
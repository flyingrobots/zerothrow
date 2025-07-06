# {{packageName}}

![[../../shared/mental-model.md]]

![[../../shared/ecosystem-link.md]]

![[../../shared/badges.md]]

<div align="center">
<img src="https://raw.githubusercontent.com/flyingrobots/image-dump/refs/heads/main/optimized/marketing/brand/{{mascotImage}}" height="300" />
</div>

Jest matchers for ZeroThrow Result types - elegant error handling assertions for your tests.

## Installation

```bash
npm install {{packageName}} @zerothrow/core @zerothrow/expect
# or: pnpm add {{packageName}} @zerothrow/core @zerothrow/expect
```

> **Note:** `@zerothrow/core` and `@zerothrow/expect` are peer dependencies.

## Quick Start

The matchers are automatically registered when you import the package. Simply import it in your test setup file or at the top of your test files:

```typescript
import '{{packageName}}';
import { ZT } from '@zerothrow/core';

describe('My Service', () => {
  it('should handle success', () => {
    const result = ZT.ok(42);
    expect(result).toBeOk();
    expect(result).toBeOkWith(42);
  });

  it('should handle errors', () => {
    const result = ZT.err('VALIDATION_ERROR', 'Invalid input');
    expect(result).toBeErr();
    expect(result).toHaveErrorCode('VALIDATION_ERROR');
    expect(result).toHaveErrorMessage('Invalid input');
  });
});
```

![[jest-specific-content.md]]

![[../../shared/contributing.md]]

![[../../shared/license.md]]
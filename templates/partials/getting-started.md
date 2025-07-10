### Quick Start

1. **Install the core package:**
   ```bash
   npm install @zerothrow/core
   ```

2. **Start using Result types:**
   ```typescript
   import { ZT } from '@zerothrow/core';
   
   const result = ZT.try(() => JSON.parse(userInput));
   
   result.match({
     ok: data => console.log('Parsed:', data),
     err: error => console.error('Failed:', error.message)
   });
   ```

3. **Add test matchers (optional):**
   ```bash
   npm install -D @zerothrow/jest  # or @zerothrow/vitest
   ```

4. **Add resilience patterns (optional):**
   ```bash
   npm install @zerothrow/resilience
   ```
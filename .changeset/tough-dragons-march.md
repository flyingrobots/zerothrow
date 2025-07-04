---
"@zerothrow/jest": minor
---

Add @zerothrow/jest package with Result-friendly matchers

New matchers for testing Result types without throwing:
- `toBeOk()` - Assert Result is Ok
- `toBeOkWith(value)` - Assert Result is Ok with specific value  
- `toBeErr()` - Assert Result is Err
- `toBeErrWith(error)` - Assert Result is Err with specific error/properties
- `toHaveErrorCode(code)` - Assert error has specific code
- `toHaveErrorMessage(message)` - Assert error has specific message (string or regex)

Works with both Jest and Vitest test runners.
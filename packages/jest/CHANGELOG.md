# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1-alpha] - 2025-01-04

### Added

- Initial alpha release of @zerothrow/jest
- `toBeOk()` - Assert Result is Ok
- `toBeOkWith(value)` - Assert Result is Ok with specific value
- `toBeErr()` - Assert Result is Err
- `toBeErrWith(error)` - Assert Result is Err with specific error/properties
- `toHaveErrorCode(code)` - Assert error has specific code
- `toHaveErrorMessage(message)` - Assert error has specific message (string or regex)
- Auto-registration when imported
- Full TypeScript support
- Comprehensive test suite

### Notes

This package addresses feedback from alpha users about test helpers defaulting to throw. These matchers provide a Result-friendly testing experience without throwing.
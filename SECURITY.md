# Security Policy

## Reporting Security Vulnerabilities

We take security seriously at ZeroThrow. If you discover a security vulnerability, please follow these steps:

1. **DO NOT** create a public GitHub issue
2. Email security details to: james@zerothrow.dev
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We'll acknowledge receipt within 48 hours and provide a detailed response within 5 business days.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.0.x   | :white_check_mark: |

## Security Best Practices

When using ZeroThrow:
- Always validate error codes and messages before exposing to end users
- Never include sensitive data in error contexts
- Use environment-specific error messages in production
- Sanitize error outputs in logs

Thank you for helping keep ZeroThrow secure!
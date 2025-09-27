# Security Guidelines

This document outlines security best practices for the VibeCode project.

## Code Security

- Use environment variables for sensitive configuration
- Validate all user inputs
- Use HTTPS in production
- Implement proper authentication and authorization

## API Security

- Use rate limiting for API endpoints
- Validate and sanitize all input data  
- Implement proper error handling without exposing sensitive information
- Use CORS appropriately

## Database Security

- Use prepared statements to prevent SQL injection
- Implement proper database access controls
- Encrypt sensitive data at rest
- Regular security audits

## Dependency Management

- Regularly audit dependencies: `npm audit`
- Keep dependencies updated: `npm run deps:check`
- Review dependency licenses: See [LICENSE](./LICENSE)

## Reporting Security Issues

Please report security vulnerabilities by following our [Security Policy](./SECURITY.md).
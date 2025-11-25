# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please send an email to security@pope-of-culture.com or create a private security advisory on GitHub.

**Please do not report security vulnerabilities through public GitHub issues.**

### What to Include

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if any)

### What to Expect

- We will acknowledge your email within 48 hours
- We will provide a detailed response within 7 days
- We will work on a fix and coordinate disclosure
- You will be credited for the discovery (unless you prefer to remain anonymous)

## Security Best Practices

When using this project:

1. **Environment Variables**: Never commit `.env` files with real credentials
2. **API Keys**: Keep your API keys secure and rotate them regularly
3. **Dependencies**: Regularly update dependencies to patch known vulnerabilities
4. **Data**: Be cautious with user data and follow GDPR/privacy regulations
5. **Authentication**: Implement proper authentication if deploying publicly

## Known Security Considerations

- This project uses external APIs (Google Gemini) - ensure API keys are properly secured
- Dataset files may contain sensitive information - review before committing
- The application is intended for educational/personal use - additional security measures needed for production

Thank you for helping keep Pope of Culture secure! 🔒

# Contributing to Pope of Culture

Thank you for your interest in contributing to Pope of Culture! We welcome contributions from the community.

## 🤝 How to Contribute

### Reporting Bugs

If you find a bug, please create an issue on GitHub with:
- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Screenshots (if applicable)
- Your environment (OS, browser, Python/Node versions)

### Suggesting Enhancements

We love new ideas! To suggest an enhancement:
- Check if the feature has already been requested
- Create an issue with a clear description
- Explain why this feature would be useful
- Provide examples of how it would work

### Pull Requests

1. **Fork the repository** and create your branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes:**
   - Write clear, concise commit messages
   - Follow the existing code style
   - Add comments where necessary
   - Update documentation as needed

3. **Test your changes:**
   - Ensure all existing tests pass
   - Add new tests for new features
   - Test the application thoroughly

4. **Submit a pull request:**
   - Provide a clear description of the changes
   - Reference any related issues
   - Wait for review and address feedback

## 💻 Development Setup

### Frontend Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run linting
npm run lint

# Build for production
npm run build
```

### Backend Development

```bash
# Create virtual environment
python -m venv rec_env
rec_env\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run backend server
python backend_api.py
```

## 📝 Code Style

### TypeScript/JavaScript
- Use TypeScript for all new files
- Follow ESLint configuration
- Use functional components and hooks
- Keep components small and focused
- Use meaningful variable and function names

### Python
- Follow PEP 8 style guide
- Use type hints where applicable
- Write docstrings for functions and classes
- Keep functions small and focused

### Commits
- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit first line to 72 characters
- Reference issues and pull requests

Example:
```
Add sentiment analysis caching

- Implement Redis caching for API responses
- Add cache invalidation logic
- Update documentation

Fixes #123
```

## 🧪 Testing

- Write unit tests for new features
- Ensure all tests pass before submitting PR
- Aim for good test coverage
- Test edge cases and error handling

## 📚 Documentation

- Update README.md for new features
- Add JSDoc/docstrings for functions
- Update API documentation
- Include examples where helpful

## 🔍 Code Review Process

1. Maintainers review pull requests
2. Address feedback and make changes
3. Once approved, maintainer will merge
4. Your contribution will be credited

## ⚖️ License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 💬 Questions?

Feel free to ask questions by:
- Creating an issue
- Reaching out to maintainers
- Joining discussions

## 🌟 Recognition

Contributors will be recognized in:
- Project README
- Release notes
- Contributors page

Thank you for helping make Pope of Culture better! 🎬

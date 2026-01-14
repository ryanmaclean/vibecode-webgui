# Quick Start Guide for Contributors

Welcome to the VibeCode community! This guide will get you started contributing in just a few minutes.

## Before You Start (2 minutes)

### Required Reading

- [Code of Conduct](CODE_OF_CONDUCT.md) - Be respectful and inclusive
- [Contributing Guidelines](CONTRIBUTING.md) - Full contribution process
- [License](LICENSE) - MIT License (very permissive)

### One-Time Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/vibecode-vm.git
cd vibecode-vm

# Install prerequisites (if needed)
brew install vfkit git

# Verify setup
vfkit --version  # Should show version
git --version    # Should show version
```

## Find Something to Work On (5 minutes)

### Good First Issues

Look for issues labeled:
- `good first issue` - Perfect for getting started
- `help wanted` - Community help requested
- `documentation` - Docs updates (easiest to get started)

**Find issues**: [GitHub Issues](https://github.com/yourusername/vibecode-vm/issues?q=label:%22good+first+issue%22)

### Types of Contributions

Not a coder? No problem! We need help with:

- **Documentation**: Fix typos, clarify guides, add examples
- **Testing**: Try features, report bugs, verify fixes
- **Design**: UI/UX improvements, diagrams, icons
- **Community**: Help others, answer questions, share ideas

## Make Your First Contribution (30 minutes)

### Option 1: Documentation Fix (Easiest)

```bash
# 1. Find a typo or unclear section in the docs
# 2. Edit the markdown file
vi README.md  # or any .md file

# 3. Create a branch
git checkout -b fix/docs-clarification

# 4. Commit your changes
git add README.md
git commit -m "docs: clarify installation steps"

# 5. Push and open a PR
git push origin fix/docs-clarification
# Then go to GitHub and click "Create Pull Request"
```

### Option 2: Bug Report (Also Very Helpful!)

```bash
# 1. Find a bug or unexpected behavior
# 2. Try to reproduce it reliably
# 3. Open an issue at: https://github.com/yourusername/vibecode-vm/issues
# 4. Use the bug report template
# 5. Include steps to reproduce and expected behavior
```

### Option 3: Code Contribution

```bash
# 1. Find a good first issue or feature to work on
# 2. Comment on the issue: "I'd like to work on this!"
# 3. Discuss your approach with maintainers

# 4. Create a feature branch
git checkout -b feature/your-feature-name

# 5. Make your changes following the coding standards
# 6. Test thoroughly
# 7. Commit with conventional commits
git commit -m "feat: add new feature"

# 8. Push and create PR
git push origin feature/your-feature-name
```

## Development Setup (10 minutes)

### Quick Environment Setup

```bash
# Install development tools
brew install coreutils gnu-sed curl wget python3

# Optional but recommended
brew install git-flow fzf

# Set environment variables
export VIBECODE_DEV=1
```

### Build and Test

```bash
# Navigate to build directory
cd azure

# Build the VM
./build-unified-services-with-datadog.sh
# Takes 15-30 minutes on first build

# Start the VM
vibecode-vm start

# Test basic functionality
vibecode-vm status
vibecode-vm ssh
```

## Pull Request Workflow (15 minutes)

### Creating a Good PR

1. **One Thing Per PR**: Focus on a single issue or feature
2. **Descriptive Title**: `feat: add feature` or `fix: resolve issue`
3. **Use the Template**: PR template guides you through what to include
4. **Link Issues**: Reference related issues with `Fixes #123`
5. **Test**: Show that your changes work

### Example PR Description

```markdown
## Description
Fixes #123 by improving the documentation for volume mounting.

## Changes Made
- Clarified steps for setting up shared directories
- Added example commands for common scenarios
- Fixed typo in configuration section

## Testing
- Tested volume mounting with my own setup
- Verified examples work as documented

## Checklist
- [x] My code follows style guidelines
- [x] I have updated documentation
- [x] Tests pass (if applicable)
```

### Review Process

1. **Maintainer Review**: Someone will review your PR within a few days
2. **Feedback**: You might get suggestions or questions
3. **Iterate**: Make requested changes
4. **Approval**: Once approved, a maintainer will merge it
5. **Recognition**: You'll be credited in release notes!

## Common Workflows

### Documentation Update

```bash
# 1. Edit markdown files
vim docs/troubleshooting.md

# 2. Commit
git commit -m "docs: add troubleshooting section for X"

# 3. Push and create PR
git push origin fix/docs-troubleshooting
```

### Bug Fix

```bash
# 1. Find the bug and understand it
# 2. Write a test that fails (demonstrates the bug)
# 3. Fix the bug (test should pass now)
# 4. Commit
git commit -m "fix: resolve networking issue on startup"

# 5. Push and create PR
git push origin fix/networking-issue
```

### Feature Implementation

```bash
# 1. Discuss the feature in an issue first
# 2. Get maintainer approval on approach
# 3. Implement with tests
# 4. Update documentation
# 5. Create PR
git push origin feature/new-feature
```

## Tips for Success

### Writing Good Commit Messages

Use the Conventional Commits format:

```
<type>: <subject>

<body (optional)>

<footer (optional)>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

Good examples:
- `feat: add volume mounting support`
- `fix: resolve DHCP timeout issue`
- `docs: clarify SSH setup process`
- `test: add integration tests for PostgreSQL`

### Testing Your Changes

Before submitting:

```bash
# For code changes
./test-*.sh              # Run relevant tests
vibecode-vm start        # Manual testing

# For documentation
# Read through and check for clarity
# Test any code examples included

# For UI changes
# Take screenshots/videos
# Include in your PR
```

### Communication

1. **Be Respectful**: Everyone deserves respect and kindness
2. **Be Clear**: Explain your reasoning and ask questions
3. **Be Responsive**: Reply to feedback within a few days
4. **Be Patient**: Maintainers volunteer their time

## Getting Help

### Stuck or Have Questions?

1. **Search Existing Issues**: Your question might already be answered
2. **Check Documentation**: [DEVELOPMENT.md](DEVELOPMENT.md) has detailed info
3. **Ask in Discussions**: [GitHub Discussions](https://github.com/yourusername/vibecode-vm/discussions)
4. **Comment on Issue**: Ask for clarification on the issue you're working on

### Common Questions

**Q: I found a bug, what should I do?**
A: Open a bug report issue with the template. Include reproduction steps!

**Q: Can I work on this issue?**
A: Comment on the issue first. This avoids duplicate work.

**Q: My PR was rejected, what now?**
A: Don't worry! Feedback helps improve the project. Discuss in comments and iterate.

**Q: How long until my PR is reviewed?**
A: Usually within 3-7 days depending on maintainer availability.

## After Your First Contribution

### What Happens Next?

1. **Merged PR**: Your code is now part of VibeCode! 🎉
2. **Recognition**: Listed in release notes and contributors
3. **Community**: You're now part of the VibeCode community
4. **More Opportunities**: Find your next contribution to work on

### Become a Regular Contributor

As you contribute more:

1. Gain familiarity with the codebase
2. Help review other PRs
3. Mentor new contributors
4. Take on larger features
5. Potentially become a maintainer

## Standards & Expectations

### Code Quality

- Follow coding standards (see [DEVELOPMENT.md](DEVELOPMENT.md))
- Write clear, maintainable code
- Include comments for complex logic
- Add tests for new features

### Documentation

- Update docs with code changes
- Include examples where helpful
- Use clear, inclusive language
- Keep docs in sync with code

### Communication

- Be respectful and professional
- Assume good intent
- Provide constructive feedback
- Respect others' time

## Next Steps

1. **Pick an Issue**: Find something to work on
2. **Set Up Dev Environment**: Follow the setup guide above
3. **Create a Branch**: `git checkout -b fix/your-fix`
4. **Make Changes**: Write code, update docs, add tests
5. **Test Thoroughly**: Ensure nothing breaks
6. **Create a PR**: Submit your changes
7. **Respond to Feedback**: Engage with reviewers
8. **Celebrate**: Your contribution is merged!

## Resources

- [Contributing Guidelines](CONTRIBUTING.md) - Full process
- [Development Guide](DEVELOPMENT.md) - Technical details
- [Code of Conduct](CODE_OF_CONDUCT.md) - Community standards
- [Roadmap](ROADMAP.md) - What's planned
- [GitHub Issues](https://github.com/yourusername/vibecode-vm/issues) - Find work
- [GitHub Discussions](https://github.com/yourusername/vibecode-vm/discussions) - Ask questions

## Final Words

Thank you for considering contributing to VibeCode! Every contribution - no matter how small - helps make this project better. We appreciate your time, effort, and enthusiasm!

If you have any questions or need help, please don't hesitate to ask. We're here to help you succeed.

**Welcome to the VibeCode community!** 🚀

---

**Last Updated**: January 14, 2025

For more detailed information, see [CONTRIBUTING.md](CONTRIBUTING.md)

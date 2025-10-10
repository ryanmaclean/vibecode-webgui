# Contributing to VibeCode Platform

Thanks for your interest in contributing! This project demonstrates **pgvector + PostgreSQL + Kubernetes + Datadog DBM** monitoring.

## Quick Start for Contributors

New to the project? Start here:

1. **Read the Developer Guide**: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - Comprehensive guide for getting started
2. **Try the demo first**: `./DEMO.sh`
3. **Fork and clone** the repository
4. **Set up your environment**: `npm install && npm run setup`
5. **Run tests**: `npm test`
6. **Make your changes**
7. **Test the demo still works**: `./DEMO.sh`

## Coordinate Before You Ship

- **Read [`TODO.md`](./TODO.md)** to see which work areas are already claimed and follow the live coordination protocol.
- **Scan [`docs/logs/`](./docs/logs/)** for the latest activity, decision, and friction logs so you don't redo or conflict with recent work.
- If you're planning large file moves or automation changes, document your intent in `TODO.md` first so other agents can adjust.

## 🎯 What We're Looking For

### High-Priority Contributions
- **More vector database examples** (Qdrant, Weaviate, etc.)
- **Additional monitoring integrations** (Prometheus, Grafana)
- **Performance optimizations** for vector searches
- **Documentation improvements** (especially troubleshooting)
- **Accessibility enhancements** (WCAG compliance, keyboard navigation)
- **Test coverage improvements** (especially E2E tests)

### Demo Improvements
- **Better sample data** for vector demonstrations
- **More realistic query patterns**
- **Additional Datadog dashboard examples**
- **Cross-platform compatibility** fixes

## Development Setup

### Prerequisites

- Node.js 18.18.0 to 24.x
- npm 9.0.0+
- PostgreSQL 16+ with pgvector
- Docker (optional, for containerized development)

### Initial Setup

```bash
# 1. Clone and setup
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your configuration

# 3. Run setup script
npm run setup

# 4. Start local development
npm run dev

# 5. Test the demo
./DEMO.sh

# 6. Run tests
npm test
```

## 🗂️ Script Conventions

- **Use shared helpers**: new or updated shell scripts should source `scripts/lib/bootstrap.sh` and `scripts/lib/logging.sh` so logging stays consistent (`log_info`, `log_success`, `log_warn`, etc.).
- **Maintenance utilities**: housekeeping helpers now live under `scripts/util/` (for example `scripts/util/cleanup-root.sh`, `scripts/util/optimize-github-actions.sh`). Reference these paths instead of the old root-level scripts in docs or issues.
- **Temporary files**: prefer `mktemp` with trap-based cleanup when generating config or secret manifests inside scripts; see `scripts/setup-postgres-datadog-monitoring.sh` for an example pattern.

For detailed setup instructions, see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## 📋 Contribution Guidelines

## Development Workflow

### Branch Strategy

Always work on feature branches:

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

**Never work directly on main/master**

### Making Changes

1. **Create feature branch**: `git checkout -b feature/amazing-feature`
2. **Make changes** and add tests
3. **Run quality checks**:
   ```bash
   npm run check      # Lint + type-check
   npm run test:unit  # Fast unit tests
   npm run test       # All tests
   ```
4. **Test demo works**: `./DEMO.sh`
5. **Commit with conventional commits**:
   ```bash
   git commit -m "feat: add amazing feature"
   ```
6. **Push branch**: `git push origin feature/amazing-feature`
7. **Create Pull Request**

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add support for Qdrant vector database
fix: resolve Datadog connection timeout
docs: update troubleshooting guide
test: add tests for vector search
refactor: simplify authentication logic
perf: optimize vector query performance
chore: update dependencies
```

## Contribution Guidelines

### Code Style

- **TypeScript** for new code (not JavaScript)
- **ESLint** configuration provided - must pass
- **Prettier** for formatting
- **Clear variable names** and comments for complex logic
- **Follow existing patterns** in the codebase

### Testing Requirements

All contributions must include appropriate tests:

- **Unit tests** for new functions/utilities (`tests/unit/`)
- **Integration tests** for API routes and services (`tests/integration/`)
- **E2E tests** for new user flows (`tests/e2e/`)
- **Accessibility tests** for UI components

Run tests before submitting:

```bash
npm run test           # All tests
npm run test:unit      # Unit tests only (fast)
npm run test:e2e       # E2E tests (requires running server)
npm run test:scripts   # Shell script tests (Bats)
```

### Documentation Requirements

- **Update relevant docs** with code changes
- **Add JSDoc comments** for public APIs
- **Document breaking changes** clearly
- **Update CHANGELOG** for significant changes
- **Don't create unnecessary documentation files** - edit existing ones

### Accessibility Requirements

- **Follow WCAG 2.1 AA standards**
- **Test with keyboard navigation**
- **Include ARIA labels** where appropriate
- **Run accessibility tests**: `npm run test:e2e` (includes axe-core checks)
- **Test with screen readers** for UI changes

## Pull Request Process

### Before Submitting

- [ ] Demo still works (`./DEMO.sh`)
- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Documentation updated
- [ ] No sensitive data (API keys, passwords) in commits
- [ ] Branch is up to date with main
- [ ] Commits follow conventional commit format

### PR Template

Use this template when creating your PR:

```markdown
## Summary
Brief description of changes

## Motivation
Why is this change needed? Link to related issues.

## Changes
- Bullet list of key changes
- What was added/modified/removed

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated (if applicable)
- [ ] Manual testing performed
- [ ] Demo tested and working

## Breaking Changes
List any breaking changes and migration steps

## Screenshots (if applicable)
Add screenshots for UI changes

## Related Issues
Closes #123
Related to #456
```

### Review Process

1. **Automated checks** run on PR creation (lint, type-check, tests)
2. **Reviewer assigned** (usually within 1 business day)
3. **Address feedback** through discussion and commits
4. **Approval** from at least one maintainer required
5. **Merge** to main branch

### Review Criteria

Reviewers will check:

- Code quality and style
- Test coverage and quality
- Documentation completeness
- Breaking change handling
- Security considerations
- Performance implications
- Accessibility compliance

## Bug Reports

When reporting bugs, please include:

1. **Environment details** (OS, Node version, Kubernetes version, etc.)
2. **Steps to reproduce** the issue
3. **Expected vs actual behavior**
4. **Demo output** (if applicable)
5. **Relevant logs** and error messages
6. **Screenshots** (if applicable)

Use our [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).

## Feature Requests

We welcome suggestions for:

- **New vector database integrations**
- **Additional monitoring tools**
- **Performance improvements**
- **Documentation enhancements**
- **Developer experience improvements**

Use our [feature request template](.github/ISSUE_TEMPLATE/feature_request.md).

## Specific Areas for Contribution

### 1. Vector Database Support

Help us support more vector databases:

- Add support for Qdrant, Weaviate, Pinecone
- Improve pgvector performance
- Add more embedding models (Cohere, Voyage AI)
- Benchmark different vector search strategies

**Files to explore**: `src/lib/services/vector-search.ts`

### 2. Monitoring Enhancements

Improve observability:

- Custom Datadog dashboards
- Additional metrics collection
- Performance alerting rules
- APM trace customization

**Files to explore**: `src/instrument.ts`, `src/app/api/monitoring/`

### 3. Demo Improvements

Make the demo more impressive:

- Better TUI interface
- More realistic data generation
- Cross-platform compatibility fixes
- Interactive tutorials

**Files to explore**: `DEMO.sh`, `scripts/`

### 4. Documentation

Help others learn:

- Troubleshooting guides
- Performance tuning tips
- Integration examples
- Video tutorials

**Files to explore**: `docs/`

### 5. Testing

Improve test coverage:

- Add E2E tests for critical flows
- Improve integration test coverage
- Add performance benchmarks
- Enhance accessibility tests

**Files to explore**: `tests/`

## Code Review Guidelines

### For Contributors

- **Be responsive** to review feedback
- **Ask questions** if feedback is unclear
- **Don't take it personally** - reviews improve code quality
- **Learn from feedback** for future contributions

### For Reviewers

- **Be constructive** and kind
- **Explain the "why"** behind suggestions
- **Acknowledge good work**
- **Focus on code, not person**
- **Be timely** with reviews

## Recognition

Contributors will be:

- **Listed in README** acknowledgments
- **Tagged in release notes** for their contributions
- **Invited to maintainer discussions** (for significant contributions)
- **Given credit** in commit messages and documentation

## Development Resources

- **Developer Guide**: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - Start here!
- **Testing Strategy**: [docs/TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md)
- **Architecture**: [README.md](README.md#architecture)
- **API Documentation**: [README.md](README.md#api-endpoints)
- **Deployment Guide**: [docs/DOCKER_DEPLOYMENT.md](docs/DOCKER_DEPLOYMENT.md)

## Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and ideas
- **Demo Help**: Run `./DEMO.sh` and choose "Help & Troubleshooting"
- **Developer Guide**: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - Troubleshooting section

## Code of Conduct

### Our Standards

- **Be respectful** and inclusive
- **Welcome newcomers** and help them learn
- **Give constructive feedback**
- **Accept constructive criticism**
- **Focus on what's best** for the community

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or inflammatory comments
- Personal attacks
- Publishing others' private information
- Unethical or unprofessional conduct

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

**Ready to contribute? Start with [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed setup instructions!**

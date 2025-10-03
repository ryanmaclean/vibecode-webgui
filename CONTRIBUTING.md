# Contributing to VibeCode Platform

Thanks for your interest in contributing! This project demonstrates **pgvector + PostgreSQL + Kubernetes + Datadog DBM** monitoring.

## 🚀 Quick Start for Contributors

1. **Try the demo first**: `./DEMO.sh`
2. **Fork and clone** the repository
3. **Run tests**: `npm test`
4. **Make your changes**
5. **Test the demo still works**: `./DEMO.sh`

## 🎯 What We're Looking For

### High-Priority Contributions
- **More vector database examples** (Qdrant, Weaviate, etc.)
- **Additional monitoring integrations** (Prometheus, Grafana)
- **Performance optimizations** for vector searches
- **Documentation improvements** (especially troubleshooting)

### Demo Improvements
- **Better sample data** for vector demonstrations
- **More realistic query patterns** 
- **Additional Datadog dashboard examples**
- **Cross-platform compatibility** fixes

## 🔧 Development Setup

```bash
# 1. Clone and setup
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui
npm install

# 2. Start local development
npm run dev

# 3. Test the demo
./DEMO.sh

# 4. Run tests
npm test
```

## 🗂️ Script Conventions

- **Use shared helpers**: new or updated shell scripts should source `scripts/lib/bootstrap.sh` and `scripts/lib/logging.sh` so logging stays consistent (`log_info`, `log_success`, `log_warn`, etc.).
- **Maintenance utilities**: housekeeping helpers now live under `scripts/util/` (for example `scripts/util/cleanup-root.sh`, `scripts/util/optimize-github-actions.sh`). Reference these paths instead of the old root-level scripts in docs or issues.
- **Temporary files**: prefer `mktemp` with trap-based cleanup when generating config or secret manifests inside scripts; see `scripts/setup-postgres-datadog-monitoring.sh` for an example pattern.

## 📋 Contribution Guidelines

### Code Style
- **TypeScript** for new code
- **ESLint** configuration provided
- **Prettier** for formatting
- **Clear variable names** and comments

### Testing Requirements
- **Add tests** for new features
- **Ensure demo works** after changes
- **Test on multiple platforms** if possible
- **Document breaking changes**

### Commit Messages
```
feat: add support for Qdrant vector database
fix: resolve Datadog connection timeout
docs: update troubleshooting guide
demo: improve vector activity generation
```

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Steps to reproduce**
2. **Expected vs actual behavior**
3. **Environment details** (OS, Kubernetes version, etc.)
4. **Demo output** (if applicable)
5. **Relevant logs**

Use our [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).

## 💡 Feature Requests

We welcome suggestions for:
- **New vector database integrations**
- **Additional monitoring tools**
- **Performance improvements**
- **Documentation enhancements**

Use our [feature request template](.github/ISSUE_TEMPLATE/feature_request.md).

## 🔍 Code Review Process

1. **Fork** the repository
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes** and add tests
4. **Test demo works**: `./DEMO.sh`
5. **Push branch**: `git push origin feature/amazing-feature`
6. **Create Pull Request**

### PR Requirements
- [ ] Demo still works (`./DEMO.sh`)
- [ ] Tests pass (`npm test`)
- [ ] Documentation updated
- [ ] Clear description of changes
- [ ] Related issue linked (if applicable)

## 🎯 Specific Areas for Contribution

### 1. Vector Database Support
- Add support for other vector databases
- Improve pgvector performance
- Add more embedding models

### 2. Monitoring Enhancements
- Custom Datadog dashboards
- Additional metrics collection
- Performance alerting rules

### 3. Demo Improvements
- Better TUI interface
- More realistic data
- Cross-platform compatibility

### 4. Documentation
- Troubleshooting guides
- Performance tuning tips
- Integration examples

## 🏆 Recognition

Contributors will be:
- **Listed in README** acknowledgments
- **Tagged in release notes**
- **Invited to maintainer discussions** (for significant contributions)

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and ideas
- **Demo Issues**: Run `./DEMO.sh` and choose "Help & Troubleshooting"

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

**Ready to contribute? Start with `./DEMO.sh` to understand what we're building!** 🚀

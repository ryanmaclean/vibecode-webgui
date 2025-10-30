# Repository Rules

## License

**VibeCode is licensed under MIT License.**

All contributions to this repository will be licensed under MIT. By contributing, you agree to license your work under this license.

**Acceptable Licenses**: MIT, BSD (2-Clause, 3-Clause), Apache 2.0

**Prohibited Licenses**: GPL (any version), LGPL, AGPL, or any copyleft license

## Scripting Policy

### ✅ Python Only for Scripts

**All automation scripts, build scripts, and utilities MUST be written in Python 3.8+.**

**Bash/Shell scripts are NOT permitted** to maintain license compatibility with MIT/BSD/Apache ecosystems.

### Rationale

1. **License Compliance**: Bash/Shell scripts may introduce GPL dependencies. Python maintains MIT/BSD/Apache compatibility.
2. **Cross-Platform**: Python scripts work consistently across macOS, Linux, and Windows.
3. **Maintainability**: Python code is easier to test, debug, and maintain than shell scripts.
4. **Type Safety**: Python with type hints provides better code quality and IDE support.
5. **Ecosystem**: Rich standard library and package ecosystem for complex operations.

### Script Requirements

All scripts in the `scripts/` directory must:

- ✅ Use Python 3.8+ (check shebang: `#!/usr/bin/env python3`)
- ✅ Include type hints for functions
- ✅ Include docstrings for modules and functions
- ✅ Follow PEP 8 style guidelines
- ✅ Include MIT license header
- ✅ Use standard library when possible (minimize dependencies)
- ✅ Include error handling and logging
- ✅ Be cross-platform compatible
- ✅ Only use MIT/BSD/Apache licensed dependencies

### Example Python Script Template

```python
#!/usr/bin/env python3
"""
Script Name: example_script.py
Description: Brief description of what this script does

Copyright (c) 2025 VibeCode Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""

import sys
import logging
from pathlib import Path
from typing import Optional

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def main() -> int:
    """Main entry point for the script."""
    try:
        logger.info("Starting script...")
        # Your code here
        logger.info("✅ Script completed successfully")
        return 0
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
```

### Migration of Existing Bash Scripts

**Action Required**: All existing `.sh` scripts in `scripts/` must be migrated to Python.

Priority for migration:
1. **Critical Build Scripts**: VM build scripts, deployment scripts
2. **CI/CD Scripts**: GitHub Actions scripts
3. **Development Tools**: Testing, linting, setup scripts
4. **Documentation Generators**: Report generation, logging scripts

### Exceptions

The following are NOT subject to this rule:
- **Package manager scripts**: `package.json` scripts (npm/yarn)
- **Makefile recipes**: Standard Makefile syntax
- **Docker ENTRYPOINT/CMD**: Minimal container startup commands
- **Git hooks**: Simple pre-commit/pre-push hooks (prefer Python when complex)
- **CI/CD platform syntax**: GitHub Actions YAML, GitLab CI syntax

### Code Review Requirements

Pull requests containing new scripts will be rejected if they:
- ❌ Use Bash/Shell instead of Python
- ❌ Lack MIT license headers
- ❌ Include GPL/LGPL/AGPL dependencies
- ❌ Don't include type hints
- ❌ Don't follow PEP 8 style guidelines
- ❌ Lack proper error handling

### Tools and Linting

Required tools for Python scripts:
- **Black**: Code formatting (`black scripts/`)
- **Pylint**: Linting (`pylint scripts/`)
- **MyPy**: Type checking (`mypy scripts/`)
- **isort**: Import sorting (`isort scripts/`)

### Testing Python Scripts

All Python scripts should include:
- Unit tests in `tests/unit/scripts/`
- Integration tests if applicable
- Test coverage > 80%

Example test structure:
```python
# tests/unit/scripts/test_example_script.py
import pytest
from scripts.example_script import main

def test_main_success():
    """Test successful script execution."""
    assert main() == 0

def test_main_handles_errors():
    """Test error handling."""
    # Test error cases
    pass
```

## Additional Repository Rules

### 1. No Secrets in Code

- ❌ Never commit API keys, passwords, or credentials
- ✅ Use environment variables
- ✅ Use `.env.example` for templates
- ✅ Use macOS Keychain for local secrets

### 2. TypeScript for Application Code

- ✅ All application code must be TypeScript
- ✅ No JavaScript files in `src/`
- ✅ Use strict type checking
- ✅ Include JSDoc for public APIs

### 3. Documentation Standards

- ✅ Update documentation with code changes
- ✅ Use Markdown for all documentation
- ✅ Include code examples in docs
- ❌ Don't create unnecessary documentation files

### 4. Testing Requirements

- ✅ All new features must include tests
- ✅ Maintain > 70% test coverage
- ✅ Tests must pass before merge
- ✅ Use appropriate test types (unit/integration/e2e)

### 5. Commit Standards

- ✅ Use Conventional Commits format
- ✅ Include issue numbers when applicable
- ✅ Keep commits atomic and focused
- ❌ Don't commit work-in-progress to main

### 6. Code Review Process

- ✅ All changes require PR review
- ✅ Address all review comments
- ✅ Ensure CI passes before merge
- ✅ Squash commits on merge

### 7. Dependency Management

- ✅ Document all dependencies
- ✅ Pin versions in lock files
- ✅ Audit dependencies regularly
- ✅ Prefer standard library over third-party

### 8. Performance Standards

- ✅ Profile before optimizing
- ✅ Monitor bundle size
- ✅ Optimize critical paths
- ✅ Use appropriate data structures

## Enforcement

These rules are enforced through:
- **Pre-commit hooks**: Prevent commits violating rules
- **CI/CD checks**: Automated validation on PR
- **Code review**: Manual review by maintainers
- **Automated linting**: ESLint, Pylint, MyPy

## Questions?

If you have questions about these rules or need clarification:
1. Check existing issues and discussions
2. Review `CONTRIBUTING.md` and `docs/DEVELOPMENT.md`
3. Ask in GitHub Discussions
4. Create an issue for rule clarifications

## Updates to Rules

These rules may be updated over time. Major changes will be:
- Announced in GitHub Discussions
- Documented in CHANGELOG
- Communicated to active contributors

---

**Last Updated**: October 30, 2025

**Version**: 1.0.0

**Effective Date**: October 30, 2025

